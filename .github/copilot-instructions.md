# Copilot workspace guidance

The shared workspace rules are in `AGENTS.md` and `CLAUDE.md`; follow the relevant service's
instructions when working in that service. Each service is a separate repository.

The existing planning and review skills are shared with other agents. Use their spec, handoff,
contract, and review requirements, but use the Copilot tools actually available in the session
instead of assuming Claude Code or Antigravity tool names, models, hooks, or plugins exist.
Report a blocked step when its required capability is unavailable rather than claiming it ran.

The branch naming convention in `CLAUDE.md` still applies even when its branch-name hook is not
active. Respect the session's workspace and branch constraints; do not switch or clean another
checkout while it is in use. Push, open a PR, or merge only with the required user authorization.

Browser verification requires a suitable verifier and browser access. Do not claim the existing
`browser-verifier` or Chrome integration is available without checking, and do not weaken the
production write restrictions in the browser-check skill.
