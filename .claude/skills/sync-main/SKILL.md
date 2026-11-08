---
name: sync-main
description: After PRs merge, switch every repo to main, pull, fix stale handoff hashes, and delete merged branches. Use when the user says "PRs are merged, switch to main, pull and clean up".
argument-hint: "[repo ...]"
disable-model-invocation: true
---

Repos: `$ARGUMENTS`, or all of `.` (workspace), `staff-app`, `auth-server`, `membership-management`,
`management-infra`.

1. Look first, for each repo: branch, `git status --short`, `git stash list | head -3`. A repo with
   uncommitted changes is left alone and reported. Don't stash for the user.
2. `git switch main && git pull --ff-only`. If the pull isn't a fast-forward, stop for that repo and report it.
3. Merged branches: a local branch is merged when its PR is merged (`gh pr list --head <b> --state merged`),
   not only when `git branch --merged` says so (merges rebase, so it usually doesn't). List them with their
   PR numbers, local and remote, then **ask once** before deleting them all (`git branch -D`,
   `git push origin --delete`). Never delete `main`.
4. Handoff hashes: for each handoff whose progress log names those branches' commits, find each hash's
   rebased copy on `main` (same subject: `git log main --format='%h %s' | grep -F "<subject>"`). Fix the
   log in one commit per repo ("Point the <feature> handoff at the merged commits"), and push it straight to
   `main` (the user's standing choice for handoff fixes).
5. Report a table: repo, main at `<hash>`, branches deleted, hashes fixed, anything left alone and why.
