# Report conversations (cross-repo spec)

Elders (and admins) can start a conversation about **one person's attendance row** in a small
group report; the group's leaders reply. This replaces the Google Sheets habit: the leader wrote an
observation per person, elders added a comment on that line, leaders replied. Conversations can be
resolved, and a cross-report **Conversations** inbox shows what is waiting for whom.

**Status:** Part 1 implemented and merged (October 2026); Part 2 (email) planned, **after**
`prayer-follow-up.md`, which adds section threads (rule 2) and lists what they change in Part 2.
*Update (Nov 2026):* Part 1b (an **Unread** inbox tab, rule 17) and **watching groups** (rules
18–22, elders and admins get emails for leaders' comments in the groups they watch) were added
before Part 2 started. The existing Part 2 handoffs need the changes listed in
[Changes to the Part 2 handoffs](#changes-to-the-part-2-handoffs-nov-2026) before work begins.

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

Part 1b, Unread tab (in-app only, runs as usual, not learning mode; can ship before Part 2):
1b. `membership-management`: `tab=unread` on the inbox route and an `unread` tab count.
2b. `staff-app`: the *Unread* tab on `/conversations`.

Part 2 (after Part 1 is on `main`):
3. `auth-server`: recipient language, templates (en/es) including the watcher variants, internal
   endpoint sending through Resend, internal endpoint listing users by permission (watchers).
4. `membership-management`: events (outbox) and deliveries tables, event processing with every
   recipient rule (watchers included), fast path with `BackgroundTasks`, sweeper loop, opt-out and
   watch endpoints.
5. `staff-app`: "Conversation emails" toggle and watched groups in My profile; Watching toggle on
   the group page; email links land on the open panel.

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
17. **Unread tab** (Part 1b, Nov 2026): a fourth tab, *Unread*, lists the threads that are unread
    for you (rule 11), any status, with its own count. It's how you see activity that someone on
    your side already answered (rule 12 is per side, so their reply clears *Needs my reply* for
    you). Only the tab count shows it: the sidebar badge and the dashboard blocks stay *Needs my
    reply* only, so the badge keeps meaning "someone is waiting on us".

### Watching groups (Part 2, Nov 2026)

*Needs my reply* stays per side (rule 12): it's a shared queue, one answer is enough. Making sure
each elder still **hears about** what leaders write is the job of email, per person:

18. **Who watches:** every user with `smallGroups: all` (elders and admins) watches **every group
    by default**, including groups created later and closed groups (rule 13). It comes from the
    permission, not from stored rows: someone who gains the permission watches everything at once,
    and someone who loses it stops. Leaders have no watch setting; they are always emailed about
    their own groups (Part 2 recipients) and can only use the global switch.
19. **What watching sends:** an email for **every leaders'-side comment** in a watched group, the
    one that starts a thread and every reply (`reason = watcher`). Elders'-side comments don't go
    to watchers; other elders hear about those only as participants, or through the *Unread* tab.
20. **The throttle keeps it quiet:** one email per conversation until you open it (the Part 2
    throttle applies to watchers like everyone else). Five leader comments in one thread before you
    open it = one email.
21. **Unwatching is per group**, from the group's page or the list in My profile. Only the
    opt-outs are stored. Unwatching a group doesn't stop **participant** emails for threads you've
    commented in, and it changes nothing in the app (inbox, badge, dashboards). The global
    "Conversation emails" switch wins over everything: off means no conversation emails.
22. **Channel-neutral:** the setting is "watch this group", not "email me about this group", so
    push notifications (later) follow the same rule without a second set of preferences.

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
| `GET /report-conversations?tab=reply\|unread\|open\|resolved&smallGroupId=&page=` | Inbox rows + the tab counts (`unread` added in Part 1b, rule 17) |
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
- **Recipients** (*updated Nov 2026* for watching, rules 18–21):
  - Elders'-side comment that **starts** a thread → the group's current leaders and co-leaders with
    a linked user (`reason = leader`).
  - Leaders'-side comment that **starts** a thread → the group's **watchers** (`reason = watcher`).
    Before Nov 2026 this was "nobody".
  - **Reply** → everyone else who has commented in the thread, not deleted (`participant`); plus,
    for an elders'-side reply, the group's current leaders (`leader`); plus, for a leaders'-side
    reply, the group's watchers (`watcher`).
  - De-duplicate by user id; the reason that wins is `participant`, then `leader`, then `watcher`.
    Never the author. Skip anyone with "Conversation emails" off; skip a watcher who unwatched the
    group (but not as a participant).
  - **Throttle**: skip a recipient who already has a delivery for that thread created after their
    `last_read_at` (or any delivery, if they never opened it).
- **Event first, then deliveries** (*changed Nov 2026*; the earlier design planned one row per
  recipient inside the comment transaction, which stopped fitting once watchers needed
  auth-server). Two tables in membership-management:
  - `conversation_events` (**the outbox**): one row per comment, inserted in the **same
    transaction** as the comment. It says what happened, not who to tell: `conversation_id`,
    `comment_id` (both FK cascade), `type = comment_added`, `starts_thread`, plus the claim columns
    (`status`, `attempts`, `next_attempt_at`, `last_error`, `created_at`, `processed_at`). The
    comment transaction holds **no email rules** and calls nothing.
  - `conversation_notifications` (**deliveries**): one row per recipient, created by processing an
    event: `event_id` FK, `conversation_id`, `recipient_user_id NOT NULL`, `kind` (`new` |
    `reply`), `reason`, `payload` (JSONB snapshot), the same claim columns, `sent_at`. **Unique
    `(event_id, recipient_user_id)`**, so processing an event twice (a crash after inserting,
    before marking it done) can't create a second email.
- **Processing an event** (one function holds every recipient rule): claim the event; if the
  comment is on the leaders' side, ask auth-server for the watchers' user ids; work out all
  recipients (rules above); then in **one transaction** insert the deliveries (`ON CONFLICT DO
  NOTHING`) and mark the event `processed`. If the comment was deleted before processing, mark the
  event processed with no deliveries. If auth-server is down, the event retries on the normal
  schedule and nothing is sent yet.
- **Sending a delivery**: claim it, `POST` its payload to auth-server, mark it `sent`. Each delivery
  succeeds or retries on its own.

  ```
  comment transaction                       worker: process the event
  ┌──────────────────────────────┐          ┌─────────────────────────────────────────────┐
  │ insert comment #9001         │          │ claim event 301                             │
  │ insert event 301             │ ───────► │ leaders' side? GET auth-server              │
  │  comment_added, #9001,       │          │   /internal/users/with-permission           │
  │  starts_thread = false       │          │ all recipients, one function:               │
  └──────────────────────────────┘          │   participants, leaders, watchers,          │
                                            │   de-dup, opt-out, unwatch, throttle        │
                                            │ ONE TRANSACTION: insert deliveries 501, 503 │
                                            │   + event 301 → processed                   │
                                            └─────────────────────────────────────────────┘
                                                              │
                                              worker: send each delivery
                                                              ▼
                                  POST auth-server /internal/notifications/report-conversation
                                  { notificationId: 501, recipientUserId, kind, reason, … } → Resend
  ```

- **auth-server lists users by permission**: `GET /internal/users/with-permission?resource=smallGroups&action=all`
  (same `X-Internal-Token`) → `{ "userIds": [...] }`, computed from `statements.ts`, never from
  role names; banned or deactivated users left out. Asked at processing time, so it's always
  current (no copy of users or roles in membership-management).
- **Watch storage** in membership-management: `small_group_watch_opt_outs` with PK `(user_id,
  small_group_id)` (FK to the group, cascade), `created_at`. No row = watching. Routes:
  `GET /me/watched-groups` → each group in the caller's view with `watching`; `PUT
  /small-groups/{id}/watch` body `{ "watching": bool }` (deletes or inserts the opt-out). Both 403
  without `smallGroups: all`.
- **Payload `reason`**: `leader` | `participant` | `watcher`. auth-server needs a "new" variant
  for a leaders'-side start (today's title is "An elder commented on your group's report") and a
  "why" line for watchers: you watch {group}, and you can stop watching it from the group's page or
  My profile.
- **Fast path**: the comment route adds a FastAPI `BackgroundTasks` task with the event id. After
  the response it processes that event and sends its deliveries, with its own DB session, so the
  request never waits on email.
- **Sweeper**: an asyncio loop started in `main.py`'s `lifespan` on every API task, every **2
  minutes** (random 0–30 s start offset). Each tick claims due **events** and processes them, then
  claims due **deliveries** and sends them, both with `FOR UPDATE SKIP LOCKED` (pending, failed or
  in-progress rows with `next_attempt_at <= now()`, limit 50), each table backed by a partial index
  on `next_attempt_at` for those statuses. The DB layer is sync SQLAlchemy, so the loop runs its DB
  work with `anyio.to_thread`. New rows start at `next_attempt_at = now() + 60 s` so the fast path
  has a head start.
- **Claim = lease**, the same for events and deliveries: claiming sets the in-progress status
  (`processing` / `sending`) and `next_attempt_at = now() + 2 min`. Success → `processed` /
  `sent`. Failure → `failed`, `attempts + 1`, backoff 1, 5, 15, 60 min; after 5 attempts → `dead`
  (logged). A crash mid-way is picked up when the lease expires.
- **Opt-out**: "Conversation emails" in My profile, stored in membership-management per user id
  (it decides recipients). Default on. For users with `smallGroups: all`, My profile also lists
  the groups with a Watching switch each; the group's page has the same switch (rule 21).
- **Payload snapshot**: each delivery stores the exact JSON sent to auth-server, so retries send
  the same payload under the same Resend idempotency key (Resend rejects a reused key with a
  different payload). Keys live 24 hours at Resend; a delivery's retries end within about 80
  minutes of it being created.
- **Push later** is another delivery `channel` created from the same event (rule 22); the events
  table doesn't change.
- **Recipient language**: stored on the auth-server user (`locale`, `en` | `es`), set from the
  request at sign-in while empty and whenever the user picks a language in the account menu.
  Conversation emails use it, falling back to English.
- **Kill switch**: `CONVERSATION_EMAILS_ENABLED` (default `false`). Off = no event rows, no
  sweeper, nothing calls auth-server. The watch switches are hidden while it's off, like the
  "Conversation emails" switch.

## Changes to the Part 2 handoffs (Nov 2026)

The three Part 2 handoffs were written before watching. Apply these in each repo (one repo per
session, as usual) before that repo's Part 2 work starts, next to the section-thread changes from
`prayer-follow-up.md`:

- **auth-server** (`REPORT-CONVERSATIONS-EMAIL-HANDOFF.md`): a stage for the
  `GET /internal/users/with-permission` route; templates gain `reason = watcher` (its "why" line and
  unwatch hint) and a "new" variant when a leader starts the thread (the title can't say "An
  elder"). Copy en/es on the canvas first.
- **membership-management** (`REPORT-CONVERSATIONS-EMAIL-API-HANDOFF.md`): rework it around
  *event first, then deliveries*. Stage 1: `conversation_events`, `conversation_notifications`
  with `event_id` and the unique `(event_id, recipient_user_id)`, `small_group_watch_opt_outs`.
  Stage 2: the comment transaction inserts only the event (no recipient planning there); the
  recipient function moves to event processing. Stage 4: claim and process events (calling the
  auth-server permission route), then claim and send deliveries; the fast path takes the event id.
  Stage 5: the sweeper handles both tables. Stage 6 adds the watch routes. Hand-check list: a
  leader starts a thread → every watching elder gets one email; an elder who unwatched doesn't,
  unless they commented; three leader replies before an elder opens → one email; kill the process
  after the deliveries are inserted but before the event is marked → no duplicate emails;
  auth-server down → the event retries and the comment still saves.
- **staff-app** (`REPORT-CONVERSATIONS-EMAIL.md`): stage 1 adds the watched-groups list in My
  profile and the Watching switch on `/groups/[id]` (only with `smallGroups: all` and while emails
  are on); stage 2's panel note for leaders' side changes from "No email is sent" to "Elders
  watching this group get an email"; the *Decided* line "per user, not per group" becomes "per
  user, plus per group for watchers".
- **Canvas**: the Watching switch, the My profile list, the *Unread* tab and the watcher email
  variants need boards before the staff-app and auth-server stages that use them.

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
