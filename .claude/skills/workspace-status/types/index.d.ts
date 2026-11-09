export type RepoStatus = { name: string; branch: string; dirty: number }
export type ServiceStatus = { name: string; isUp: boolean }
export type Snapshot = { repos: RepoStatus[]; services: ServiceStatus[] }

declare module 'claude-code' {
  interface PluginState {
    'workspace-status': { snapshot: Snapshot | null; isHidden: boolean }
  }
}
