---
name: new-spec
description: Plan a new cross-repo feature and write its spec in docs/specs/. Use when the user describes a feature idea and asks "what do you think?", "let's plan this", "draft the spec", or invokes /new-spec.
argument-hint: "<feature idea or slug>"
---

Turn an idea (`$ARGUMENTS`, or the user's message) into `docs/specs/<slug>.md`. Specs hold rules,
contracts between services and the implementation order; handoffs and code come later, per repo.

1. **Read before proposing.** The specs it touches or extends (`docs/specs/`), and the code it would
   change in each repo: models, services, routes, the place a hook already waits (placeholder
   comments, `TODO`s). Note what already exists and can be reused, and what doesn't fit the idea.
2. **Give an opinion, then the open decisions.** Say whether the idea is sound and what you'd change,
   then list the decisions that are the user's as numbered points, each with your recommendation,
   so they can answer "1. Agree, 2. Yes, …" in one message. Name trade-offs (volume, privacy, kill
   switch, what's deployed vs. not). Don't write the spec until they've answered.
3. **Write the spec** on a `chore/<slug>-spec` branch from an up-to-date workspace `main`. Shape (follow
   `report-submitted-emails.md` as first written, see git history):
   - Title, two or three sentences on what and why.
   - **Status** (drafted, date), **Depends on**, **Repo handoffs** (paths per the workspace
     `CLAUDE.md`), **Branch name in every repo** (`feature/<slug>`), permissions (new or none),
     **Design** (canvas page, or why none).
   - **Implementation order**, one step per repo, and which steps can run in parallel: only when
     this spec fixes the contract between them (template names and fields, route shapes). Say it.
   - **Rules (decided, don't reopen)**, numbered, grouped by topic, including every answer from step 2.
   - **Contracts**, per repo: events, payloads, routes with request/response shapes, error codes,
     flags, migrations (or why none). Exact enough that two repos can build against it apart.
   - **Later (not in this spec)**.
   User-facing copy goes in the spec in English and Spanish (*tú*, *grupo pequeño*).
4. **Link it in**: a one-line pointer in specs it changes, a row in `README.md`'s spec table.
5. Check facts you state about the code (grep them). Then show a short summary of the
   decisions you made beyond the user's answers, and ask before committing.
6. On yes: commit, push, `gh pr create` (docs-only PR, no bot review). It merges with `/sync-main merge`.
   Next step is `/run-stage` for the first repo.
