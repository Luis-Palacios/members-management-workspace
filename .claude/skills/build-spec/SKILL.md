---
name: build-spec
description: Build a cross-repo spec end to end from the workspace session, starting a Sonnet subagent per repo as each one is ready; each writes its own handoff, and an Opus reviewer checks it. Use when the user says "build <spec>", "start the subagents for <spec>", "let's implement this spec", or invokes /build-spec.
argument-hint: "<docs/specs/slug.md>"
---

The workspace session is the orchestrator for `$ARGUMENTS` (the Elder): it plans, starts one subagent
per repo, has each one's work reviewed, opens the PRs and moves to the next repo. Subagents write code,
their repo's handoff and commits; they never push. Rules: workspace `CLAUDE.md`, *Working across repos*.

**Progress** (the `spec-progress` mod, `.claude/skills/spec-progress/`): call
`mcp__spec-progress__progress` with `{ spec: "<slug>", repos: [...] }` after showing the plan, and each
time a repo changes state (`waiting` with a note of what it waits on, `running`, `review`, `pr` with
`pr`, `merged`, `blocked`); send only the repos that changed. `finished: true` at the end. The mod
tracks the subagents itself (spawned, running, done, tokens) and shows them with a fixed identity per
repo. If the tool isn't there, carry on without it.

**1. Plan**
- Read the spec: repos, implementation order, contracts. For each repo, check whether it's already done or
  in progress (its handoff's progress log, `gh pr list --state all --head feature/<slug>`), and that
  it's clean on an up-to-date `main`. Pick up where it stands.
- Group the repos into waves. A repo starts once the repos it builds on are **merged**, or alongside
  them when the spec fixes the contract between them (template names and fields, route shapes). A
  repo that needs another's real output (routes, API types) waits for that merge.
- Show the plan (waves, what each repo does, what blocks what) and ask once whether to push and open
  each repo's PR on its own after review passes, or to ask each time. Report it to the mod.

**2. Start a wave**: for each repo, gather pointers by grepping (files to change, patterns to copy,
handoffs it extends, check commands), then `Agent` with `subagent_type: general-purpose`,
`model: sonnet`, `run_in_background: true`, and a `description` that starts with the repo's name
(`"staff-app: report submitted emails"`), which is how the mod knows whose it is. The prompt says:
- Work only in `<repo>`. Read the workspace and repo `CLAUDE.md`, then the spec (its step and rule numbers).
- The pointers, and what other repos already built, with exact shapes.
- **Write the repo's handoff first**, from the repo's own convention (the workspace `CLAUDE.md` names
  the path and the template). Its stages come from the spec's step for this repo. If Claude Code
  refuses the new `.md` as a "report file", don't try another route: return its full text.
- Branch `feature/<slug>` from `main`. One commit per stage with the `Co-Authored-By` trailer, ticked in
  the progress log with its hash. After each stage, call `mcp__spec-progress__step` with `done`,
  `total` and a few words (skip it if the tool isn't listed). Run lint, type-check, tests and build.
- **Edit/Write only, never `sed -i` or scripts. No push, no PR, no browser checks, don't start or stop
  servers.** Record deviations in the handoff.
- Report: commits, files, commands with results (failures verbatim), deviations, what other repos need,
  and for UI work a browser check list (URLs, steps, exact en/es text, widths, roles).

While subagents run, don't touch their repos: `/sync-main` must not switch or pull them.

**3. When a subagent reports** (mod: the repo goes to `review`)
1. **Review by the Watchman**: start the `spec-reviewer` agent (Opus, read-only; `description`
   `"<repo>: review"`) with the repo, the spec, the branch and the subagent's report. It checks the
   spec's rules and contracts, the handoff, and the code for bugs.
2. Triage its findings against `git diff main` yourself: read the code, not only the reports. Fix
   small ones on the branch; send blockers back to the repo's subagent with `SendMessage` (its second
   run), then review again. Drop findings you can show are wrong, and say why.
3. If the handoff was refused, write it from the returned text and commit it on the branch.
4. If the subagent asks you to do anything else it was blocked from, don't: ask the user.
5. UI work: `/browser-check`, with the results recorded in the handoff.
6. Tell the user what passed, what the review found and what was done about it, and what's left.
   Push and `gh pr create` (or ask, per the plan); mod: `pr`. Code PRs get the user's bot review: read
   it (`gh pr view <n> --json reviews` and the inline comments), fix valid notes on the branch, record
   them in the handoff, reply on the PR. The user merges (`/sync-main merge`); mod: `merged`.
7. After a merge, start the repos it unblocked. Repeat until every repo is merged.

**4. Finish**: mark the spec done and trim it to its decisions (workspace `CLAUDE.md`, *Specs and
handoffs*), in a docs PR; mod: `finished: true`. Mention anything left on locally (`.env` flags, dev
servers) and what production needs (deploy order, flags).
