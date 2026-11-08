---
name: sync-main
description: Merge approved PRs by fast-forward, then switch every repo to main, pull, and delete merged branches. Use when the user says "merge the PRs", "PRs are approved", or "switch to main, pull and clean up".
argument-hint: "[merge] [repo ...]"
disable-model-invocation: true
---

Repos: the ones named in `$ARGUMENTS`, or all of `.` (workspace), `staff-app`, `auth-server`,
`membership-management`, `management-infra`. With `merge`, step 2 merges the open PRs first; without it,
skip to step 3.

PRs merge by **fast-forward from here, never with GitHub's button** (squash and rebase are turned off;
merge commit stays on only because GitHub needs one method). Fast-forward keeps the branch's hashes, so the
handoff progress logs stay right, and GitHub marks the PR merged when its commits reach `main`.

1. Look first, for each repo: branch, `git status --short`, `git stash list | head -3`. A repo with
   uncommitted changes is left alone and reported. Don't stash for the user.
2. **Merge** (only with `merge`): list each repo's open PRs (`gh pr list --json number,title,headRefName`),
   show them, and **ask once** which to merge. For each one approved:
   - `git fetch -q && git switch main && git pull --ff-only`, then `git merge --ff-only origin/<branch>`.
   - Not a fast-forward (`main` moved since the branch started): stop for that PR and say so. The fix is to
     rebase the branch onto `main` and force-push it (`--force-with-lease`), which changes its hashes, so
     the handoff's progress log is updated on the branch in the same go. Ask before doing that.
   - `git push origin main`, then confirm `gh pr view <n> --json state` says `MERGED`.
3. `git switch main && git pull --ff-only` in each repo. If the pull isn't a fast-forward, stop for that
   repo and report it.
4. Branches: `git fetch --prune` (GitHub deletes the remote branch when a PR merges through its button; after a
   fast-forward push it may not, so delete it with `git push origin --delete <b>` when it's still there).
   Local branches whose PR is merged (`gh pr list --head <b> --state merged`) are deleted with
   `git branch -d` (they're on `main`, so `-d` works; `-D` only for ones merged before the switch to
   fast-forward, after asking). Never delete `main`.
5. Handoff hashes: fast-forward keeps them, so only check: every hash in the progress logs of the handoffs
   these branches touched is on `main` (`git merge-base --is-ancestor <hash> main`). A missing one (an old
   rebase merge) is fixed in one commit per repo ("Point the <feature> handoff at the merged commits"),
   pushed straight to `main`.
6. Report a table: repo, PRs merged, `main` at `<hash>`, branches deleted, hashes fixed, anything left alone and why.
