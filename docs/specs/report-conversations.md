# Report conversations (cross-repo spec)

Elders (and admins) can start a conversation about **one person's attendance row** in a small
group report; the group's leaders reply. This replaces the Google Sheets habit: the leader wrote an
observation per person, elders added a comment on that line, leaders replied. Conversations can be
resolved, and a cross-report **Conversations** inbox shows what is waiting for whom.

**Status:** Part 1 implemented and merged (October 2026); Part 2 (email) planned, **after**
`prayer-follow-up.md`, which adds section threads (rule 2) and lists what they change in Part 2.

- **Depends on:** `small-group-reports.md` (rule 9 as changed in Oct 2026: the group's leaders see
  observations), `small-group-leader-access.md` (scope), `roles-and-permissions.md`.
- **Design:** Staff App canvas, page **"Report conversations"**
  (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1). Its blue rules note matches this spec. The
  Report detail boards, Sidebar and both dashboards on other pages were updated too.
- **Repo handoffs (the work, stage by stage):** Part 1:
  `membership-management/docs/REPORT-CONVERSATIONS-API-HANDOFF.md`,
  `staff-app/docs/design/REPORT-CONVERSATIONS.md`. Part 2 (written once Part 1 is on `main`):
  `auth-server/docs/REPORT-CONVERSATIONS-EMAIL-HANDOFF.md`,
  `membership-management/docs/REPORT-CONVERSATIONS-EMAIL-API-HANDOFF.md`,
  `staff-app/docs/design/REPORT-CONVERSATIONS-EMAIL.md`. Part 1 is merged (Oct 2026).
- **Branch name in every repo:** `report-conversations` (Part 2: `report-conversations-email`).
- **auth-server: no change in Part 1.** No new permission (rule 4).

## Two parts, shipped separately

**Part 1, conversations (in-app only).** Threads, comments, resolve, the panel, the inbox, the
dashboard blocks. It must be complete and deployable **without any email**: nothing in Part 1 calls
auth-server, writes outbox rows or depends on Part 2 existing.

**Part 2, email notifications (last, optional for the first deploy).** Transactional outbox in
membership-management, sending through auth-server. It may ship weeks after Part 1, or not at all
at first.

> **Part 2 is a learning exercise. Work it slowly.** Claude Code shows **one code change at a
> time** and explains it; Luis decides, per change, whether he writes it himself (Claude Code then
> reviews it) or Claude Code writes it. No batching several files into one step, no "I'll do the
> rest". This applies to every Part 2 stage in all three repos, and overrides the usual
> "implement the stage, then commit" flow. Part 1 runs as usual.

## Implementation order

Part 1:
1. `membership-management`: tables + migration; thread, comment, resolve and read endpoints;
   per-report summaries; inbox and counts.
2. `staff-app`: Report detail column, summary and panel/sheet; Conversations page; sidebar badge;
   dashboard blocks; delete-report dialog copy.

Part 2 (after Part 1 is on `main`):
3. `auth-server`: recipient language, templates (en/es), internal endpoint sending through Resend.
4. `membership-management`: outbox table, recipient rules, fast path with `BackgroundTasks`,
   sweeper loop, opt-out.
5. `staff-app`: "Conversation emails" toggle in My profile; email links land on the open panel.

One repo per Claude Code session, as usual.

## Rules (decided, don't reopen)

### What a conversation is attached to

1. **One thread per attendance row**: unique `(report_id, member_id)`, and the member must have an
   attendance row in that report. Any row qualifies, attended or not. No-meeting reports have no
   rows, so no threads.
2. **No threads on report sections in v1** (prayer, praise, "for the elders to follow up"). The
   API still returns each thread's anchor as `{ "type": "attendance", "memberId": n }` so sections
   can be added later (`{ "type": "section", "key": "followUp" }`) without changing the client.
   If sections come, "for the elders to follow up" goes first.
   *Update (Oct 2026):* section threads are specified in `prayer-follow-up.md` (rule 14), for all
   three sections.

### Who sees and writes

3. **Same audience as observations** (`small-group-reports.md` rule 9): admins and elders
   (`smallGroupReports: viewObservations`), plus the leaders and co-leaders the small group scope
   lets reach the report (current leaders; for a closed group, its leaders when it closed). Anyone
   in the audience can read every thread on the report, start one and reply. Outside the scope:
   404; no permission: 403. The report's author gets no extra access: once they stop leading the
   group they lose its conversations along with its reports (access rule 3).
4. **No new permission.** Reading and writing conversations is "can see this report's
   observations". Nothing changes in `statements.ts`.
