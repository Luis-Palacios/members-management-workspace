# Report conversations (cross-repo spec)

Elders (and admins) can start a conversation about **one person's attendance row** in a small
group report; the group's leaders reply. This replaces the Google Sheets habit: the leader wrote an
observation per person, elders added a comment on that line, leaders replied. Conversations can be
resolved, and a cross-report **Conversations** inbox shows what is waiting for whom.

**Status:** Part 1 implemented and merged (October 2026); Part 2 (email) planned, **after**
`prayer-follow-up.md`, which adds section threads (rule 2) and lists what they change in Part 2.
*Update (Nov 2026):* Part 1b (an **Unread** inbox tab with *Mark all read*, rule 17), **watching
groups** (rules 18–23, elders and admins get emails for leaders' comments in the groups they watch)
and an **event-first, worker-based** Part 2 design were added before Part 2 started. The existing Part 2 handoffs need the changes listed in
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
1b. `membership-management`: `tab=unread` on the inbox route and an `unread` tab count (filtered in
    SQL); *Mark all read*.
2b. `staff-app`: the *Unread* tab on `/conversations` and its *Mark all read* action.

Part 2 (after Part 1 is on `main`):
3. `auth-server`: recipient language; templates (en/es) including the watcher variants; the generic
   `POST /internal/notifications` sending through Resend; `GET /internal/users/with-permission`.
4. `membership-management`: the worker entry point; `outbox_events`; the report-conversations
   consumer (audience, recipients, watchers, throttle); the generic `notifications/` module
   (deliveries, preferences, sender); expiry, monitoring, purge; opt-out and watch endpoints.
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
    reply* only, so the badge keeps meaning "someone is waiting on us". The filter and the count
    are SQL on `last_comment_user_id` / `last_comment_at` against the caller's read row (not the
    Python `is_unread` helper), so paging and counts agree.
    **Mark all read**: on launch, and whenever someone gains access (a new elder, a new leader),
    *Unread* lists every thread they never opened. *Mark all read* on the tab marks every thread in
    the caller's view (and the group filter, when one is set) read as of now.

### Watching groups (Part 2, Nov 2026)

*Needs my reply* stays per side (rule 12): it's a shared queue, one answer is enough. Making sure
each elder still **hears about** what leaders write is the job of email, per person:

18. **Who watches:** the **full-scope observation audience**, users with both `smallGroups: all`
    and `smallGroupReports: viewObservations` (elders and admins today), the same people rule 3
    lets read every group's conversations. They watch **every group by default**, including groups
    created later and closed groups (rule 13). It comes from the permissions, not from stored rows:
    someone who gains them watches everything at once, and someone who loses either stops. Leaders
    have no watch setting; they are always emailed about their own groups (Part 2 recipients) and
    can only use the global switch.
19. **What watching sends:** an email for **every leaders'-side comment** in a watched group, the
    one that starts a thread and every reply (`reason = watcher`). Elders'-side comments don't go
    to watchers; other elders hear about those only as participants, or through the *Unread* tab.
20. **The throttle keeps it quiet:** one email per conversation until you open it (the Part 2
    throttle applies to watchers like everyone else). Five leader comments in one thread before you
    open it = one email, also when they arrive at the same moment. Accepted trade-off: if that one
    email ends `dead` or `expired`, you get no more emails for that thread until you open it; the
    badge, the inbox and the *Unread* tab still show it.
21. **Unwatching is per group**, from the group's page or the list in My profile. Only the
    opt-outs are stored. Unwatching a group doesn't stop **participant** emails for threads you've
    commented in, and it changes nothing in the app (inbox, badge, dashboards). The global
    "Conversation emails" switch wins over everything: off means no conversation emails.
22. **Channel-neutral:** the setting is "watch this group", not "email me about this group", so
    push notifications (later) follow the same rule without a second set of preferences.
23. **Every email goes to someone who can open it.** Whatever the reason (leader, participant,
    watcher), a recipient must be in the conversation's **current** audience (rule 3) when the email
    is planned: a leader who stepped down, or an elder whose role changed, stops getting emails
    about conversations they commented in, as they stop seeing them.

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
| `POST /report-conversations/read-all?smallGroupId=` | Part 1b, rule 17: mark every thread in the caller's view (and filter) read; one upsert, returns `{ marked }` |

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

