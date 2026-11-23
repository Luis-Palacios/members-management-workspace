# Notifications: in-app list and Web Push (cross-repo spec)

Every notification the app already emails (conversation comments, submitted reports, weekly report
reminders) also becomes an **entry in an in-app list**. The list has a bell in the top bar, a
`/notifications` page and a count on the installed app's icon. It can also be **pushed** to the
devices where someone turned notifications on: desktop browsers, Android, and iPhone or iPad when
the app is installed to the Home Screen. Email alone is easy to miss, and a push alone is lost once
it's swiped away. A stored list is the industry norm: one notification record per person, delivered
on as many channels as they chose.

**Status:** drafted (Nov 23, 2026). Nothing built yet.

- **Depends on:** `report-conversations.md` (Part 2: outbox, worker, `notifications/`, rules 18–23),
  `report-submitted-emails.md`, `report-reminder-emails.md`. All three are done and merged.
- **Two parts, shipped separately.** Part 1 (in-app list, bell, badge) needs no new infrastructure
  and works on every device. Part 2 (Web Push) adds the service worker, the subscriptions and VAPID
  keys, and it delivers into what Part 1 built.
- **Repo handoffs.** Part 1: `membership-management/docs/NOTIFICATIONS-API-HANDOFF.md`,
  `staff-app/docs/design/NOTIFICATIONS.md`. Part 2: `auth-server/docs/PUSH-NOTIFICATIONS-HANDOFF.md`,
  `membership-management/docs/PUSH-NOTIFICATIONS-API-HANDOFF.md`,
  `staff-app/docs/design/PUSH-NOTIFICATIONS.md`.
- **Branch name in every repo:** Part 1 `feature/notifications`, Part 2 `feature/notifications-push`.
- **Permissions:** none new. Who gets a notification is decided by the rules that already decide
  who gets the email (rule 5).
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), new page
  **"Notifications"**, drawn **before** each part's staff-app step. Part 1 boards: the top bar with
  the bell (no unread, a count, 99+) at 1440/1024/390, the popover, the `/notifications` page (list,
  empty) and the `Sidebar`/top bar at 390 with everything that has to fit. Part 2 boards: the
  Notifications card in My profile as an email/push grid, and the *This device* row in each of its
  states (rule 22).
- **Part 2 is a learning exercise** in all three repos, as report conversations Part 2 was: one code
  change at a time, explained, and Luis decides per change whether he writes it (Claude reviews) or
  Claude writes it. Part 1 runs as usual.

## Implementation order

Part 1 (in-app):
1. `membership-management`: the `user_notifications` table and migration; the three consumers write
   entries; list, count and read routes; auto-read (rules 13–14); purge; the
   `IN_APP_NOTIFICATIONS_ENABLED` flag.
2. `staff-app` (after step 1 is merged and the Part 1 canvas boards exist): the bell, the popover,
   `/notifications`, `/notifications/open/[id]`, and the app badge from the page.

Part 2 (push, learning mode):
3. `auth-server`: VAPID config, `push_subscriptions` and `push_sends`, the subscription routes, push
   copy for the three templates, `channel: "push"` on `POST /internal/notifications`, the fan-out
   and cleanup.
4. `membership-management`: `push` deliveries from the three consumers, the
   `PUSH_NOTIFICATIONS_ENABLED` flag, and push switches in the preferences routes.
5. `staff-app` (after steps 3 and 4 are merged and the Part 2 boards exist): the service worker, the
   *This device* row, the email/push grid, sign-out cleanup, and the badge from the service worker.

