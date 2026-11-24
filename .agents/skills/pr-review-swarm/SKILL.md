---
name: pr-review-swarm
description: >-
  Scout open GitHub Pull Requests across all members-management workspace repos,
  fan out parallel /github-pr-review swarm workers as antigravity-lp-reviewer[bot],
  and stand by to re-review fixes until approved. Use when the user asks to scout
  or review open PRs across repos, run a PR review swarm, or invokes /pr-review-swarm.
---

# Cross-Repo PR Scout & Review Swarm

Coordinator runbook for discovering open PRs across the `members-management` workspace, running `/github-pr-review` in parallel via `/swarm`, and standing by for fix re-reviews.

## Workspace Repos & Reviewer Roster

All workers run with `workspace: "inherit"` (strictly read-only) and inherit the coordinator's active model (leave `model` unset unless the user requests another):

| Roster name | Repo path (under workspace root) |
|---|---|
| `pr-scout` | Read-only discovery across all repos below |
| `workspace-reviewer` | `.` (`members-management-workspace` root) |
| `auth-reviewer` | `auth-server` |
| `membership-reviewer` | `membership-management` |
| `staff-reviewer` | `staff-app` |
| `infra-reviewer` | `management-infra` |
| `landing-reviewer` | `ekklesiaio-landing` |
| `design-reviewer` | `design-canvas` |
| `monitor` | Stall monitor (add if `swarm_monitor` skill is available) |

Skip any repo directory that does not exist or has no GitHub remote.

## 1. Initialize the Swarm

1. Name the swarm: `swarm{action: "title", title: "GitHub PR reviews across repos"}`.
2. Add `monitor` (if `swarm_monitor` is in the available skills list).
3. Load `swarm_pane` and write/update `plan.json` as workers are added.
4. End the creation turn with the `open_board` link from `swarm` on its own line.

## 2. Scout Open PRs (Skip if User Named Specific PRs)

- If the user already specified a repo and PR number, go straight to Step 3 for that repo.
- Otherwise, spawn (or wake) `pr-scout` to list open PRs across all 7 repos:
  ```bash
  gh pr list --state open --json number,title,headRefName,baseRefName,url,isDraft,updatedAt,reviewDecision,reviews
  ```
  (Try sandboxed first; retry with `BypassSandbox: true` if network access is blocked.)
- `pr-scout` reports `@coordinator [done]` with every open PR (repo, PR #, title, branch, head SHA, URL, draft status, and whether `antigravity-lp-reviewer[bot]` has already reviewed/approved the latest head). Report draft PRs to the user and skip reviewing them unless asked.

## 3. Fan Out Parallel `/github-pr-review` Workers

For each open PR needing review, spawn the repo's named reviewer (or wake it by `@name` if already waiting in the swarm) with a brief instructing it to:

1. Read and follow `.agents/skills/github-pr-review/SKILL.md`.
2. Inspect the PR with `gh pr view <N>` and `gh pr diff <N>` (use `BypassSandbox: true` if blocked).
3. Review against workspace `AGENTS.md`, the repo's `CLAUDE.md`, and any referenced spec (`docs/specs/`) or handoff. Check correctness, edge cases, cross-platform behavior (Windows PowerShell/cmd vs POSIX), permissions, tests, and conventions.
4. Run relevant read-only verification checks (typecheck, lint, tests) without editing or committing any repository files. Write any temporary `review.json` payload to the worker's own scratch directory so the repo stays clean.
5. Post the review as `antigravity-lp-reviewer[bot]` using the bot wrapper:
   - Inline per-file/line comments via `api repos/{owner}/{repo}/pulls/<N>/reviews --method POST --input <scratch-path>` when findings exist.
   - Clean approval via `pr review <N> --approve --body ...` when no inline comments are needed.
6. If an unsandboxed command-approval prompt times out, keep the prepared payload in scratch and post `@coordinator` with the verdict, summary, and ready-to-retry status.
7. When posted, report `@coordinator [done] <repo PR #, verdict, review URL, and concise summary>`.

## 4. Report & Stand By for Fixes / Re-Review

1. Wait until all active reviewers finish (`swarm_wait`), then post a one-line `[done] <summary>` with **no `@` mention** on the board so `monitor` goes quiet while waiting on the user.
2. Present a consolidated summary table to the user (Repo, PR #, Verdict, Review URL, blocking findings, non-blocking nits, and any timed-out reviews ready to retry).
3. **Keep reviewers alive (`waiting`)** rather than killing them during standby — waiting costs zero tokens and preserves full PR context.
4. **Retries:** When the user is ready to approve timed-out bot commands, wake only those reviewers (`@<reviewer>`) to retry posting their prepared payloads.
5. **Re-reviews:** When the user says fixes are pushed, wake the corresponding waiting reviewer(s) referencing their prior findings post (`#<seq>`) to inspect the updated diff, verify all findings are fixed without regressions, re-run read-only checks, and post the updated bot review (`APPROVE` or `REQUEST_CHANGES`).
6. **New PRs:** When the user reports new PRs are open, wake `@pr-scout` to rescan and repeat Steps 2–4.
