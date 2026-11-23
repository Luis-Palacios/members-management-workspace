// Progress for /build-spec: a row above the prompt (the spec and each repo's status) and a "Spec agents"
// pane (every repo subagent, the reviewer and the browser checker, each with a fixed identity).
// The orchestrator reports the plan with the `progress` tool; repo subagents report each finished
// handoff stage with `step`. Spawns and finishes are seen through agent.spawn and turn.complete.
// The plan is saved across sessions and its PRs are re-read from GitHub when a session starts.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, Plan, RepoRow, RepoStatus, RoleKey, Step } from '../types'

const PANE = 'spec-agents'
const PANE_TITLE = 'Spec agents'
const STORE_KEY = 'plan'

// Change a shape tag when its fields change: it declines what an earlier version stored.
const plan = atom({ plugin: 'spec-progress', key: 'plan' } as const, null, { shape: 'plan-1' })
const agents = atom({ plugin: 'spec-progress', key: 'agents' } as const, [], { shape: 'agents-1' })
const now = atom({ plugin: 'spec-progress', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'spec-progress', key: 'isHidden' } as const, false)
const hasAutoOpened = atom({ plugin: 'spec-progress', key: 'hasAutoOpened' } as const, false)

type Role = { name: string; letter: string; color: string; job: string }

// Gold and green are the ekklesiaio brand's; the others are picked to read on light and dark terminals.
const ROLES: Record<RoleKey, Role> = {
  elder: { name: 'Elder', letter: 'E', color: '#5B82B8', job: 'plans, reviews, merges' },
  gatekeeper: { name: 'Gatekeeper', letter: 'G', color: '#F2B544', job: 'auth-server' },
  steward: { name: 'Steward', letter: 'S', color: '#1F8A55', job: 'membership-management' },
  usher: { name: 'Usher', letter: 'U', color: '#3B82F6', job: 'staff-app' },
  builder: { name: 'Builder', letter: 'B', color: '#8A94A6', job: 'management-infra' },
  watchman: { name: 'Watchman', letter: 'W', color: '#8B5CF6', job: 'code review' },
  scout: { name: 'Scout', letter: 'L', color: '#D97706', job: 'browser checks' },
}

const REPO_ROLE: Record<string, RoleKey> = {
  'auth-server': 'gatekeeper',
  'membership-management': 'steward',
  'staff-app': 'usher',
  'management-infra': 'builder',
}
const REPOS = Object.keys(REPO_ROLE)
const STATUSES: readonly RepoStatus[] = ['waiting', 'running', 'review', 'pr', 'merged', 'blocked']
const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

// The repo a text names first ("membership-management" before "management-infra" when both appear).
function findRepo(text: string): string | undefined {
  let best: { repo: string; at: number } | undefined
  for (const repo of REPOS) {
    const at = text.indexOf(repo)
    if (at >= 0 && (best === undefined || at < best.at)) best = { repo, at }
  }

  return best?.repo
}

function roleFor(subagentType: string, repo: string | undefined): RoleKey | undefined {
  if (subagentType === 'browser-verifier') return 'scout'
  if (subagentType === 'spec-reviewer') return 'watchman'
  if ((subagentType === 'general-purpose' || subagentType === 'claude') && repo !== undefined) {
    return REPO_ROLE[repo]
  }

  return undefined
}

const shortModel = (model: string) => model.match(/fable|opus|sonnet|haiku/)?.[0] ?? model

function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)

  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

const kTokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k tok` : `${n} tok`)

// A tool's input, read field by field below.
const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

function isRepoRow(value: unknown): value is RepoRow {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>

  return typeof row.repo === 'string' && STATUSES.includes(row.status as RepoStatus)
}

function isPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>

  return typeof p.spec === 'string' && Array.isArray(p.repos) && p.repos.every(isRepoRow)
}

// The orchestrator's report merged into the plan: repos by name, a new spec replaces the old one.
function mergePlan(old: Plan | null, input: Record<string, unknown>, at: number): Plan | string {
  const spec = typeof input.spec === 'string' ? input.spec.trim() : ''
  if (spec === '') return 'spec is required'
  const base: Plan = old !== null && old.spec === spec ? old : { spec, repos: [], isFinished: false, updatedAt: at }
  const repos = [...base.repos]
  const incoming = Array.isArray(input.repos) ? input.repos : []
  for (const raw of incoming) {
    if (!isRepoRow(raw)) return `each repo needs a name and a status (${STATUSES.join(', ')})`
    const row: RepoRow = { repo: raw.repo, status: raw.status }
    if (typeof raw.note === 'string' && raw.note.trim() !== '') row.note = raw.note.trim()
    if (typeof raw.pr === 'number' && Number.isInteger(raw.pr) && raw.pr > 0) row.pr = raw.pr
    const i = repos.findIndex(r => r.repo === row.repo)
    if (i >= 0) {
      const kept = repos[i]
      repos[i] = row.pr === undefined && kept?.pr !== undefined ? { ...row, pr: kept.pr } : row
    } else {
      repos.push(row)
    }
  }

  return { spec, repos, isFinished: input.finished === true, updatedAt: at }
}

function parseStep(input: Record<string, unknown>): Step | string {
  const done = Number(input.done)
  const total = Number(input.total)
  if (!Number.isInteger(done) || !Number.isInteger(total) || total < 1 || done < 0 || done > total) {
    return 'done and total are whole numbers, 0 <= done <= total, total >= 1'
  }
  const step: Step = { done, total }
  if (typeof input.note === 'string' && input.note.trim() !== '') step.note = input.note.trim().slice(0, 60)

  return step
}

const join = (dir: string, child: string) => `${dir.replace(/[\\/]+$/, '')}/${child}`
const parent = (dir: string) => dir.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '')

// The workspace is the session's root, or its parent when the session started in a service folder.
async function findWorkspace($: EngineInterface): Promise<string | null> {
  const root = await $.session.root()
  for (const dir of [root, parent(root)]) {
    const r = await $.process.run(['git', '-C', join(dir, 'staff-app'), 'rev-parse', '--git-dir'], { timeoutMs: 5000 })
    if (r.exitCode === 0) return dir
  }

  return null
}

// A saved plan's open PRs may have merged while no session ran: ask GitHub.
async function refreshMerged($: EngineInterface, saved: Plan): Promise<Plan> {
  const open = saved.repos.filter(r => r.pr !== undefined && r.status !== 'merged')
  if (open.length === 0) return saved
  const workspace = await findWorkspace($)
  if (workspace === null) return saved
  const repos = await Promise.all(
    saved.repos.map(async row => {
      if (row.pr === undefined || row.status === 'merged') return row
      const r = await $.process.run(['gh', 'pr', 'view', String(row.pr), '--json', 'state', '-q', '.state'], {
        cwd: join(workspace, row.repo),
        timeoutMs: 10000,
      })

      return r.exitCode === 0 && r.stdout.trim() === 'MERGED' ? { repo: row.repo, status: 'merged' as const, pr: row.pr } : row
    }),
  )

  return { ...saved, repos }
}

// Module state: starts over on a reload (session.start fills `known` again from the agents atom).
const known = new Set<string>()
let stopTicker: (() => void) | null = null

// Redraws the spinner and elapsed times while a subagent runs; stops itself once none does.
async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
  const list = await read($, agents)
  if (stopTicker !== null && !list.some(a => a.status === 'running')) {
    stopTicker()
    stopTicker = null
  }
}

function startTicker($: EngineInterface) {
  if (stopTicker === null) {
    const timer = $.clock.every(500, () => void tick($))
    stopTicker = () => timer.cancel()
  }
}

// The plan for this session, and saved for the next one until it's finished.
async function savePlan($: EngineInterface, next: Plan) {
  await update($, plan, () => next)
  if (next.isFinished) await $.store.delete(STORE_KEY)
  else await $.store.set(STORE_KEY, next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'progress',
      description:
        'Report /build-spec progress (main session only). Call after showing the plan, and whenever a repo ' +
        'changes state: waiting (blocked on another repo, say which in note), running (its subagent works), ' +
        'review (you or the reviewer check it), pr (open, give pr), merged, blocked. Send only the repos that ' +
        'changed; finished: true once every repo is merged and the spec is trimmed.',
      inputSchema: {
        type: 'object',
        properties: {
          spec: { type: 'string', description: 'The spec slug, e.g. report-submitted-emails' },
          repos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                repo: { type: 'string', enum: REPOS },
                status: { type: 'string', enum: [...STATUSES] },
                note: { type: 'string', description: 'A few words, e.g. "waits on #73"' },
                pr: { type: 'integer', minimum: 1 },
              },
              required: ['repo', 'status'],
            },
          },
          finished: { type: 'boolean' },
        },
        required: ['spec'],
      },
    })
    await $.tool.register({
      name: 'step',
      description:
        'Report your progress on your repo handoff (repo subagents only): after each committed stage, ' +
        'done = stages finished, total = stages in the handoff, note = the stage just finished in a few words.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0 },
          total: { type: 'integer', minimum: 1 },
          note: { type: 'string' },
        },
        required: ['done', 'total'],
      },
      // In every agent's tool list, so a subagent doesn't have to go looking for it.
      isDeferred: false,
    })
    await $.command.register({ name: 'spec-agents', description: 'Show the Spec agents pane (close: hide it)' })

    if ((await read($, plan)) === null) {
      const saved = await $.store.get(STORE_KEY)
      if (isPlan(saved) && !saved.isFinished) {
        const fresh = await refreshMerged($, saved)
        await savePlan($, fresh)
      }
    }
    for (const a of await read($, agents)) known.add(a.id)
    if ((await read($, agents)).some(a => a.status === 'running')) startTicker($)

    return next(e)
  })

  on('command.run', { command: 'spec-agents' }, async ($, e) => {
    if (e.args.trim() === 'close') {
      await $.ui.close({ id: PANE })

      return { text: 'Spec agents pane closed.' }
    }
    const opened = await $.ui.open({ id: PANE, title: PANE_TITLE })

    return { text: opened.isPlaced ? 'Spec agents pane opened.' : `Spec agents pane waits for room: ${opened.reason}` }
  })

  on('tool.run', { tool: 'mcp__spec-progress__progress' }, async ($, e) => {
    if (e.agentId !== undefined) return { result: 'ignored: only the main session reports the plan' }
    const merged = mergePlan(await read($, plan), asRecord(e.input), await $.clock.now())
    if (typeof merged === 'string') return { deny: merged }
    await savePlan($, merged)
    await update($, isHidden, () => false)
    const summary = merged.repos.map(r => `${r.repo} ${r.status}${r.pr === undefined ? '' : ` #${r.pr}`}`).join(', ')

    return { result: `ok: ${merged.spec}${merged.isFinished ? ' (finished)' : ''}: ${summary || 'no repos yet'}` }
  })

  on('tool.run', { tool: 'mcp__spec-progress__step' }, async ($, e) => {
    const id = e.agentId
    if (id === undefined || !known.has(id)) return { result: 'ignored: step is for /build-spec repo subagents' }
    const step = parseStep(asRecord(e.input))
    if (typeof step === 'string') return { deny: step }
    await update($, agents, list => list.map(a => (a.id === id ? { ...a, step } : a)))

    return { result: `ok: ${step.done}/${step.total}` }
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (spawned.deny !== undefined || spawned.agentId === undefined) return spawned
    const repo = findRepo(e.description) ?? findRepo(e.prompt)
    const role = roleFor(e.subagentType, repo)
    if (role === undefined) return spawned
    const id = spawned.agentId
    const startedAt = await $.clock.now()
    known.add(id)
    await update($, agents, list => {
      const run = list.filter(a => a.role === role && a.repo === repo).length + 1
      const row: AgentRow = { id, role, run, description: e.description, model: spawned.model, status: 'running', startedAt, tokens: 0 }
      if (repo !== undefined) row.repo = repo

      return [...list, row].slice(-100)
    })
    await update($, now, () => startedAt)
    startTicker($)
    if (!(await read($, hasAutoOpened))) {
      await update($, hasAutoOpened, () => true)
      void $.ui.open({ id: PANE, title: PANE_TITLE })
    }

    return spawned
  })

  // A subagent sent a message after it finished runs again: its next tool call says so.
  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined && known.has(id)) {
      const list = await read($, agents)
      if (list.some(a => a.id === id && a.status !== 'running')) {
        await update($, agents, rows =>
          rows.map(a => {
            if (a.id !== id) return a
            const { endedAt: _ended, ...rest } = a

            return { ...rest, status: 'running' as const }
          }),
        )
        startTicker($)
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const id = e.agentId
    if (id !== undefined && known.has(id)) {
      const usage = done.usage ?? e.usage
      const tokens = usage === undefined ? 0 : usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
      const endedAt = await $.clock.now()
      const status = e.reason === 'answer' ? ('done' as const) : ('failed' as const)
      await update($, agents, list => list.map(a => (a.id === id ? { ...a, status, endedAt, tokens: a.tokens + tokens } : a)))
      await update($, now, () => endedAt)
    }

    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, plan)
    if (e.props.hasSurvey || p === null || (await read($, isHidden))) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const t = await read($, now)
    const list = await read($, agents)
    const spin = SPINNER[Math.floor(t / 250) % SPINNER.length] ?? '•'
    const elder = ROLES.elder

    return (
      <Box flexDirection="row" flexWrap="wrap">
        <Text color={elder.color} bold>
          [{elder.letter}]
        </Text>
        <Text bold> {p.spec}</Text>
        <Text dimColor>{p.isFinished ? ' · done' : ''}</Text>
        {p.repos.map(row => {
          const role = ROLES[REPO_ROLE[row.repo] ?? 'builder']
          const agent = [...list].reverse().find(a => a.repo === row.repo && a.role === REPO_ROLE[row.repo])
          const mark =
            row.status === 'merged' ? '✓' : row.status === 'running' ? spin : row.status === 'blocked' ? '✗' : row.status === 'pr' ? '⇡' : row.status === 'review' ? '◐' : '○'
          const detail =
            row.status === 'running' && agent?.step !== undefined
              ? `${agent.step.done}/${agent.step.total}`
              : row.status === 'merged' || row.status === 'pr'
                ? `${row.pr === undefined ? '' : `#${row.pr} `}${row.status}`
                : (row.note ?? row.status)

          return (
            <Text>
              <Text dimColor> · </Text>
              <Text color={role.color} bold>
                [{role.letter}]
              </Text>
              <Text>
                {mark} {row.repo} {detail}
              </Text>
            </Text>
          )
        })}
        <Text> </Text>
        <Button key="agents" label="Agents" onPress={() => void $.ui.open({ id: PANE, title: PANE_TITLE })} />
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const p = await read($, plan)
    const list = await read($, agents)
    const t = await read($, now)
    const spin = SPINNER[Math.floor(t / 250) % SPINNER.length] ?? '•'
    const running = list.filter(a => a.status === 'running')
    const finished = list.filter(a => a.status !== 'running').slice(-12).reverse()
    const elder = ROLES.elder

    const agentLine = (a: AgentRow) => {
      const role = ROLES[a.role]
      const state = a.status === 'running' ? `${spin} running` : a.status === 'done' ? '✓ done' : '✗ failed'
      const step = a.step === undefined ? '' : `  ${a.step.done}/${a.step.total}${a.step.note === undefined ? '' : ` ${a.step.note}`}`
      const time = duration((a.endedAt ?? t) - a.startedAt)

      return (
        <Box flexDirection="row">
          <Text color={role.color} bold>
            [{role.letter}] {role.name}
          </Text>
          <Text dimColor>
            {' '}· run {a.run}
            {a.repo === undefined || role.job === a.repo ? '' : ` · ${a.repo}`}
          </Text>
          <Text>
            {'  '}
            {state}
            {step}
          </Text>
          <Text dimColor>
            {'  '}
            {shortModel(a.model)} · {time}
            {a.tokens > 0 ? ` · ${kTokens(a.tokens)}` : ''}
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text>
          <Text color={elder.color} bold>
            [{elder.letter}] {elder.name}
          </Text>
          <Text dimColor> · {elder.job}</Text>
        </Text>
        {p === null ? (
          <Text dimColor>No spec in progress. /build-spec reports one here.</Text>
        ) : (
          <Box flexDirection="column">
            <Text bold>
              {p.spec}
              {p.isFinished ? ' · done' : ''}
            </Text>
            {p.repos.map(row => {
              const role = ROLES[REPO_ROLE[row.repo] ?? 'builder']

              return (
                <Text>
                  <Text color={role.color} bold>
                    {'  '}[{role.letter}] {role.name}
                  </Text>
                  <Text>
                    {'  '}
                    {row.repo} · {row.status}
                    {row.pr === undefined ? '' : ` #${row.pr}`}
                  </Text>
                  <Text dimColor>{row.note === undefined ? '' : ` · ${row.note}`}</Text>
                </Text>
              )
            })}
          </Box>
        )}
        <Text bold>Running</Text>
        {running.length === 0 ? <Text dimColor>  none</Text> : running.map(agentLine)}
        <Text bold>Finished</Text>
        {finished.length === 0 ? <Text dimColor>  none</Text> : finished.map(agentLine)}
      </Box>
    )
  })
}
