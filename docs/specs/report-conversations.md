# Report conversations (cross-repo spec)

Elders (and admins) can start a conversation about **one person's attendance row** in a small
group report; the group's leaders reply. This replaces the Google Sheets habit: the leader wrote an
observation per person, elders added a comment on that line, leaders replied. Conversations can be
resolved, and a cross-report **Conversations** inbox shows what is waiting for whom.

**Status:** Part 1 implemented and merged (October 2026); Part 2 (email) planned, **after**
`prayer-follow-up.md`, which adds section threads (rule 2) and lists what they change in Part 2.
*Update (Nov 2026):* Part 1b (an **Unread** inbox tab with *Mark all read*, rule 17), **watching
groups** (rules 18–23, elders and admins get emails for leaders' comments in the groups they watch)
and an **event-first, worker-based** Part 2 design were added before Part 2 started. The existing
Part 2 handoffs need the changes listed in
[Changes to the Part 2 handoffs](#changes-to-the-part-2-handoffs-nov-2026) before work begins.
*Update (Nov 5, 2026):* **Part 1b is implemented and merged** in both repos (membership-management
PR #67, migration `096025ed70a6`; staff-app PR #104).
*Update (Nov 5, 2026):* `prayer-follow-up.md` is **implemented and merged** too (late October
2026), so **Part 2 is next**. None of the three Part 2 handoffs has been updated yet: apply the
[Nov 2026 changes](#changes-to-the-part-2-handoffs-nov-2026) and `prayer-follow-up.md`'s
*Changes for report conversations Part 2* in each repo first, auth-server first.
*Update (Nov 5, 2026):* **Part 1c, an unread dot** on the sidebar's Conversations item (rule 17),
was decided before Part 2. It's in-app only and runs as usual (not learning mode), so it can ship
before or alongside Part 2.
*Update (Nov 5, 2026):* **Part 1c is implemented and merged** in both repos (membership-management
PR #69, no migration; staff-app PR #105).

- **Depends on:** `small-group-reports.md` (rule 9 as changed in Oct 2026: the group's leaders see
  observations), `small-group-leader-access.md` (scope), `roles-and-permissions.md`.
- **Design:** Staff App canvas, page **"Report conversations"**
  (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1). Its blue rules note matches this spec. The
  Report detail boards, Sidebar and both dashboards on other pages were updated too.
- **Repo handoffs (the work, stage by stage):** Part 1:
  `membership-management/docs/REPORT-CONVERSATIONS-API-HANDOFF.md`,
  `staff-app/docs/design/REPORT-CONVERSATIONS.md`. Part 1b (done):
  `membership-management/docs/UNREAD-TAB-API-HANDOFF.md`, `staff-app/docs/design/UNREAD-TAB.md`
  (branch `unread-tab`). Part 1c (done): `membership-management/docs/UNREAD-DOT-API-HANDOFF.md`,
  `staff-app/docs/design/UNREAD-DOT.md` (branch `unread-dot`). Part 2 (written once Part 1 is on
  `main`):
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

Part 1b, Unread tab (in-app only, runs as usual, not learning mode; can ship before Part 2).
**Done** (Nov 2026), both steps merged:
1b. `membership-management`: `tab=unread` on the inbox route and an `unread` tab count (filtered in
    SQL); `report_conversations.last_activity_at` (migration, backfilled); *Mark all read*.
2b. `staff-app`: the *Unread* tab on `/conversations` and its *Mark all read* action.

Part 1c, unread dot (in-app only, runs as usual, not learning mode; can ship before Part 2).
**Done** (Nov 2026), both steps merged:
1c. `membership-management`: `hasUnread` on `GET /report-conversations/counts` (rule 17).
2c. `staff-app`: the dot on the sidebar's Conversations item, shown only while the gold count is 0.

Part 2 (after Part 1 is on `main`):
3. `auth-server`: recipient language; templates (en/es) including the watcher variants; the generic
   `POST /internal/notifications` sending through Resend; `GET /internal/users/with-permission`
   and `POST /internal/users/permissions`.
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
   three sections, and shipped with it (late Oct 2026).

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
    you). The sidebar's gold **number** and the dashboard blocks stay *Needs my reply* only, so the
    number keeps meaning "someone is waiting on us".
    *Changed Nov 5, 2026 (Part 1c):* the sidebar's Conversations item also shows a small **unread
    dot**, light (`heading-on-dark`), never gold, with no number, when the caller has nothing
    waiting (`needsMyReply = 0`) but at least one thread unread (the same SQL as the *Unread* tab,
    over every thread in the caller's view, no group filter). When the gold number shows, the
    dot hides: one signal at a time. Screen readers hear "Conversations, unread activity"
    (es: "Conversaciones, actividad sin leer"); with the number, the existing "{count} waiting for
    your reply". The dashboard blocks don't change. Design: the Staff App canvas's `Sidebar` board
    (page "Shell components"), tweak `conversations = unread` (`waiting` is the gold number,
    `none` shows nothing). Option A of the options board
    (https://claude.ai/artifact/NCHsM9hBDWrFvq6Gc1RD9q). The filter and the count
    are SQL on `last_comment_user_id` / `last_comment_at` against the caller's read row (not the
    Python `is_unread` helper), so paging and counts agree.
    **Mark all read**: on launch, and whenever someone gains access (a new elder, a new leader),
    *Unread* lists every thread they never opened. *Mark all read* on the tab marks every thread in
    the caller's view (and the group filter, when one is set) read up to its latest activity:
    `last_read_at = greatest(existing, conversation.last_activity_at)`, not `now()`, so a comment
    that lands while the user is clicking stays unread.
    `last_activity_at` is the newest comment's `created_at` **counting deleted ones**: set on every
    new comment and never moved back. `last_comment_at` does move back when the newest comment is
    deleted (it points at the newest live one), so using it here would leave the read mark behind
    an email already sent about the deleted comment and keep the throttle (rule 20) closed.
    Reading past a deleted comment hides nothing: only live comments count as unread.

### Watching groups (Part 2, Nov 2026)

*Needs my reply* stays per side (rule 12): it's a shared queue, one answer is enough. Making sure
each elder still **hears about** what leaders write is the job of email, per person:

18. **Who watches:** the **full-scope observation audience**: users with `smallGroups: all` whom
    the shared read check (rule 23) lets read every group's conversations (today that also takes
    `smallGroups: view`, `smallGroupReports: view` and `viewObservations`; elders and admins).
    They watch **every group by default**, including groups created later and closed groups
    (rule 13). It comes from the permissions, not from stored rows:
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
    badge, the inbox and the *Unread* tab still show it. The throttle is per conversation, not per
    channel, so it also counts while your emails are off: after turning them back on, a thread
    that was already unread may not email you, and it still shows in *Unread*.
21. **Unwatching is per group**, from the group's page or the list in My profile. Only the
    opt-outs are stored. Unwatching a group doesn't stop **participant** emails for threads you've
    commented in, and it changes nothing in the app (inbox, badge, dashboards). The global
    "Conversation emails" switch wins over everything: off means no conversation emails, including
    ones already queued (checked again right before each send). Unwatching, like losing access
    (rule 23), applies to emails planned after the change; one already queued still goes out.
22. **Channel-neutral:** the setting is "watch this group", not "email me about this group", so
    push notifications (later) follow the same rule without a second set of preferences.
23. **Every email goes to someone who can open it.** Whatever the reason (leader, participant,
    watcher), a recipient must be in the conversation's **current** audience (rule 3) when the email
    is planned, decided by **the same function the API uses** to let them read it (no second copy
    of the rule). A leader who stepped down, a leader whose role lost `smallGroupReports: view`, or
    an elder whose role changed stops getting emails about conversations they commented in, as they
    stop seeing them. Leaders reach conversations through their scope, not through
    `viewObservations`, and keep getting their emails.

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
Part 1b adds `last_activity_at` (rule 17): like `last_comment_at`, but deletes never move it back.

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
| `GET /report-conversations/counts` | `{ needsMyReply, hasUnread }` for the sidebar badge and dot (cheap, called per page; `hasUnread` is an `EXISTS` over the *Unread* filter, not a count; added in Part 1c, rule 17) |
| `POST /report-conversations/read-all?smallGroupId=` | Part 1b, rule 17: mark every thread in the caller's view (and filter) read; one upsert, returns `{ marked }` |

Errors the staff app tells apart (status + `detail`, never shown raw): 409 `Link your account`
(rule 5), 422 `attendance` (member not on that report), 403 `not your comment`.

### staff-app

- Report detail: Conversation column (desktop/tablet) and a bubble on each card (phone); summary
  above the table; panel at `/groups/reports/[id]?person=[memberId]` (side panel ≥ 1024, bottom
  sheet below). Same panel for 0 or N comments.
- `/conversations`: the inbox, a top-level nav item visible when the user can see observations or
  leads a group; badge from `/report-conversations/counts`: the gold `needsMyReply` number, or,
  when it's 0, the unread dot from `hasUnread` (Part 1c, rule 17).
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
│        ▲ watcher list (per sweep) ◄──────────────────────────────────────────┼──── GET /internal/users/with-permission
│        ▲ candidates' permissions (per batch) ◄───────────────────────────────┼──── POST /internal/users/permissions
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
  "report-conversation.new" | "report-conversation.reply", "data": { … }, "path": "…" }`.
  `path` is the thread's deep link, one of `/groups/reports/{id}?person={memberId}` (a member's
  row), `?guest={guestId}` (a guest's row, `guest-small-groups.md`) or `?section={key}` (a
  section, `prayer-follow-up.md`); auth-server accepts only those three shapes.
  `data` for both report-conversation templates: `actorName`, `groupName`, `meetingDate`,
  `reason` (`leader` | `participant` | `watcher`), `topic` (`person` for a member or a guest row |
  `prayer` | `praise` | `followUp`), `startedBy` (`elders` | `leaders`, for the "new" title).
  auth-server **validates `data` against a schema per template** (a zod union keyed on
  `template`), looks up the recipient's email and language, renders, sends, and passes
  `idempotencyKey` to Resend.
  **Rendered once per key.** Before its first call to Resend, auth-server stores what it is about to
  send under the idempotency key (table `notification_sends`: `idempotency_key` PK, the resolved
  address, locale, the exact Resend request body, `resend_email_id`, `status`, `created_at`). A
  retry with the same key reuses that stored request byte for byte, instead of looking up the email
  and locale and rendering again. Otherwise a change of address, language or template between two
  attempts would reuse the key with different content, which Resend rejects. If the stored row is
  already `sent`, auth-server returns 2xx without calling Resend. Rows are purged after 48 h, longer
  than Resend keeps keys (24 h) and than a delivery lives (rule: *Expiry*). A retry within that time
  goes to the address resolved on the first attempt; that's the accepted trade-off. Errors carry a body `{ "code": "…", "message": "…" }`, so a version
  mismatch between the services is visible in logs. **Status codes, exactly** (both sides agree on
  this list):

  | Code | Meaning | Sender does |
  | --- | --- | --- |
  | 2xx | sent | `sent` |
  | 410, or 404 `recipient_unavailable` | recipient gone (unknown, banned, deactivated) | `dead` |
  | 409 `idempotency_conflict` | same key, different payload: a bug | `dead`, error logged |
  | 422 `unknown_template` / `invalid_data` | the services disagree on a template | `dead`, error logged |
  | 404 without that code | route missing (deploy order, wrong base URL) | transient; error + alarm |
  | 401, 403 | token wrong (rotation, bad config) | transient; error + alarm |
  | 408, 429, 5xx, timeout, connection error | transient | transient (see *Failures and retries*) |
- **`GET /internal/users/with-permission?permission=…&permission=…`** (same token) →
  `{ "userIds": [...] }`: users holding **all** the listed permissions, computed from
  `statements.ts`, never from role names; banned or deactivated users left out. Used only to find
  **possible watchers**: `?permission=smallGroups:all`, a superset. Who among them really watches
  is decided by the shared check (rule 23), not by this query, so the rule has one copy.
- **`POST /internal/users/permissions`** (same token) body `{ "userIds": [...] }` (up to 500) →
  `{ "users": { "u_abc": <perms> } }`, `<perms>` in the same shape as the JWT's `perms`. Unknown,
  banned or deactivated users are absent. Used to run the API's own read check on each candidate
  recipient (rule 23).
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
- **A soft-deleted comment** (`deleted_at` set by the time the event is processed) gives no
  emails: the event is marked `processed` with no deliveries, as when the comment or conversation
  is gone.
- **Current audience only (rule 23), one copy of the rule.** `access.py` gets two pure functions,
  built from the existing code and used by the API and the worker alike:
  - `small_group_scope_for(perms, led_group_ids, member_id)`: today's `_small_group_scope` without
    the claims and the DB (`None` without `smallGroups: view`; full with `smallGroups: all`;
    otherwise the groups the member leads, or led when the group closed).
  - `can_read_group_conversations(perms, scope, small_group_id)`: `smallGroupReports: view`; a full
    scope needs `viewObservations`; a scoped user needs the group in their scope.

  `get_small_group_scope`, `conversation_access` and `conversation_group_ids` call them. The worker
  gets every candidate's `perms` from `POST /internal/users/permissions`, builds their scope from
  `members.user_id` the way the API does, and keeps only those the second function accepts.
  **Watchers go through the same check:** the possible watchers (`with-permission`, superset) join
  the same permissions batch, and only those accepted for the group watch it.
- **Candidate snapshot, no call inside a DB transaction.** For a batch of claimed events the worker
  reads each event's candidates (read-only), looks up all of their permissions (in chunks of at
  most 500 ids, the route's limit, merged before any event is processed; if any chunk fails, the
  whole lookup is a transient failure and no event in the batch is processed on partial data),
  then processes each event in its own transaction using **exactly that candidate set**: nobody is
  added inside the transaction, and a user missing from the permissions response counts as "can't
  read". Someone who comments in between is covered by their own comment's event. The
  possible-watcher list is fetched once per sweep, before any claim. The fast path does the same
  for its one event.
- De-duplicate by user id; the reason that wins is `participant`, then `leader`, then `watcher`.
  Never the author. A watcher who unwatched the group is dropped as a watcher only (rule 21).
- **The boundary runs one way:** the conversation code never asks about channel preferences. It
  hands every recipient that survives its rules (audience, unwatch, throttle) to `notifications/`,
  which drops those whose preference for the category and channel is off as it inserts deliveries.
  Today both run in the same process and transaction; if `notifications/` becomes its own service,
  the hand-over becomes an outbox row too, never a network call inside the transaction.
- **Throttle, atomic** (rule 20), in the same transaction that inserts the deliveries. Domain table
  `report_conversation_notify_state`: PK `(user_id, conversation_id)` (FK cascade to the
  conversation), `last_notified_at`. **One statement for all of an event's recipients, sorted by
  `user_id`**, so two events in the same conversation always lock rows in the same order and can't
  deadlock:
  ```sql
  INSERT INTO report_conversation_notify_state AS s (user_id, conversation_id, last_notified_at)
  SELECT u, :conversation_id, :occurred_at
  FROM unnest(CAST(:user_ids AS varchar[])) AS u
  WHERE coalesce((SELECT r.last_read_at FROM report_conversation_reads r
                  WHERE r.user_id = u AND r.conversation_id = :conversation_id),
                 '-infinity') < :occurred_at
  ORDER BY u
  ON CONFLICT (user_id, conversation_id) DO UPDATE SET last_notified_at = excluded.last_notified_at
  WHERE s.last_notified_at
        <= coalesce((SELECT r.last_read_at FROM report_conversation_reads r
                     WHERE r.user_id = s.user_id AND r.conversation_id = s.conversation_id),
                    '-infinity')
  RETURNING user_id;
  ```
  Only users it returns get a delivery.
  - **Stamped with the comment's time, not the worker's clock.** `:occurred_at` is the event's
    `occurredAt`, which is exactly the comment's `created_at` (the value also written to
    `last_comment_at`). So opening the thread, or *Mark all read* (which sets `last_read_at` to
    `last_comment_at`, rule 17), always lifts the throttle. With the worker's clock it was always
    later than any comment time, and *Mark all read* never lifted it.
  - **Already read → no email.** The first `WHERE` skips anyone whose `last_read_at` is at or after
    the comment: they saw it in the app before the worker ran (the 60 s head start, an outage).
  - **Concurrency and order:** Postgres re-checks the conflict `WHERE` against the latest locked
    row, so two events processed at the same moment give one email. Out of order (a later
    comment's event first) the stamp can't go backwards: the earlier event then either finds the
    throttle held, or the user read after the later comment and the first `WHERE` skips them.
  - **Accepted edge:** a read that lands while the comment's transaction is still committing counts
    as having read it. That's the same rule the in-app unread flag uses (rule 11).
  - The throttle doesn't read deliveries, so purging them can't change it.

### Tables (membership-management)

| Table | Side | Columns |
| --- | --- | --- |
| `outbox_events` | generic | `id`, `event_type` (`report_conversation.comment_added`), `schema_version`, `aggregate_type` (`report_conversation`), `aggregate_id`, `payload` JSONB, claim columns, `created_at`, `processed_at`. **No foreign keys.** |
| `notification_deliveries` | generic | `id`, `source_event_id` (**no FK**: events are purged after 30 days, deliveries kept 90), `recipient_user_id NOT NULL`, `category` (`report_conversation`), `channel` (`email`), `template`, `payload` JSONB (exactly what the `Sender` sends), claim columns, `created_at`, `sent_at` · **unique `(source_event_id, recipient_user_id, channel)`** |
| `notification_preferences` | generic | PK `(user_id, category, channel)`, `enabled`, `updated_at`. No row = enabled |
| `report_conversation_notify_state` | domain | above (throttle) |
| `small_group_watch_opt_outs` | domain | PK `(user_id, small_group_id)` (FK cascade to the group), `created_at`. No row = watching |

- **Event payload** (version 1): `conversationId`, `commentId`, `side`, `authorUserId`,
  `startsThread`, `occurredAt` (= the comment's `created_at`, exactly). Ids and facts only, never
  comment text. The event identifies itself; the consumer still reads the conversation tables for
  participants and leaders, so it lives in membership-management. Same rows can later be relayed
  to SQS/EventBridge unchanged.
- **No foreign keys** on events, so deleting a report doesn't cascade to them: a consumer that
  finds the comment or conversation gone marks the event `processed` with no deliveries.
- **Claim columns** (both generic tables): `status`, `attempts` (claims that ended in a crash,
  hang or exception: the poison counter), `failures` (recorded failures of any kind: drives the
  backoff), `next_attempt_at`, `claim_token` (uuid), `expires_at` (see *Expiry*), `last_error`
  (short: status code, error `code` or exception class, no PII). Statuses: events `pending
  | processing | processed | failed | dead | expired`; deliveries `pending | sending | sent | failed
  | dead | expired | suppressed`. Each table has a partial index on `next_attempt_at` where status is pending,
  failed or in progress.

### Processing and sending

- **Comment transaction:** insert the comment and one `outbox_events` row (`next_attempt_at = now()
  + 60 s`, so the fast path has a head start). Nothing else, no calls.
- **Dependencies first, then claim.** A sweep fetches the possible-watcher list **before** claiming
  anything. If auth-server can't be reached, it claims nothing from **either** table this sweep.
- **Processing an event**, one transaction whose **first statement is the fence**:
  ```sql
  UPDATE outbox_events SET status = 'processed', processed_at = now()
  WHERE id = :id AND claim_token = :token
  RETURNING id;
  ```
  No row back = the lease was lost: roll back and stop. A row back also locks the event, so no
  other task can work it while this transaction runs. Then: the consumer (soft-delete check,
  recipients, audience, unwatch, throttle), then `notifications/` (preferences, insert deliveries
  `ON CONFLICT DO NOTHING`), then commit. Any error rolls back everything, throttle rows included,
  fence update included. **The outcome is then recorded in a second short transaction**, fenced by
  the claim token: `status = 'failed'`, `last_error`, `failures + 1`, `next_attempt_at` from the
  backoff. The attempt stays counted: an exception here is a bug or a DB error, not an outage
  (the permissions call ran before the transaction; if *it* fails, that's a transient failure).
- **Sending a delivery:** first re-check the recipient's preference for the delivery's `category`
  and `channel` (a local lookup inside `notifications/`). If it's off now, the delivery ends
  `suppressed` (final, not counted as a failure) and nothing is sent; the conversation's throttle
  row is left as is (rule 20's trade-off). Otherwise `Sender.send(payload, idempotency key)`, then
  act on the status code table above. The idempotency key is `mm:notification-delivery:{id}`; the
  payload never changes after insert, as Resend requires (same key + different payload =
  rejected).
- **Claiming** (both tables): `SELECT … FOR UPDATE SKIP LOCKED`, **batch of 10**, and in the same
  statement set the in-progress status, a new `claim_token`, **`attempts = attempts + 1`** (so a
  crash or hang still counts) and `next_attempt_at = now() + lease`. A row claimed with `attempts`
  already at 5 goes to `dead` instead of being worked.
- **Failures and retries.** Three kinds of outcome:
  - **Transient** (dependency trouble: connection error, timeout, 5xx, 408, 429, 401/403, a bare
    404, or the permissions call failing): **give the attempt back** (`attempts - 1`), `failures +
    1`, `status = 'failed'`, backoff by `failures`. Transient failures never make a row `dead`; they
    retry until the 24 h expiry. A transient error while sending also **stops the batch**: the
    untried rows are released (fenced, `status = 'pending'`, `attempts - 1`, `next_attempt_at`
    unchanged).
  - **Exception** (a bug or a DB error in our code): `failures + 1`, attempt kept, backoff by
    `failures`.
  - **Permanent** (the `dead` codes in the table): `dead` at once.
  - So `dead` = a permanent code, or the poison cap (5 claims that crashed, hung or raised).
    `expired` = still not done after 24 h, e.g. an outage longer than that.
- **Lease rule:** `lease > batch × per-item timeout + margin`. With a 5 s sender timeout, batch 10
  and a 2-minute lease: 50 s + margin, fine. Changing either number means re-checking the rule.
- **Fenced writes:** every update after a claim (finish, fail, release) is `WHERE id = :id AND
  claim_token = :token`. Zero rows updated = the lease was lost and someone else owns the row: log
  it and undo nothing else. For events this is the first statement of the processing transaction
  (above), so a lost lease rolls back the whole transaction.
- **Backoff** by `failures`: 1, 5, 15, 60 minutes, then every 60 minutes until the expiry.
- **Expiry: one deadline per comment, 24 hours.** An event gets `expires_at = created_at + 24 h`.
  Its deliveries **inherit that same `expires_at`** (the domain passes it to `notifications/` as a
  "not after" time with each request), so the window doesn't restart when deliveries are created:
  an event processed just before its deadline can't produce an email about a comment almost 48 h
  old. An event or delivery past its `expires_at` becomes `expired` instead of being worked, checked
  at claim and again right before sending (no wave of old emails after an outage). Every send
  happens within 24 h of the delivery's first send, so it stays inside Resend's 24 h idempotency
  window.

### The worker

- **Its own entry point:** `python -m membership_management.worker` with `run_once()` (expire,
  process due events, send due deliveries, purge) and `run_forever()` (every **2 minutes**, random
  0–30 s start offset). The processing code imports nothing from FastAPI.
- **Embedded by default:** with `EMBEDDED_WORKER=true` (today's default, no extra Fargate task) the
  API's `lifespan` starts `run_forever()`, running its sync DB work with `anyio.to_thread` through
  its **own `anyio.CapacityLimiter(1)`**, so it never takes more than one thread from the API's
  pool. Moving it to its own ECS service = `EMBEDDED_WORKER=false` on the API plus a task
  definition for the worker.
- **Shutdown:** on SIGTERM (or the API's shutdown when embedded) the worker stops claiming and
  finishes or abandons the item in hand; the leases cover anything in flight.
- **Fast path, best-effort:** the comment route adds a `BackgroundTasks` task that processes that one
  event and sends its deliveries right after the response, with its own DB session, through the
  same claim code (so it never races the sweeper). Nothing depends on it: without it, the sweep
  picks the event up within about 2 minutes. It has no sweep cache: it fetches the possible-watcher
  list before claiming its one event, and that event's candidates' permissions before processing
  it. A separate worker can later be woken with `LISTEN/NOTIFY` instead.
- **Monitoring:** each run logs, and exposes for the Phase 9 alarms, the **age of the oldest
  pending row** in each table and the count of `dead` rows.
- **Retention:** `run_once()` purges `processed`/`expired`/`dead` events after 30 days and
  `sent`/`dead`/`expired`/`suppressed` deliveries after 90 days. Every final status is purged, so no
  row stays forever; `dead` rows are counted and logged when they appear (*Monitoring*), which is
  when someone looks at them.

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
  (template key, per-template zod schema, the exact status-code table with error `code`s,
  `idempotencyKey` passed to Resend), plus the `notification_sends` table so each key is rendered
  once and retries resend the stored request. Add a stage for the two user routes:
  `GET /internal/users/with-permission` (several permissions, all must hold) and
  `POST /internal/users/permissions` (perms per user, JWT shape). Accept `?guest=` paths as well as
  `?person=` and `?section=`. Templates gain `reason = watcher` (its "why" line and unwatch hint)
  and a "new" variant for `startedBy = leaders` (the title can't say "An elder"). Copy en/es on the
  canvas first.
- **membership-management** (`REPORT-CONVERSATIONS-EMAIL-API-HANDOFF.md`): rework it around this
  section. Stage 1: config (`EMBEDDED_WORKER`), the five tables (claim columns with `attempts` and
  `failures`). Stage 2: extract `small_group_scope_for` and `can_read_group_conversations` in
  `access.py` and make `get_small_group_scope`, `conversation_access` and
  `conversation_group_ids` call them (behaviour unchanged, Part 1 routes re-tested); the comment
  transaction inserts only the event; the report-conversations consumer (soft-delete check, the
  pinned candidate snapshot, audience and watchers through the shared check, recipients, unwatch,
  the throttle stamped with `occurredAt`) and `notifications/` (preferences, deliveries), one way
  only. `path` uses `?person=`, `?guest=` or `?section=` by the thread's anchor. Stage 3: the
  auth-server client, all three calls (`with-permission`, `permissions`, the `Sender`), mapping the
  status-code table and error `code`s. Stage 4: claiming (batch, attempts at claim, claim token),
  the fence as the first statement of event processing, recording a failed processing outcome in
  a second transaction, sending, the three outcome kinds (transient gives the attempt back),
  releasing untried rows, the fast path. Stage 5: the worker entry point, embedded start with its
  `CapacityLimiter`, SIGTERM, the reachability gate before claiming either table, expiry,
  monitoring, purge. Stage 6: preference and watch routes. It depends on auth-server's new route
  stages as well as its sending stage. Hand-check list: **an elder starts a thread → the group's
  leader gets the email** (the main case); a leader starts a thread → every watching elder gets one
  email; an elder who unwatched doesn't, unless they commented; **two leaders reply at the same
  moment → one email**; a leader who stepped down, or whose role lost `smallGroupReports: view`,
  gets nothing; a comment deleted before processing → no email; **the user opens the thread
  before the worker runs → no email**; **after *Mark all read*, the next leader comment → an
  email**; the same after the newest comment (the one emailed about) was deleted before *Mark all
  read*; an email link to a guest's row opens that guest's panel; kill the worker mid-batch → no
  duplicate email and `attempts` went up; **auth-server down for 2 hours → nothing goes `dead`, and
  everything sends once it's back**; auth-server up but Resend returning 503 for 2 hours → the
  same; a wrong internal token, or the route not deployed yet (bare 404) → retries, an error
  logged, nothing `dead`; an email queued, then "Conversation emails" turned off before it sends →
  `suppressed`, no email; a batch with more than 500 candidates → permissions fetched in chunks,
  nobody dropped; a processing exception → `failed` with `last_error` set; an event older
  than 24 h → `expired`; an event processed 23 h after its comment whose send then keeps failing →
  the delivery expires at the comment's 24 h mark, not 24 h later.
- **staff-app** (`REPORT-CONVERSATIONS-EMAIL.md`): stage 1 adds the watched-groups list in My
  profile and the Watching switch on `/groups/[id]` (only for the full-scope audience and while
  emails are on); stage 2's panel note for leaders' side changes from "No email is sent" to "Elders
  watching this group get an email"; the *Decided* line "per user, not per group" becomes "per
  user, plus per group for watchers"; stage 3 (sign-in return and the phone panel) keeps `?guest=`
  as it keeps `?person=` and `?section=`.
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

- Threads on report sections (rule 2): shipped separately in `prayer-follow-up.md`.
- Member detail conversation history across reports (v2).
- Push notifications through the PWA (v2; the outbox is where they'd plug in).
- @mentions, attachments, reactions.
- Daily or weekly email digests.
- Moderation: admins deleting or hiding someone else's comment (rule 9 is own comments only).