5. **Commenting needs a linked member** (like reports, access rule 10): the comment stores the
   author's `user_id` (JWT `sub`) and `member_id`, and the member's name is what's shown. An admin
   or elder with no linked member can read but gets 409 "Link your account to a member to comment."
6. **Sides.** A comment is on the **elders' side** when its author has `smallGroups: all` at the
   time of writing, otherwise on the **leaders' side**. Stored on the comment, so later role changes
   don't rewrite history.

### Comments

7. **Plain text**, 1–4000 characters after trimming. No attachments, no @mentions in v1.
8. **Edit your own** comments any time. The comment gets `edited_at`; the previous text goes to a
   revisions table, never returned by the API (kept for pastoral accountability).
9. **Delete your own** comments: soft delete (`deleted_at`). Shown in place as "Comment deleted ·
   date"; the body is never returned again. Counts exclude deleted comments. No one deletes
   another person's comment in v1.

### Status, reading, replies

10. **Status is `open` or `resolved`.** Any participant in the audience can resolve or reopen. A
    new comment on a resolved thread reopens it (one request, one transaction).
11. **Unread**: a thread is unread for you when it has a comment by someone else newer than your
    `last_read_at`. Opening the panel marks it read (explicit `POST …/read`, not on GET).
12. **Needs your reply**: the thread is open and its latest comment is on the **other side** from
    you. Elders' side for full roles, leaders' side for scoped roles. This drives the amber row
    indicator, the inbox tab, the sidebar badge and the dashboard blocks.
13. **Closed groups**: reports stay read-only, but conversations on them stay open for comments,
    edits and resolving. Pastoral follow-up outlives the group.
14. **Deleting a report deletes its conversations** (cascade). The delete dialog says so and gives
    the count.

### Inbox

15. **Elders and admins see every group; leaders see their scope.** Tabs: *Needs my reply*, *Open*
    (includes the first), *Resolved*. Optional group filter. Newest activity first. Each row opens
    the report with that person's panel.
16. **Dashboards** show up to 3 *Needs my reply* rows at the top (leader dashboard and the elder
    Groups dashboard), hidden when there are none.

## Contracts (Part 1)

### membership-management

Tables (migration on branch `report-conversations`; names can be adjusted in the handoff):

| Table | Columns (beyond `id`) |
| --- | --- |
| `report_conversations` | `report_id` FK cascade, `member_id` FK, `status`, `created_by_user_id`, `created_at`, `resolved_by_user_id`, `resolved_at`, `last_comment_at`, `last_comment_side` · unique `(report_id, member_id)` |
| `report_conversation_comments` | `conversation_id` FK cascade, `author_user_id`, `author_member_id` FK, `side`, `body`, `created_at`, `edited_at`, `deleted_at` |
| `report_conversation_comment_revisions` | `comment_id` FK cascade, `body`, `replaced_at` |
| `report_conversation_reads` | PK `(user_id, conversation_id)`, `last_read_at` |

`user_id` columns are string references to auth-server users, no foreign key (workspace rule).
`last_comment_at` / `last_comment_side` are denormalised on write so the inbox query stays simple.

Routes (camelCase, `CamelModel`):

| Route | Purpose |
| --- | --- |
| `GET /small-group-reports/{id}/conversations` | Summaries for the row indicators: `memberId`, `status`, `commentCount`, `unread`, `needsMyReply` |
| `GET /small-group-reports/{id}/conversations/{memberId}` | One thread: anchor, status, resolved by/at, comments (deleted ones as stubs), `firstUnreadCommentId`. 404 when no thread yet |
| `POST /small-group-reports/{id}/conversations/{memberId}/comments` | Add a comment; creates the thread if needed; reopens if resolved |
| `PATCH /report-conversation-comments/{id}` | Edit own (rule 8) |
| `DELETE /report-conversation-comments/{id}` | Soft delete own (rule 9) |
| `POST /report-conversations/{id}/resolve` · `/reopen` | Rule 10 |
| `POST /report-conversations/{id}/read` | Rule 11 |
| `GET /report-conversations?tab=reply\|open\|resolved&smallGroupId=&page=` | Inbox rows + the three tab counts |
| `GET /report-conversations/counts` | `{ needsMyReply }` for the sidebar badge (cheap, called per page) |

Errors the staff app tells apart (status + `detail`, never shown raw): 409 `Link your account`
(rule 5), 422 `attendance` (member not on that report), 403 `not your comment`.

### staff-app

- Report detail: Conversation column (desktop/tablet) and a bubble on each card (phone); summary
  above the table; panel at `/groups/reports/[id]?person=[memberId]` (side panel ≥ 1024, bottom
  sheet below). Same panel for 0 or N comments.