Recap of the decisions; the handoffs hold the detail. *Rewritten Nov 2026* (PR #10 review): event
first, then deliveries; a worker with its own entry point; a generic notifications layer, so the
worker can move to its own service and auth-server can be swapped for a notification service later
without redesign.

### Shape

```
membership-management                                                              auth-server
┌──────────────────────────────────────────────────────────────────────────────┐
│ API: comment transaction                                                     │
│   insert comment + outbox_events row (report_conversation.comment_added)     │
│                                                                              │
│ worker (python -m membership_management.worker, or embedded in the API)      │
│  ┌───────────────────────────────────┐   ┌─────────────────────────────────┐ │
│  │ report-conversations consumer     │   │ notifications/ (generic)        │ │
│  │  event → notification requests:   │──►│  channel preferences by category│ │
│  │  audience, recipients, watchers,  │   │  notification_deliveries        │ │
│  │  unwatch, throttle (domain rules) │   │  Sender ────────────────────────┼─┼─► POST /internal/notifications
│  └───────────────────────────────────┘   └─────────────────────────────────┘ │     → template → Resend
│        ▲ full-scope audience (cached per sweep) ◄────────────────────────────┼──── GET /internal/users/with-permission
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Domain side (report conversations)** knows conversations: who should hear about a comment and
  why. It owns the audience check, the recipient rules, watch opt-outs and the throttle.
- **`notifications/`** knows nothing about conversations: it applies a user's preference for a
  `category` and `channel`, stores deliveries, and sends them through a `Sender` interface. The next
  email type (e.g. "report submitted") reuses it with a new category and template.
- **The worker** processes events and sends deliveries. Moving it to its own ECS service, or the
  sender to a notification service, is configuration, not a redesign.

### auth-server contracts

- **`POST /internal/notifications`** (shared `INTERNAL_API_TOKEN`, `X-Internal-Token`, the reverse
  of the existing member-link call). Body:
  `{ "idempotencyKey": "mm:notification-delivery:501", "recipientUserId": "u_abc", "template":
  "report-conversation.new" | "report-conversation.reply", "data": { … }, "path": "/groups/reports/812?person=1207" }`.
  `data` for both report-conversation templates: `actorName`, `groupName`, `meetingDate`,
  `reason` (`leader` | `participant` | `watcher`), `topic` (`person` | `prayer` | `praise` |
  `followUp`, from `prayer-follow-up.md`), `startedBy` (`elders` | `leaders`, for the "new"
  title). auth-server **validates `data` against a schema per template** (a zod union keyed on
  `template`; unknown template or bad data → 422), looks up the recipient's email and language,
  renders, sends, and passes `idempotencyKey` to Resend. Responses: 2xx sent; 4xx permanent (unknown
  or banned user, bad data: don't retry); 5xx or timeout: retry.
- **`GET /internal/users/with-permission?permission=smallGroups:all&permission=smallGroupReports:viewObservations`**
  (same token) → `{ "userIds": [...] }`: users holding **all** the listed permissions, computed from
  `statements.ts`, never from role names; banned or deactivated users left out.
- **No comment text and no member name in any email.** Only who wrote, which group, which report
  date, and a link.

### Recipients (domain consumer)

For a `report_conversation.comment_added` event:

- Elders'-side comment that **starts** a thread → the group's current leaders and co-leaders with a
  linked user (`leader`).
- Leaders'-side comment that **starts** a thread → the group's **watchers** (`watcher`; rule 18).
  Before Nov 2026 this was "nobody".
- **Reply** → everyone else who has commented in the thread, not deleted (`participant`); plus, for
  an elders'-side reply, the group's current leaders (`leader`); plus, for a leaders'-side reply,
  the group's watchers (`watcher`).
- **Current audience only (rule 23):** drop anyone not in the conversation's audience right now:
  scoped users must be in the group's scope (current leaders; for a closed group, its leaders when
  it closed), everyone else must be in the full-scope list from auth-server. That list is fetched
  **once per sweep** and reused for every event in it.
- De-duplicate by user id; the reason that wins is `participant`, then `leader`, then `watcher`.
  Never the author. A watcher who unwatched the group is dropped as a watcher only (rule 21).
- Then ask `notifications/` which of them have `report_conversation` email enabled; drop the rest
  **before** the throttle, so a user with emails off never uses up their one email.
- **Throttle, atomic** (rule 20), in the same transaction that inserts the deliveries. Domain table
  `report_conversation_notify_state`: PK `(user_id, conversation_id)` (FK cascade to the
  conversation), `last_notified_at`. Per recipient:
  ```sql
  INSERT INTO report_conversation_notify_state (user_id, conversation_id, last_notified_at)
  VALUES (:user_id, :conversation_id, clock_timestamp())
  ON CONFLICT (user_id, conversation_id) DO UPDATE SET last_notified_at = excluded.last_notified_at
  WHERE report_conversation_notify_state.last_notified_at
        <= coalesce((SELECT last_read_at FROM report_conversation_reads r
                     WHERE r.user_id = :user_id AND r.conversation_id = :conversation_id),
                    '-infinity')
  RETURNING user_id;
  ```
  Only users it returns get a delivery. Postgres re-checks the `WHERE` against the latest locked
  row, so two events processed at the same moment give one email. `clock_timestamp()`, not `now()`
  (the transaction's start). The throttle doesn't read deliveries, so purging them can't change it.

### Tables (membership-management)

| Table | Side | Columns |
| --- | --- | --- |
| `outbox_events` | generic | `id`, `event_type` (`report_conversation.comment_added`), `schema_version`, `aggregate_type` (`report_conversation`), `aggregate_id`, `payload` JSONB, claim columns, `created_at`, `processed_at`. **No foreign keys.** |
| `notification_deliveries` | generic | `id`, `source_event_id`, `recipient_user_id NOT NULL`, `category` (`report_conversation`), `channel` (`email`), `template`, `payload` JSONB (exactly what the `Sender` sends), claim columns, `created_at`, `sent_at` · **unique `(source_event_id, recipient_user_id, channel)`** |
| `notification_preferences` | generic | PK `(user_id, category, channel)`, `enabled`, `updated_at`. No row = enabled |
| `report_conversation_notify_state` | domain | above (throttle) |
| `small_group_watch_opt_outs` | domain | PK `(user_id, small_group_id)` (FK cascade to the group), `created_at`. No row = watching |

- **Event payload** (version 1): `conversationId`, `commentId`, `side`, `authorUserId`,
  `startsThread`, `occurredAt`. Ids and facts only, never comment text. The event identifies
  itself; the consumer still reads the conversation tables for participants and leaders, so it
  lives in membership-management. Same rows can later be relayed to SQS/EventBridge unchanged.
- **No foreign keys** on events, so deleting a report doesn't cascade to them: a consumer that
  finds the comment or conversation gone marks the event `processed` with no deliveries.
- **Claim columns** (both generic tables): `status`, `attempts`, `next_attempt_at`, `claim_token`
  (uuid), `last_error` (short: status code or exception class, no PII). Statuses: events `pending
  | processing | processed | failed | dead | expired`; deliveries `pending | sending | sent | failed
  | dead | expired`. Each table has a partial index on `next_attempt_at` where status is pending,
  failed or in progress.

### Processing and sending

- **Comment transaction:** insert the comment and one `outbox_events` row (`next_attempt_at = now()
  + 60 s`, so the fast path has a head start). Nothing else, no calls.
- **Processing an event:** in one transaction, guarded by the claim token: run the consumer
  (recipients → preferences → throttle), insert the deliveries (`ON CONFLICT DO NOTHING`), mark the
  event `processed`. Failure (e.g. auth-server down) → the event retries; nothing is sent yet.
- **Sending a delivery:** `Sender.send(payload, idempotency key)`; 2xx → `sent`; 4xx → `dead`
  (permanent, logged); 5xx/timeout → `failed`. Each delivery retries on its own. The idempotency key
  is `mm:notification-delivery:{id}`; the payload never changes after insert, as Resend requires
  (same key + different payload = rejected).
- **Claiming** (both tables): `SELECT … FOR UPDATE SKIP LOCKED`, **batch of 10**, and in the same
  statement set the in-progress status, a new `claim_token`, **`attempts = attempts + 1`** (so a
  crash or hang still counts) and `next_attempt_at = now() + lease`. A row claimed with `attempts`
  already at 5 goes to `dead` instead of being worked.
- **Lease rule:** `lease > batch × per-item timeout + margin`. With a 5 s sender timeout, batch 10 and
  a 2-minute lease: 50 s + margin, fine. Changing either number means re-checking the rule.
- **Fenced final write:** every finishing update is `WHERE id = :id AND claim_token = :token`. Zero
  rows updated = the lease was lost and someone else owns the row: log and do nothing.
- **Backoff** after a failure: 1, 5, 15, 60 minutes, by `attempts`.
- **Expiry:** an event or delivery still not done **24 hours** after `created_at` becomes
  `expired` instead of being worked (no wave of old emails after an outage; 24 h is also how long
  Resend keeps idempotency keys).

### The worker

- **Its own entry point:** `python -m membership_management.worker` with `run_once()` (expire,
  process due events, send due deliveries, purge) and `run_forever()` (every **2 minutes**, random
  0–30 s start offset). The processing code imports nothing from FastAPI.
- **Embedded by default:** with `EMBEDDED_WORKER=true` (today's default, no extra Fargate task) the
  API's `lifespan` starts `run_forever()`, running its sync DB work with `anyio.to_thread`. Moving it
  to its own ECS service = `EMBEDDED_WORKER=false` on the API plus a task definition for the worker.
- **Fast path, best-effort:** the comment route adds a `BackgroundTasks` task that processes that one
  event and sends its deliveries right after the response, with its own DB session, through the
  same claim code (so it never races the sweeper). Nothing depends on it: without it, the sweep
  picks the event up within about 2 minutes. A separate worker can later be woken with
  `LISTEN/NOTIFY` instead.
- **Monitoring:** each run logs, and exposes for the Phase 9 alarms, the **age of the oldest
  pending row** in each table and the count of `dead` rows.
- **Retention:** `run_once()` purges `processed`/`expired` events after 30 days and
  `sent`/`dead`/`expired` deliveries after 90 days.

### Settings, language, switches

- **Opt-out**: "Conversation emails" in My profile = `notification_preferences` row
  `(user, report_conversation, email)`. Default on. Routes: `GET /me/notification-preferences` →
  `{ "conversationEmails": true, "emailsEnabled": false }`; `PUT` with `{ "conversationEmails":
  bool }`.
- **Watching** (rules 18–21): `GET /me/watched-groups` → each group in the caller's view with
  `watching`; `PUT /small-groups/{id}/watch` body `{ "watching": bool }` (deletes or inserts the
  opt-out). Both 403 outside the full-scope audience. My profile lists the groups with a Watching
  switch each; the group's page has the same switch.
- **Recipient language**: stored on the auth-server user (`locale`, `en` | `es`), set from the
  request at sign-in while empty and whenever the user picks a language in the account menu.
  Emails use it, falling back to English.
- **Push later** is another `channel` on deliveries and preferences, created from the same events
  (rule 22); `outbox_events` doesn't change.
- **Kill switch**: `CONVERSATION_EMAILS_ENABLED` (default `false`). Off = no event rows, nothing
  calls auth-server; the email and watch switches are hidden in the staff app.

## Changes to the Part 2 handoffs (Nov 2026)

The three Part 2 handoffs were written before this design. Apply these in each repo (one repo per
session, as usual) before that repo's Part 2 work starts, next to the section-thread changes from
`prayer-follow-up.md`:

- **auth-server** (`REPORT-CONVERSATIONS-EMAIL-HANDOFF.md`): replace
  `POST /internal/notifications/report-conversation` with the generic `POST /internal/notifications`
  (template key, per-template zod schema, 4xx for permanent errors, `idempotencyKey` passed to
  Resend). Add a stage for `GET /internal/users/with-permission` (several permissions, all must
  hold). Templates gain `reason = watcher` (its "why" line and unwatch hint) and a "new" variant for
  `startedBy = leaders` (the title can't say "An elder"). Copy en/es on the canvas first.
- **membership-management** (`REPORT-CONVERSATIONS-EMAIL-API-HANDOFF.md`): rework it around this
  section. Stage 1: config (`EMBEDDED_WORKER`), the five tables. Stage 2: the comment transaction
  inserts only the event; the report-conversations consumer (audience, recipients, preferences,
  atomic throttle). Stage 3: the auth-server client, both calls (`with-permission` and the
  `Sender`). Stage 4: claiming (batch, attempts at claim, claim token, fencing), processing and
  sending, the fast path. Stage 5: the worker entry point, embedded start, expiry, monitoring,
  purge. Stage 6: preference and watch routes. It depends on auth-server's new route stage as well
  as its sending stage. Hand-check list: a leader starts a thread → every watching elder gets one
  email; an elder who unwatched doesn't, unless they commented; **two leaders reply at the same
  moment → one email**; a leader who stepped down gets nothing; kill the worker mid-batch → no
  duplicate email and `attempts` went up; auth-server down → the event retries and the comment
  still saves; an event older than 24 h → `expired`.
- **staff-app** (`REPORT-CONVERSATIONS-EMAIL.md`): stage 1 adds the watched-groups list in My
  profile and the Watching switch on `/groups/[id]` (only for the full-scope audience and while
  emails are on); stage 2's panel note for leaders' side changes from "No email is sent" to "Elders
  watching this group get an email"; the *Decided* line "per user, not per group" becomes "per
  user, plus per group for watchers".
- **Canvas**: the Watching switch, the My profile list, the *Unread* tab with *Mark all read*, and
  the watcher email variants need boards before the staff-app and auth-server stages that use them.

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
