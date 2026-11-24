# Notifications: in-app list and Web Push (cross-repo spec)

Every notification the app already emails (conversation comments, submitted reports, weekly report
reminders) also becomes an **entry in an in-app list**. The list has a bell in the top bar, a
`/notifications` page and a count on the installed app's icon. It can also be **pushed** to the
devices where someone turned notifications on: desktop browsers, Android, and iPhone or iPad when
the app is installed to the Home Screen. Email alone is easy to miss, and a push alone is lost once
it's swiped away. A stored list is the industry norm: one notification record per person, delivered
on as many channels as they chose.

**Status:** done (Nov 23, 2026), merged in every repo.
- Part 1 (in-app): membership-management#77, staff-app#114. Behind `IN_APP_NOTIFICATIONS_ENABLED`.
- Part 2 (Web Push): auth-server#40, membership-management#79, staff-app#115, boards in
  design-canvas#2. Behind `PUSH_NOTIFICATIONS_ENABLED` in auth-server and membership-management.
  A real push was received end to end in Chrome (auth-server → FCM → service worker).

Both channel flags default off. Deploy order for Part 2:
1. Generate a VAPID pair per environment (`pnpm exec web-push generate-vapid-keys`) and store it in
   SSM for auth-server (`management-infra`). **Never rotate it casually**: every subscription is bound
   to the public key, and a new pair orphans them all (they log as errors until re-subscribed).
2. auth-server (its migration first), then membership-management, then staff-app.
3. Only then turn on `PUSH_NOTIFICATIONS_ENABLED` in auth-server and membership-management.

Only the decisions are kept here; the code and the repo handoffs hold the rest:

- Part 1: `membership-management/docs/NOTIFICATIONS-API-HANDOFF.md`,
  `staff-app/docs/design/NOTIFICATIONS.md`
- Part 2: `auth-server/docs/PUSH-NOTIFICATIONS-HANDOFF.md` (the Web Push core, explained stage by
  stage), `membership-management/docs/PUSH-NOTIFICATIONS-API-HANDOFF.md`,
  `staff-app/docs/design/PUSH-NOTIFICATIONS.md` (browser checks, including the real push)
- Design: Staff App canvas, pages *Notifications* and *My profile* (`Bell-*`, `Notifications*`,
  `NotificationsCard`, `MyProfile-Push-*`).

No new permission: who gets a notification is decided by the rules that already decide who gets the
email (rule 5). Built from the workspace session with one subagent per repo; Part 2's Web Push core
in auth-server was built in the main session as a walkthrough.

## Rules (decided, don't reopen)

### Shape

1. **One record, several channels.** Each person an event concerns gets **one in-app entry**, plus
   an email and a push delivery when those are on for them. In-app is the record. Email and push are
   ways of hearing about it.
2. **In-app has no switch.** Everyone the event concerns gets the entry. The switches in My profile
   control **email** and **push**, per kind. Turning a kind off on both still leaves it in the list.
3. **The kind's existing flag gates every channel.** `CONVERSATION_EMAILS_ENABLED`,
   `REPORT_SUBMITTED_EMAILS_ENABLED` and `REPORT_REMINDER_EMAILS_ENABLED` decide whether a kind's
   events are written at all. A channel works for a kind only when its own flag
   (`IN_APP_NOTIFICATIONS_ENABLED`, `PUSH_NOTIFICATIONS_ENABLED`) is on too. The `*_EMAILS_` names
   are kept for now (*Later*).
4. **Self-hosted Web Push with VAPID** (RFC 8030/8291/8292, the `web-push` npm package), not a hosted
   service. A native app later would add FCM/APNs as another channel.

### Who gets what

5. **The same recipients as the email, for every channel.** Each consumer decides recipients once per
   event (audience, Watching, the conversation throttle, never the submitter, reminder eligibility);
   in-app, email and push all follow that one decision, and only then are the email and push
   preferences applied.
6. **No new events.** Only the three existing kinds. New kinds are their own specs.
7. **Watching covers every channel.** Unwatching stops future entries, emails and pushes for that
   group; entries already in the list stay. While in-app is on the Watching switches are never
   disabled; with it off, they are disabled only when every email and push switch Watching covers is
   off.

### Privacy

8. **The lock-screen rule is the email rule.** Push text and list entries carry only what the emails'
   `data` carries: actor and submitter names, group names, dates, counts, topics. Never comment text,
   report text, a not-held reason, or the name of the person a conversation is about. Pushes are
   encrypted end to end (RFC 8291), but they show on lock screens.