- `/conversations`: the inbox, a top-level nav item visible when the user can see observations or
  leads a group; badge from `/report-conversations/counts`.
- Dashboard blocks reuse the inbox route with `tab=reply` and a limit of 3.
- Everything shown on the canvas boards, light/dark, en/es, 1440/1024/390.

## Contracts (Part 2: email)

Recap of the decisions; the handoffs hold the detail.

- **auth-server stays the only sender** (React Email templates, Resend). New internal route
  `POST /internal/notifications/report-conversation`, authenticated with the shared
  `INTERNAL_API_TOKEN` (`X-Internal-Token`), the reverse of the existing member-link call. Body:
  `notificationId`, `recipientUserId`, `kind` (`new` | `reply`), `actorName`, `groupName`,
  `meetingDate`, `path`. auth-server looks up the recipient's email and language, renders, sends,
  and passes `notificationId` to Resend as the idempotency key (confirm Resend's current support
  when writing the handoff).
- **No comment text and no member name in any email.** Only who wrote, which group, which report
  date, and a link.
- **Recipients**: an elders'-side comment that **starts** a thread → the group's current leaders and
  co-leaders with a linked user. A leaders'-side comment that starts a thread → nobody. A reply →
  everyone else who has commented in the thread (not deleted), plus for elders'-side replies the
  group's current leaders. Never the author. Skip anyone who opted out.
- **Throttle**: no new row for a recipient who already has a notification for that thread created
  after their `last_read_at`.
- **Transactional outbox** in membership-management: `conversation_notifications` rows are inserted
  in the **same transaction** as the comment (`status = pending`, `next_attempt_at = now() + 60s`).
- **Fast path**: the comment route adds a FastAPI `BackgroundTasks` task that claims that row by id
  and calls auth-server, so the request never waits on email.
- **Sweeper**: an asyncio loop started in `main.py`'s `lifespan` on every API task, every **2
  minutes** (random 0–30 s start offset). It claims due rows with `FOR UPDATE SKIP LOCKED`
  (`status IN ('pending','failed','sending') AND next_attempt_at <= now()`, limit 50), backed by a
  partial index on `next_attempt_at` for those statuses. The DB layer is sync SQLAlchemy, so the
  loop runs its DB work with `anyio.to_thread`.
- **Claim = lease**: claiming sets `status = sending`, `next_attempt_at = now() + 2 min`. Success →
  `sent`. Failure → `failed`, `attempts + 1`, backoff 1, 5, 15, 60 min; after 5 attempts → `dead`
  (logged). A crash mid-send is picked up when the lease expires.
- **Opt-out**: "Conversation emails" in My profile, stored in membership-management per user id
  (it decides recipients). Default on.
- **Payload snapshot**: each outbox row stores the exact JSON sent to auth-server, so retries
  send the same payload under the same Resend idempotency key (Resend rejects a reused key with a
  different payload). Keys live 24 hours at Resend; the retries end within about 80 minutes.
- **Recipient language**: stored on the auth-server user (`locale`, `en` | `es`), set from the
  request at sign-in while empty and whenever the user picks a language in the account menu.
  Conversation emails use it, falling back to English.
- **Kill switch**: `CONVERSATION_EMAILS_ENABLED` (default `false`). Off = no outbox rows, no
  sweeper, nothing calls auth-server.

## Starter prompts (Part 1; copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/REPORT-CONVERSATIONS-API-HANDOFF.md` in this repo. Read
> `../docs/specs/report-conversations.md` first, then `../docs/specs/small-group-reports.md`
> (rule 9) and `../docs/specs/small-group-leader-access.md` for the scope. Stage by stage on
> branch `report-conversations`, one commit per stage, progress log filled in. Run `ruff` and `ty`
> each stage and try every role in the handoff's list against the routes. No email, no outbox and
> no auth-server calls: that's Part 2.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/REPORT-CONVERSATIONS.md` in this repo. Read
> `../docs/specs/report-conversations.md` first, then open the "Report conversations" page of the
> Staff App canvas for each stage's boards. Stage by stage on branch `report-conversations`, one
> commit per stage, progress log filled in, light and dark, 1440 / 1024 / 390, English and
> Spanish. The membership-management conversation endpoints must be running locally; if they
> aren't there yet, tell me instead of stubbing.

## Not in this spec

- Threads on report sections (rule 2).
- Member detail conversation history across reports (v2).
- Push notifications through the PWA (v2; the outbox is where they'd plug in).
- @mentions, attachments, reactions.
- Daily or weekly email digests.
- Moderation: admins deleting or hiding someone else's comment (rule 9 is own comments only).
