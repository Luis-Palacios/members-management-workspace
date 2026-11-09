// A row above the prompt for the members-management workspace: each repo's branch and uncommitted file
// count, and whether the local dev stack is up. Refreshes when the session starts, after each Bash
// command, and every 30 s. Ports and URLs match the /servers skill.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RepoStatus, ServiceStatus, Snapshot } from '../types'

const snapshot = atom({ plugin: 'workspace-status', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'workspace-status', key: 'isHidden' } as const, false)

const REPOS = ['.', 'staff-app', 'auth-server', 'membership-management', 'management-infra']
const HTTP_SERVICES = [
  { name: 'app', url: 'http://localhost:3001/' },
  { name: 'auth', url: 'http://localhost:5000/health/live' },
  { name: 'api', url: 'http://localhost:8000/health/live' },
]

const join = (dir: string, child: string) => (child === '.' ? dir : `${dir.replace(/[\\/]+$/, '')}/${child}`)
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

async function repoStatus($: EngineInterface, workspace: string, name: string): Promise<RepoStatus | null> {
  const cwd = join(workspace, name)
  const branch = await $.process.run(['git', 'branch', '--show-current'], { cwd, timeoutMs: 5000 })
  if (branch.exitCode !== 0) return null
  const status = await $.process.run(['git', 'status', '--porcelain'], { cwd, timeoutMs: 5000 })
  const dirty = status.stdout.split('\n').filter(line => line.trim() !== '').length

  return { name: name === '.' ? 'workspace' : name, branch: branch.stdout.trim() || '(detached)', dirty }
}

async function isHttpUp($: EngineInterface, url: string): Promise<boolean> {
  const timeout = $.clock.sleep(1500).then(() => false)
  const fetch = $.http.fetch(url).then(
    () => true,
    () => false,
  )

  return Promise.race([fetch, timeout])
}

async function isPostgresUp($: EngineInterface): Promise<boolean> {
  try {
    const r = await $.process.run(['docker', 'ps', '--filter', 'name=^my-postgres$', '--format', '{{.State}}'], {
      timeoutMs: 5000,
    })

    return r.exitCode === 0 && r.stdout.trim() === 'running'
  } catch {
    return false
  }
}

let isRefreshing = false

async function serviceStatus($: EngineInterface, name: string, url: string): Promise<ServiceStatus> {
  return { name, isUp: await isHttpUp($, url) }
}

async function refresh($: EngineInterface): Promise<void> {
  if (isRefreshing) return
  isRefreshing = true
  try {
    const workspace = await findWorkspace($)
    if (workspace === null) return
    const repos: RepoStatus[] = []
    for (const name of REPOS) {
      const r = await repoStatus($, workspace, name)
      if (r !== null) repos.push(r)
    }
    const services: ServiceStatus[] = []
    for (const s of HTTP_SERVICES) services.push(await serviceStatus($, s.name, s.url))
    services.push({ name: 'db', isUp: await isPostgresUp($) })
    const next: Snapshot = { repos, services }
    await update($, snapshot, () => next)
  } catch {
    // git or docker couldn't start, or a call timed out: keep the last snapshot, try again next refresh.
  } finally {
    isRefreshing = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'workspace-status', description: 'Show or hide the workspace status row' })
    const started = await next(e)
    void refresh($)
    $.clock.every(30_000, () => refresh($))

    return started
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    void refresh($)

    return result
  })

  on('command.run', { command: 'workspace-status' }, async $ => {
    const hidden = await read($, isHidden)
    await update($, isHidden, () => !hidden)
    if (hidden) void refresh($)

    return { text: hidden ? 'Workspace status row shown.' : 'Workspace status row hidden.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden))) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" flexWrap="wrap">
        {snap.repos.map(r => (
          <Text key={r.name}>
            <Text dimColor>{r.name} </Text>
            <Text color={r.branch === 'main' ? 'subtle' : 'warning'}>{r.branch}</Text>
            {r.dirty > 0 ? <Text color="warning">{` +${r.dirty}`}</Text> : null}
            <Text dimColor>{'  '}</Text>
          </Text>
        ))}
        <Text dimColor>{'│ '}</Text>
        {snap.services.map(s => (
          <Text key={s.name}>
            <Text color={s.isUp ? 'success' : 'error'}>{s.isUp ? '●' : '○'}</Text>
            <Text dimColor>{` ${s.name}  `}</Text>
          </Text>
        ))}
      </Box>
    )
  })
}
