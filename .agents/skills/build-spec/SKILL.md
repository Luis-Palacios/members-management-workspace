---
name: build-spec
description: Build a cross-repo spec end to end from the workspace session using /swarm by default, spawning one worker per repo as each is ready, a Neon reviewer, and a Hydrogen browser checker. Use when the user says "build <spec>", "start the subagents for <spec>", "let's implement this spec", or invokes /build-spec.
argument-hint: "<docs/specs/slug.md>"
---

The workspace session is the orchestrator for `$ARGUMENTS` (the **Elder** / coordinator, running on the active Gemini 4 Neon model): it plans, spawns repo workers in `/swarm`, has each one's work reviewed by `watchman`, runs UI browser checks via `scout`, opens the PRs, and moves to the next wave. Repo workers write code, their repo's handoff, and commits; they never push. Rules: workspace `AGENTS.md` / `CLAUDE.md`, *Working across repos*.

**Progress & Swarm Overview UI**
- Load `swarm_pane` and write `plan.json` for the Swarm Overview UI (this replaces `mcp__spec-progress__*`). Update `plan.json` as repos move through waves (`waiting`, `running`, `review`, `pr`, `merged`, `blocked`) and mark the plan finished at the end.
- Use `swarm{action: "title", title: "<spec-slug>"}` to name the swarm.

**Roster (when in a `/swarm` session — default)**
Spawn workers with `swarm{action: "add", ...}` and `workspace: "inherit"` (each repo is its own folder):

| Roster name | Owns | Model | Role |
|---|---|---|---|
| `gatekeeper` | `auth-server` | `gemini-4-hydrogen-medium` | Repo worker |
| `steward` | `membership-management` | `gemini-4-hydrogen-medium` | Repo worker |
| `usher` | `staff-app` | `gemini-4-hydrogen-medium` | Repo worker |
| `builder` | `management-infra` | `gemini-4-hydrogen-medium` | Repo worker |
| `watchman` | read-only across repos | `gemini-4-neon-medium` | Reviewer (`spec-reviewer` skill) |
| `scout` | Chrome / `staff-app` UI | `gemini-4-hydrogen-medium` | Browser checker (`browser-check` skill) |

**Fallback (when NOT in a `/swarm` session)**
If `/swarm` is not active, fall back to `define_subagent` and `invoke_subagent`: define a repo worker subagent per repo, a read-only `spec-reviewer` subagent, and a `browser-verifier` subagent (`EnableMCPTools: true` for `chrome-devtools` MCP tools). Follow the same waves, prompts, review, and browser-check workflow.

**1. Plan**
- Read the spec: repos, implementation order, contracts. For each repo, check whether it's already done or in progress (its handoff's progress log, `gh pr list --state all --head feature/<slug>`), and that it's clean on an up-to-date `main`. Pick up where it stands.
- Group the repos into waves. A repo starts once the repos it builds on are **merged**, or alongside them when the spec fixes the contract between them (template names and fields, route shapes). A repo that needs another's real output (routes, API types) waits for that merge.
- Show the plan (waves, what each repo does, what blocks what) and ask once whether to push and open each repo's PR on its own after review passes, or to ask each time. Write `plan.json` for `swarm_pane`.

**2. Start a wave**
For each repo in the wave, gather pointers by grepping (files to change, patterns to copy, handoffs it extends, check commands), then spawn its worker (`gatekeeper`, `steward`, `usher`, or `builder`) with `model: "gemini-4-hydrogen-medium"`, `workspace: "inherit"`, and a `brief` that says:
- Work only in `<repo>`. Read the workspace `AGENTS.md`/`CLAUDE.md` and the repo's `CLAUDE.md`, then the spec (its step and rule numbers).
- The pointers, and what other repos already built, with exact shapes.
- **Write the repo's handoff first**, from the repo's own convention (the workspace `AGENTS.md`/`CLAUDE.md` names the path and the template). Its stages come from the spec's step for this repo.
- Branch `feature/<slug>` from `main`. One commit per stage with the `Co-Authored-By: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>` trailer, ticked in the progress log with its hash. Run lint, type-check, tests, and build.
- **Use `edit_file`/`write_file` only — never `sed -i` or scripts. No push, no PR, no browser checks, don't start or stop servers.** Record deviations in the handoff.
- Report back to `@coordinator` with: `[done]` summary, commits, files, commands with results (failures verbatim), deviations, what other repos need, and for UI work a browser check list (URLs, steps, exact en/es text, widths, roles).

While repo workers run, don't touch their repos: `/sync-main` must not switch or pull them.

**3. When a repo worker reports**
Update `plan.json` to `review`:
1. **Review by `watchman`**: spawn or `@watchman` on `gemini-4-neon-medium` using the `spec-reviewer` skill checklist, giving it the repo, the spec, the branch, and the worker's report. It is read-only and checks the spec's rules and contracts, the handoff, and the code for bugs.
2. **Triage findings against `git -C <repo> diff main` yourself**: read the code, not only the reports. Fix small ones on the branch; send blockers back to the repo's worker on the board (`@<worker>`), then have `@watchman` review again. Drop findings you can show are wrong, and say why.
3. If the worker asks you to do anything else it was blocked from, don't: ask the user.
4. **UI work**: run `browser-check` via `@scout` (on `gemini-4-hydrogen-medium`), with the results recorded in the handoff and committed on the feature branch.
5. Tell the user what passed, what the review found and what was done about it, and what's left. Push and `gh pr create` (or ask, per the plan); update `plan.json` to `pr`. Code PRs get the user's bot review: read it (`gh pr view <n> --json reviews` and inline comments), fix valid notes on the branch, record them in the handoff, reply on the PR. The user merges (`/sync-main merge`); update `plan.json` to `merged` and kill the finished repo worker (`swarm{action: "kill", name: "..."}`).
6. After a merge, start the repos it unblocked. Repeat until every repo is merged.

**4. Finish**
Mark the spec done and trim it to its decisions (workspace `AGENTS.md`/`CLAUDE.md`, *Specs and handoffs*) in a docs PR. Update `plan.json` to finished and kill any remaining workers (`watchman`, `scout`). Mention anything left on locally (`.env` flags, dev servers) and what production needs (deploy order, flags).