**Steps 3 and 4 can run in parallel**: this spec fixes the contract between them (the envelope's
`channel`, `notificationId` and `badgeCount`, the push copy's inputs, and the response codes).
Steps 1 → 2 and 3, 4 → 5 are sequential: staff-app builds on the real API types.

**Deploy (Part 2):** the VAPID keys in SSM for auth-server (`management-infra`), then auth-server,
then membership-management, then staff-app. Only then turn on `PUSH_NOTIFICATIONS_ENABLED`.

## Rules (decided, don't reopen)

### Shape

1. **One record, several channels.** Each person an event concerns gets **one in-app entry**,
   plus an email and a push delivery when those are on for them. In-app is the record. Email and
   push are ways of hearing about it.
2. **In-app has no switch.** Everyone the event concerns gets the entry. The switches in My profile
   control **email** and **push**, per kind. Turning a kind off on both still leaves it in the list.
3. **The kind's existing flag gates every channel.** `CONVERSATION_EMAILS_ENABLED`,
   `REPORT_SUBMITTED_EMAILS_ENABLED` and `REPORT_REMINDER_EMAILS_ENABLED` keep deciding whether a
   kind's events are written at all, so a kind that is off sends nothing anywhere. Two new channel
   flags sit next to them: `IN_APP_NOTIFICATIONS_ENABLED` and `PUSH_NOTIFICATIONS_ENABLED`. Both
   default off and can be turned on in production separately. A channel works for a kind only when
   both flags are on. The `*_EMAILS_` names are now a misnomer. They are kept, to avoid touching
   three deployed configs, and renaming them is under *Later*.
4. **Self-hosted Web Push with VAPID** (RFC 8030/8291/8292, the `web-push` npm package), not FCM or a
   hosted service. A native app later would add FCM/APNs as another channel.

### Who gets what

5. **The same recipients as the email, for every channel.** Each consumer decides recipients once
   per event: audience check (conversations rule 23), Watching and unwatching (rules 18–21), the
   conversation throttle (rule 20), "never the submitter" (submitted rule 6), reminder eligibility
   (reminder rules 9–11). In-app, email and push all follow that one decision, and only then are
   the email and push preferences applied. So the throttle holds everywhere: one entry, email and
   push per conversation until you open it.
6. **No new events.** Only the three existing kinds. New kinds are their own specs.
7. **Watching covers in-app too** (conversations rule 22, channel-neutral). Unwatching a group
   removes its conversation and submitted-report entries along with the emails and pushes. While
   `IN_APP_NOTIFICATIONS_ENABLED` is on, the Watching switches are never disabled. With it off, the
   current rule applies, extended to push: they are disabled only when every email and push switch
   that Watching covers is off.

### Privacy

8. **The lock-screen rule is the email rule.** Push text and list entries carry only what the
   emails' `data` already carries: actor and submitter names, group names, dates, counts, topics.
   No comment text, report text, not-held reason, or name of the person a conversation is about.
   Push payloads are encrypted end to end (RFC 8291), but they show on lock screens.
9. **A device stops receiving pushes for an account once that account is signed out there.**
   staff-app deletes that browser's subscription before signing out (rule 23). A ban deletes all the
   user's subscriptions. A subscription registered while another user is signed in **moves** to
   that user (upsert by endpoint).
10. **auth-server only ever sends to known push services.** Subscription endpoints must be `https`
    on one of these hosts: `fcm.googleapis.com`, `*.push.services.mozilla.com`,
    `*.notify.windows.com`, `web.push.apple.com`, `*.push.apple.com`. Anything else is 422. That
    keeps the fan-out from being used to make auth-server call arbitrary URLs. At most 10
    subscriptions per user: registering an 11th deletes the one least recently used.

### The list

11. **Bell in the top bar**, between the search and the account menu, for every signed-in user while
    in-app is on. It's a gold count of unread entries (1–99, then "99+") and shows nothing at 0. At
    ≥ 1024 px a click opens a popover with the latest 10 entries, *Mark all read* and *See all*.
    Below 1024 px it goes straight to `/notifications`. Opening the popover doesn't mark anything
    read. The count refreshes on navigation and window focus, like the Conversations badge.
    Screen readers hear "Notifications, {count} unread" (es: "Notificaciones, {count} sin leer"), or
    "Notifications" at 0.
12. **`/notifications`**: newest first, grouped by *Today*, *Yesterday* and then the date. Unread
    entries are marked. It has *Show more* (cursor paging), *Mark all read* and an empty state. Each
    entry shows a title, a secondary line, a relative time and the kind's icon, and opens through
    `/notifications/open/{id}` (rule 15).
13. **Read state:** opening an entry marks it read, and *Mark all read* marks every unread entry
    read. **Opening a conversation thread** (`POST /report-conversations/{id}/read`, and *Mark all
    read* on the Conversations inbox for the threads it covers) also marks that thread's entries
    read, so nothing is read twice.
14. **A reminder clears itself.** When a report is submitted, any reminder entry for that church
    week whose groups have now all submitted is marked read, in the submit transaction.
15. **One opening path.** `/notifications/open/{id}` (a staff-app route handler) marks the entry read
    and redirects to its `path`. The list, the popover and a clicked push all use it. Links to it
    use `prefetch={false}`. An entry that isn't the caller's, or no longer exists, redirects to
    `/notifications`.
16. **Kept 90 days**, like deliveries, then purged by the worker's maintenance. The count only
    covers what is kept.
17. **The app icon badge** (Badging API) shows the unread count on installed apps where the
    platform supports it. The page sets it whenever it loads the count, and clears it at 0. From
    Part 2 the service worker also sets it from each push's `badgeCount`. Where the API isn't
    available, nothing happens.
18. **The Conversations badge stays.** The sidebar's gold *Needs my reply* number is a work queue,
    and the bell is "what happened". Both can show at once, accepted.

### Push

19. **Opt in per device, then everything is on by default.** Nothing asks for permission on page
    load. The browser's prompt only appears after a tap on *Turn on notifications on this device*
    (iOS requires that gesture anyway). Once a device is on, it gets every kind whose **push**
    switch is on, and push switches default on (no row = enabled, as for email).
20. **One push per delivery, to every device.** auth-server sends the delivery to each of the
    user's subscriptions. A device that already got it isn't sent it again on a retry
    (`push_sends`). The notification's `tag` is the idempotency key, so a duplicate replaces the
    one already shown instead of stacking. A push lives 24 h at the push service (`TTL`).
21. **No caching service worker.** `sw.js` handles `push` and `notificationclick` only. It doesn't
    cache pages or API responses: signed-in pastoral data must never be served from a cache. Offline
    support is under *Later*.
22. **The *This device* row** in My profile's Notifications card, one state at a time:
    - **Not supported** (no `PushManager`/`serviceWorker`): "This browser can't show notifications."
    - **iPhone or iPad, not installed** (iOS/iPadOS Safari, not `display-mode: standalone`): the
      install hint (copy below) instead of the button.
    - **Not asked yet**: the *Turn on notifications on this device* button.
    - **On** (permission granted and a subscription registered with auth-server): "On for this
      device" with *Turn off*.
    - **Blocked** (permission denied): "Notifications are blocked for this site. Allow them in your
      browser or device settings, then come back."
    - The row is hidden while push is off at the server.
23. **Sign-out unsubscribes first.** Every sign-out in staff-app (account menu, needs-role page)
    deletes the current subscription at auth-server and calls `subscription.unsubscribe()` before
    `authClient.signOut()`. If either fails, the sign-out still goes ahead.
24. **The email/push grid.** The card's switches become a grid with one row per kind and columns
    *Email* and *Push*. Each row is shown under the rules each kind already has (who sees which
    switch). Each column is hidden while its channel is off at the server for that kind. Push
    switches work whether or not *this* device is on, because they cover all the user's devices.

## Copy (en / es)

The list (staff-app) and the push (auth-server, title + body) use the **same strings**: the push
title is the entry's title and the push body is its secondary line. The OS shows the app's name.
`{date}` is the meeting date and `{weekStart}` the week's Sunday, both formatted per locale as in the
emails.

| Entry | Title (en) | Title (es) | Secondary line (en) | Secondary line (es) |
| --- | --- | --- | --- | --- |
| Conversation, new, person row | {actor} started a conversation about someone | {actor} inició una conversación sobre una persona | {group} · report for {date} | {group} · reporte del {date} |
| Conversation, new, section | {actor} commented on the {section} | {actor} comentó en {section} | {group} · report for {date} | {group} · reporte del {date} |
| Conversation, reply | {actor} replied in a conversation | {actor} respondió en una conversación | {group} · report for {date} | {group} · reporte del {date} |
| Submitted, held | {group} submitted its report | {group} envió su reporte | {date} · {attended} of {people} attended · by {submitter} | {date} · Asistieron {attended} de {people} · por {submitter} |
| Submitted, didn't meet | {group} didn’t meet | {group} no se reunió | {date} · reported by {submitter} | {date} · reportado por {submitter} |
| Reminder, one group | Time to submit the {group} report | Es momento de enviar el reporte de {group} | Week of {weekStart} | Semana del {weekStart} |
| Reminder, one group, draft | Your {group} report is still a draft | El reporte de {group} sigue en borrador | Week of {weekStart} | Semana del {weekStart} |
| Reminder, several groups | Time to submit {count} small group reports | Es momento de enviar {count} reportes de grupos pequeños | Week of {weekStart} | Semana del {weekStart} |

`{section}` uses the emails' section names: *prayer requests* / *las peticiones de oración*,
*praise reports* / *los motivos de alabanza*, *items for the elders to follow up* / *los puntos para
seguimiento de los ancianos*.

The rest of the UI:

| Key | en | es |
| --- | --- | --- |
| Bell label | Notifications | Notificaciones |
| Page title | Notifications | Notificaciones |
| Mark all read | Mark all read | Marcar todo como leído |
| See all | See all | Ver todas |
| Show more | Show more | Ver más |
| Today / Yesterday | Today / Yesterday | Hoy / Ayer |
| Empty | You’re all caught up. New activity on reports and conversations will show here. | Estás al día. La actividad nueva en reportes y conversaciones aparecerá aquí. |
| Grid columns | Email · Push | Correo · Push |
| Device row label | This device | Este dispositivo |
| Turn on | Turn on notifications on this device | Activar notificaciones en este dispositivo |
| On | On for this device | Activadas en este dispositivo |
| Turn off | Turn off | Desactivar |
| Not supported | This browser can’t show notifications. | Este navegador no puede mostrar notificaciones. |
| Blocked | Notifications are blocked for this site. Allow them in your browser or device settings, then come back. | Las notificaciones están bloqueadas para este sitio. Permítelas en la configuración de tu navegador o dispositivo y vuelve aquí. |
| iOS install hint | To get notifications on this iPhone or iPad, add the app to your Home Screen: tap Share, then Add to Home Screen, and open it from there. | Para recibir notificaciones en este iPhone o iPad, agrega la app a tu pantalla de inicio: toca Compartir, luego Agregar a inicio, y ábrela desde ahí. |

## Contracts (Part 1: in-app)

### membership-management

**Migration** (branch `feature/notifications`): `user_notifications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity PK | |
| `user_id` | text | auth-server user id, no FK |
| `source_event_id` | bigint | no FK (events are purged after 30 days) |
| `category` | varchar(32) | `report_conversation` \| `report_submitted` \| `report_reminder` |
| `template` | varchar(64) | the email template name: `report-conversation.new`, `report-conversation.reply`, `report.submitted`, `report.reminder` |
| `data` | jsonb | exactly the email delivery's `data` |
| `path` | text | exactly the email delivery's `path` |
| `subject_key` | varchar(64) | `report_conversation:{id}`, `small_group_report:{id}`, `report_reminder:{YYYY-MM-DD}` |
| `small_group_ids` | int[] null | reminder entries only (rule 14). Never returned |
| `created_at` | timestamptz | |
| `read_at` | timestamptz null | |

Unique `(source_event_id, user_id)`, so a retried event writes nothing twice. Indexes:
`(user_id, id desc)`, a partial index on `(user_id) where read_at is null`, and `(subject_key)`.

**Writing entries.** Each consumer writes entries for its recipients (rule 5) in the event's
transaction, next to `create_deliveries`, while `IN_APP_NOTIFICATIONS_ENABLED` is on. They are
written through the generic `notifications/` module (a new `create_entries`), which knows
categories and templates and never knows conversations, as for deliveries.

**Routes** (JWT, camelCase):

| Route | Response |
| --- | --- |
| `GET /me/notifications?limit=20&before={id}` | `{ items: [{ id, category, template, data, path, createdAt, readAt }], nextBefore: id \| null }`. `limit` 1–50. Newest first |
| `GET /me/notifications/unread-count` | `{ enabled: bool, unread: int }`. Cheap, called per page. With the flag off, `{ enabled: false, unread: 0 }` |
| `POST /me/notifications/{id}/read` | `{ path }`. Idempotent. 404 when it isn't the caller's or is gone |
| `POST /me/notifications/read-all` | `{ marked }` |

All four return 404 `notifications_disabled` while the flag is off, except `unread-count`. The
existing `POST /report-conversations/{id}/read` and `POST /report-conversations/read-all` also set
`read_at` on the matching `report_conversation:{id}` entries (rule 13). The submit transaction
applies rule 14. The worker's maintenance purges entries older than 90 days.

### staff-app

- The bell in `components/topbar.tsx`, the popover, `app/(app)/notifications/page.tsx`, and the
  route handler `app/(app)/notifications/open/[id]/route.ts` (rule 15). Entry text is rendered from
  `template` + `data` with next-intl (`Notifications` namespace), so an unknown template is skipped,
  not crashed on.
- `navigator.setAppBadge(unread)` / `clearAppBadge()` where available (rule 17).
- Everything on the canvas boards, light/dark, en/es, 1440/1024/390.

## Contracts (Part 2: push)

### auth-server

**Config:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:`), and
`PUSH_NOTIFICATIONS_ENABLED`. If the flag is on and any key is missing, startup fails.