9. **A device stops receiving an account's pushes once that account signs out there** (rule 23). A ban
   deletes all the user's subscriptions. A subscription registered while another user is signed in
   **moves** to that user.
10. **auth-server only sends to known push services:** `https` on `fcm.googleapis.com`,
    `*.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`, `*.push.apple.com`,
    and only an endpoint that parses to itself (web-push sends through the legacy `url.parse`). The
    browser's keys are checked as real P-256 / 16-byte values. At most 10 subscriptions per user; the
    least recently used goes.

### The list

11. **Bell in the top bar** for every signed-in user while in-app is on: a gold unread count (1–99,
    then "99+"), nothing at 0. From 1024 px a click opens a popover with the latest 10, *Mark all
    read* and *See all*; below, it goes to `/notifications`. Opening the popover reads nothing.
    Screen readers hear the real count ("Notifications, 120 unread"); only the badge caps at 99+. The
    count is re-read on navigation, focus, tab show, and after anything that marks entries read.
12. **`/notifications`**: newest first, grouped by *Today*, *Yesterday* and the date, unread marked,
    *Show more* (cursor paging), *Mark all read*, an empty state.
13. **Read state:** opening an entry marks it read; *Mark all read* marks them all. Opening a
    conversation thread (and the inbox's *Mark all read*) also marks that thread's entries read.
14. **A reminder clears itself** when the last group it names submits, in the submit transaction
    (entries locked, so two submits at once can't both miss it). Not cleared, accepted: a church-wide
    no meeting, a report moved into an owed week, a group closed after the reminder.
15. **One opening path:** `/notifications/open/{id}` marks the entry read and redirects to its path.
    The list, the popover and a clicked push all use it; links use `prefetch={false}`. Anything that
    isn't the caller's entry, and any cross-site navigation (`Sec-Fetch-Site: cross-site`, since ids
    are sequential), lands on `/notifications` without marking.
16. **Kept 90 days**, then purged by the worker (which also runs for this while only in-app is on).
17. **The app icon badge** shows the unread count where the Badging API exists: set by the page
    whenever it reads the count, and by the service worker from each push's `badgeCount`.
18. **The Conversations badge stays.** *Needs my reply* is a work queue; the bell is "what happened".

### Push

19. **Opt in per device, then everything is on.** Nothing asks for permission on load; the prompt
    only follows a tap on *Turn on notifications on this device*. Push switches default on.
20. **One push per delivery, to every device**, in parallel within the 5 s membership-management
    allows (auth-server stops waiting at 4 s). A device already sent is skipped on a retry
    (`push_sends`); the `tag` (on screen) and `Topic` (at the push service) collapse duplicates. A
    push lives 24 h at the push service, `Urgency: normal`.
21. **No caching service worker.** `sw.js` handles `push` and `notificationclick` only. Signed-in
    pastoral data must never come from a cache.
22. **The *This device* row**, one state at a time: not supported, iPhone/iPad not installed (the
    install hint), not asked yet (*Turn on*), on (*Turn off*), blocked. Hidden while push is off at
    the server, or when no kind shows a Push column. After *Turn off* it shows *Turn on* again (no
    silent re-subscribe); a subscription made with an old key is replaced.
23. **Sign-out unsubscribes first** (account menu and needs-role): delete at auth-server, then
    `unsubscribe()` always, capped at 4 s; the sign-out never waits on a failure.
24. **The email/push grid:** one row per kind, columns *Email* and *Push*, each cell hidden while that
    channel is off at the server for that kind. Push switches cover all the user's devices.

## Copy (en / es)

The list (staff-app) and the push (auth-server) use the **same strings**: the push title is the
entry's title and its body the secondary line. Dates use the list's short forms (the boards'):
`{date}` is "Thu, Oct 8" / "jue 8 oct" and `{weekStart}` "Nov 22" / "22 nov". auth-server keeps a copy
of staff-app's two date helpers; change them together.

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

`{section}`: *prayer requests* / *las peticiones de oración*, *praise reports* / *los motivos de
alabanza*, *items for the elders to follow up* / *los puntos para seguimiento de los ancianos*.

The rest of the UI (plus the boards' approved additions: the "Email & push" / "Correo y push"
eyebrow, the helper under the grid and the channel-neutral row hints; their text is in staff-app's
messages):

| Key | en | es |
| --- | --- | --- |
| Bell label | Notifications | Notificaciones |
| Page title | Notifications | Notificaciones |
| Page subtitle | Activity on reports and conversations that concerns you. Kept for 90 days. | Actividad en reportes y conversaciones que te concierne. Se guardan 90 días. |
| Unread line | {count} unread | {count} sin leer |
| Mark all read | Mark all read | Marcar todo como leído |
| See all / Show more | See all / Show more | Ver todas / Ver más |
| Today / Yesterday | Today / Yesterday | Hoy / Ayer |
| Empty, title | You’re all caught up | Estás al día |
| Empty, body | New activity on reports and conversations will show here. | La actividad nueva en reportes y conversaciones aparecerá aquí. |
| Grid columns | Email · Push | Correo · Push |
| Device row label | This device | Este dispositivo |
| Turn on | Turn on notifications on this device | Activar notificaciones en este dispositivo |
| On | On for this device | Activadas en este dispositivo |
| Turn off | Turn off | Desactivar |
| Not supported | This browser can’t show notifications. | Este navegador no puede mostrar notificaciones. |
| Blocked | Notifications are blocked for this site. Allow them in your browser or device settings, then come back. | Las notificaciones están bloqueadas para este sitio. Permítelas en la configuración de tu navegador o dispositivo y vuelve aquí. |
| iOS install hint | To get notifications on this iPhone or iPad, add the app to your Home Screen: tap Share, then Add to Home Screen, and open it from there. | Para recibir notificaciones en este iPhone o iPad, agrega la app a tu pantalla de inicio: toca Compartir, luego Agregar a inicio, y ábrela desde ahí. |

## Contract decisions (the shapes live in code)

- **In-app storage:** `user_notifications` in membership-management, one row per `(source_event_id,
  user_id)`, `data` and `path` exactly the email's. `GET /me/notifications`,
  `/me/notifications/unread-count` (never 404; `{ enabled: false }` while off), `POST …/{id}/read`,
  `…/read-all`; the others 404 `notifications_disabled` while off.
- **Push envelope** on auth-server's `POST /internal/notifications`: `channel` (`email` default |
  `push`), and with push `notificationId` (≥ 1 or null while in-app is off) and `badgeCount` (≥ 0).
  Push fields with email, or missing with push → 422. Email callers are unchanged.
- **Push answers:** 200 `{ sent }`; 404 `no_push_subscription` (membership-management: dead, logged
  at info) or `recipient_unavailable`; 503 `send_failed` (retried; a push 503 doesn't stop
  membership-management's send batch) or `push_disabled` (never a 404, which reads as "route not
  deployed"); 422 `invalid_request` / `invalid_data` (also a message over 3993 bytes, the aes128gcm
  plaintext limit) / `unknown_template`. No 409 for push.
- **Push service answers:** 2xx sent; 404/410 (and keys web-push can't use) delete the subscription;
  400/413 and 401/403 (our VAPID key doesn't match the subscription's) are logged as bugs and skipped;
  429, 5xx, no answer and the 4 s deadline are transient.
- **VAPID:** checked at startup as one P-256 pair with a `mailto:` subject; passed per send, never
  through web-push's global `setVapidDetails()`. staff-app reads the public key at runtime from
  `GET /api/push/config`, never from a `NEXT_PUBLIC_` variable.
- **Subscriptions** are registered from staff-app's server with the browser's `User-Agent` forwarded
  (stored for the device list under *Later*). `DELETE` works whatever the flag says, so sign-out
  cleanup always works.
- **Preferences:** `GET /me/notification-preferences` adds `push` and `availablePush` (the kind's flag
  AND the push flag), additively.

## Later (not in this spec)

- **Rename the kind flags** (`*_EMAILS_ENABLED` → `*_NOTIFICATIONS_ENABLED`) in one config change.
- **A device list** in My profile ("iPhone · Safari, last used …") with *Remove*. `user_agent` is
  stored for it.
- **An *Unread* filter** on `/notifications`.
- **A gentle prompt** (a dismissible card on the leader dashboard on phones) suggesting to turn on
  notifications or install the app.
- **Push-aware wording** for the Watching hints shown when every switch is off (they still say
  "emails").
- **Offline support** in the service worker, with a careful cache policy.
- **A native app**: FCM/APNs as a third channel on the same entries and preferences.
- **Daily digest** of submitted reports (`report-submitted-emails.md`, *Later*).
