---
name: resume
description: Resume a cross-repo spec or a per-repo handoff at its next stage. Use when the user says "let's resume work on <spec or handoff>", "next stage", "what is next?", or invokes /resume.
argument-hint: "[spec or handoff path]"
---

Find where a feature stands and propose the next stage. Don't edit, branch or switch in this skill.

1. The doc: `$ARGUMENTS`, or the `@` file in the user's message. A `docs/specs/<feature>.md` spec lists its
   repos and implementation order; each repo's handoff (paths in the workspace CLAUDE.md) has the progress
   log at the top. Read the spec's rules for the stage, and the progress log, not the whole history.
2. For each repo the feature touches: `git -C <repo> fetch -q`, then current branch, `git status --short`,
   `git log --oneline -5`, and whether the feature branch is merged (`gh pr list -R <repo> --head <branch>
   --state all --json number,state`).
3. Check the progress log against git: every `[x]` stage's hash on `main` or the feature branch
   (`git merge-base --is-ancestor <hash> main`). PRs merge by fast-forward, so hashes should match; list any that don't.
4. Report in under 10 lines: the stages done, the next stage with its repo and the files it touches, any
   mismatch (stale hashes, uncommitted work, wrong branch, a stage that needs another repo's unfinished work).
5. If the next stage is in a different repo from this session's folder, say so and offer `/next-session`
   instead of starting it here (one repo per session).
6. Stop and wait for the go-ahead.