**Migration:** two tables.

| Table | Columns |
| --- | --- |
| `push_subscriptions` | `id`, `user_id` FK → user (cascade), `endpoint` text **unique**, `p256dh`, `auth`, `user_agent` (≤ 200 chars, for a device list later), `created_at`, `last_used_at` |
| `push_sends` | PK `(idempotency_key, subscription_id)`, `status` (`sent`), `created_at`. Purged after 48 h, like `notification_sends` |

**Routes for staff-app** (session cookie, called from server actions):

| Route | Body → response |
| --- | --- |
| `GET /api/push/config` | → `{ enabled, publicKey }`. `publicKey` is null while off |
| `PUT /api/push/subscriptions` | `{ endpoint, keys: { p256dh, auth } }` → 204. Upsert by endpoint, moving it to the caller (rule 9). 422 `invalid_endpoint` (rule 10), 404 `push_disabled` |
| `DELETE /api/push/subscriptions` | `{ endpoint }` → 204. Deletes only the caller's, and is idempotent |

Banning a user (better-auth's admin `banUser`, `user-admin-actions.md`) deletes their subscriptions,
through a hook on the ban, not something staff-app has to remember.

**`POST /internal/notifications`** gains these envelope fields. Older callers that send none of them
get email as before:
- `channel`: `"email"` (default) | `"push"`.
- With `"push"`: `notificationId` (int | null, the in-app entry the push opens through rule 15) and
  `badgeCount` (int ≥ 0, the recipient's unread count when the delivery was created).
- `template`, `data` and `path` are validated exactly as for email. The push title and body are
  rendered from the same `data` in the recipient's language (copy table above).

The message sent to each subscription (encrypted, under 4 KB):
`{ "title", "body", "path", "tag": "<idempotencyKey>", "notificationId", "badgeCount" }`.
Headers: `TTL: 86400`, `Urgency: normal`, and `Topic` set to a 32-character base64url hash of the
key.

**The fan-out and its outcome.** For each subscription without a `push_sends` row for this key:

| Push service answers | auth-server does |
| --- | --- |
| 201 / 2xx | writes `push_sends`, sets `last_used_at` |
| 404, 410 | deletes the subscription |
| 400, 413 | logs an error (a bug), skips that one |
| 429, 5xx, timeout | counts it as transient |

The whole request then answers, in this order:
- Any transient → 503 `send_failed` (retried; devices already sent are skipped).
- At least one sent, now or on an earlier attempt → 200 `{ sent: n }`.
- None left → 404 `no_push_subscription`.

**Sender mapping in membership-management:** 404 `no_push_subscription` → `dead`, logged at info and
not as an error. Everything else follows the existing table.

### membership-management

- Each consumer adds a `channel="push"` request per recipient while `PUSH_NOTIFICATIONS_ENABLED` is
  on. The payload carries `channel`, `notificationId` (the entry written in the same transaction, or
  null while in-app is off) and `badgeCount` (the recipient's unread count including that entry).
  The existing preference filter drops it for whoever turned push off for that kind.
- **Preferences** (additive, so an older staff-app keeps working):
  `GET /me/notification-preferences` → `{ email: {…}, available: {…}, push: { reportConversation,
  reportSubmitted, reportReminder }, availablePush: { … } }`. `availablePush[k]` is the kind's flag
  AND `PUSH_NOTIFICATIONS_ENABLED`. `PUT` also takes any subset under `push`.
- No migration: `channel` is already a plain string.

### staff-app

- `public/sw.js` (rule 21). On `push`: `showNotification(title, { body, tag, icon, badge, data })`
  and `setAppBadge(badgeCount)`. On `notificationclick`: focus an open window or open one at
  `/notifications/open/{notificationId}`, or at `path` when it's null. The file is served with
  `Cache-Control: no-cache` and registered with `updateViaCache: 'none'`, scope `/`. `proxy.ts`'s
  matcher already skips paths with a dot, so `/sw.js` gets no sign-in redirect. Keep it that way.
- *This device* (rule 22), the grid (rule 24), and sign-out cleanup in both sign-out places
  (rule 23).
- The VAPID public key comes from `GET /api/push/config` at runtime, never from a `NEXT_PUBLIC_`
  variable baked into the image.

## Later (not in this spec)

- **Rename the kind flags** (`*_EMAILS_ENABLED` → `*_NOTIFICATIONS_ENABLED`) in one config change.
- **A device list** in My profile ("iPhone · Safari, last used …") with *Remove*. `user_agent` is
  stored for it.
- **An *Unread* filter** on `/notifications`.
- **A gentle prompt** (a dismissible card on the leader dashboard on phones) suggesting to turn on
  notifications or install the app.
- **Offline support** in the service worker, with a careful cache policy.
- **A native app**: FCM/APNs as a third channel on the same entries and preferences.
- **Daily digest** of submitted reports (`report-submitted-emails.md`, *Later*).
