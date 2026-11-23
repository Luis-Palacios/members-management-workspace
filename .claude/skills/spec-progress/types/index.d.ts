// Who a row belongs to. Each repo has one fixed identity; the orchestrator, the reviewer and the
// browser checker have their own.
export type RoleKey = 'elder' | 'gatekeeper' | 'steward' | 'usher' | 'builder' | 'watchman' | 'scout'

// A repo's place in the spec, as /build-spec reports it.
export type RepoStatus = 'waiting' | 'running' | 'review' | 'pr' | 'merged' | 'blocked'

export type RepoRow = {
  repo: string
  status: RepoStatus
  // Short words: what it waits on, what's in review.
  note?: string
  pr?: number
}

export type Plan = {
  spec: string
  repos: RepoRow[]
  isFinished: boolean
  updatedAt: number
}

export type Step = { done: number; total: number; note?: string }

export type AgentRow = {
  // The subagent's agentId.
  id: string
  role: RoleKey
  repo?: string
  // 1 for the first subagent of this role and repo, 2 when one is sent back, …
  run: number
  description: string
  model: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  endedAt?: number
  tokens: number
  step?: Step
}

declare module 'claude-code' {
  interface PluginState {
    'spec-progress': {
      plan: Shaped<Plan | null>
      agents: Shaped<AgentRow[]>
      now: number
      isHidden: boolean
      hasAutoOpened: boolean
    }
  }
}
