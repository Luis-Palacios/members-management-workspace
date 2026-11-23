---
name: run-stage
description: Run a spec's repo stage as a subagent from the main session, review it against the spec, then push and open the PR. Use when the user says "start a subagent for <repo>", "do the <repo> work", or invokes /run-stage.
argument-hint: "<repo> [spec]"
---

One subagent per repo (`$ARGUMENTS`), working only there. The main session prepares, reviews and opens
the PR; the subagent writes code and commits. Rules: workspace `CLAUDE.md`, *Working across repos*.

**Before starting**
1. The spec's implementation order: is this repo next? It may run alongside another only when the spec
   fixes the contract between them; if it builds on another repo's output that isn't merged (routes, API
   types), say so and wait. Each repo must be clean on an up-to-date `main`.
2. Gather pointers (grep, don't read everything): the files to change, the patterns to copy, the
   existing handoffs it extends, the repo's check commands. The subagent starts cold.

**Start it**: `Agent`, `subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`. The
prompt says: work only in `<repo>`; read the workspace and repo `CLAUDE.md`, then the spec (its step and
rule numbers); the pointers; the contracts already built by other repos (exact shapes); branch
`feature/<slug>` from `main`; the handoff path and template; one commit per handoff stage with the
`Co-Authored-By` trailer, stages ticked with hashes; run lint, type-check, tests and build; **Edit/Write
only, never `sed -i` or scripts**; **no push, no PR, no browser checks, don't start or stop servers**;
record deviations in the handoff. If Claude Code refuses its new `.md` as a "report file", don't try
another route: return the full text. Report back: commits, files, commands with results (failures
verbatim), deviations, what the next repo needs, and for UI work a browser check list (URLs, steps,
expected text en/es, widths, roles).

**While it runs**: don't touch that repo. `/sync-main` must not switch or pull it.

**When it reports**
1. Review `git diff main` against the spec's rules and contracts (the code, not only the report). Re-run
   a check if one matters. Fix small issues yourself on the branch, or `SendMessage` the subagent.
2. If its handoff was refused, write it from the returned text and commit it on the branch.
3. If it asks you to do something it was blocked from (other than that `.md`), don't: ask the user.
4. UI work: `/browser-check` before the PR, results in the handoff.
5. Tell the user what passed, what deviated and what's left, then ask before pushing. On yes: push,
   `gh pr create`. Code PRs get the user's bot review: read it (`gh pr view <n> --json reviews` and the
   PR's inline comments), fix valid notes on the branch, record them in the handoff, reply on the PR.
   The user merges with `/sync-main merge`.
6. When every repo of the spec is merged: mark the spec done and trim it to its decisions (a docs PR).
