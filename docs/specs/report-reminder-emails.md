# Report reminder emails (cross-repo spec)

Active small group leaders and co-leaders get a weekly email reminder—by default on Saturday at
8:00 AM in the church's time zone—when any open group they lead has not yet submitted a report for
the current church week. Groups with an unsubmitted draft are called out clearly so leaders who
started a report and forgot to submit it can finish it in one click. Each email includes a short
weekly encouragement grounded in Scripture, rotating through a set of passages week by week, and a
third switch in My profile lets leaders opt out.

**Status:** drafted Nov 22, 2026. Not started.

- **Depends on:** `report-conversations.md` (Part 2: outbox, worker, `notifications/`),
  `report-submitted-emails.md` (multi-switch preferences contract and Notifications card),
  `report-autosave.md` (Draft / Submitted), `small-group-reports.md` (rules 5 and 10),
  `church-wide-no-meeting.md`. All are on `main`.
- **Schema change:** yes, one small table in `membership-management` (`report_reminder_runs`) to
  guarantee at most one reminder batch per church week across worker sweeps and replicas.
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/REPORT-REMINDER-EMAILS-HANDOFF.md`
  - `membership-management/docs/REPORT-REMINDER-EMAILS-API-HANDOFF.md`
  - `staff-app/docs/design/REPORT-REMINDER-EMAILS.md`
- **Branch name in every repo:** `feature/report-reminder-emails`.
- **No new permission.** Eligibility uses the existing `smallGroups: view` and
  `smallGroupReports: create` permissions plus active group leadership.
- **Design:** no canvas board needed. The My profile Notifications card already exists (`staff-app`
  PR #110); this adds one more switch in the same section.

## Implementation order

1. `auth-server` and `membership-management` **can run in parallel**: this spec fixes the
   `report.reminder` template key, strict `data` schema, allowed `path` patterns, and the
   preferences contract between them.
   - `auth-server`: the `report.reminder` template (en/es) with the draft distinction, multi-group
     list, weekly rotating Scripture encouragement, and allowed report paths.
   - `membership-management`: `report_reminder_runs` migration, schedule settings in
     `NotificationSettings`, weekly trigger in the worker loop, `small_group_report.reminder_due`
     consumer, `report_reminder` category, kill switch, and preferences schema update.
2. `staff-app`: after `membership-management`'s API is ready locally (or merged). Regenerate API
   types and add the *Weekly report reminders* switch in My profile's Notifications card.

## Rules (decided, don't reopen)

### Schedule and trigger

1. **Church-level `.env` schedule (for now).** Reuses `CHURCH_TIMEZONE` (already an env var; read in
   `NotificationSettings` too so the standalone worker does not import `api`) and adds three env
   vars in `membership-management`:
   - `REPORT_REMINDER_EMAILS_ENABLED` (bool, default `False`): kill switch. Off means the worker
     never triggers reminders and `staff-app` hides the switch.
   - `REPORT_REMINDER_DAY` (int `1`–`7`, ISO weekday matching `Weekday` in `small_group.py`,
     default `6` = Saturday).
   - `REPORT_REMINDER_TIME` (`HH:MM` 24-hour local time in `CHURCH_TIMEZONE`, default `08:00`).
   Invalid values fail startup, like `CHURCH_TIMEZONE`. One schedule per deployment for now; it
   moves onto church settings once multi-tenancy lands.
2. **Triggered by the existing worker loop.** No new AWS cron or EventBridge rule. On each sweep
   while `REPORT_REMINDER_EMAILS_ENABLED` is on, the worker checks the current wall-clock time in
   `CHURCH_TIMEZONE` against the current church week's scheduled timestamp (`scheduled_at`).
3. **Once per church week, with a 6-hour catch-up window.** A church week is Sunday to Saturday
   (`week_start = church_sunday(today)`). The reminder may trigger only while
   `scheduled_at <= now_church < scheduled_at + 6 hours`. Inserting `week_start` into
   `report_reminder_runs` (`ON CONFLICT DO NOTHING`) in the same transaction as the outbox event
   guarantees at most one batch per week across sweeps and multiple replicas.
4. **No stale reminders after an outage.** Both the outbox event and every delivery it creates
   expire at `scheduled_at + 6 hours` (not 24 hours). If the service or `auth-server` is down all
   morning and recovers past the window, nothing fires late.

### Which groups need a reminder

5. **Open groups only.** Every `SmallGroup` with `closed_at IS NULL`—whether or not `meeting_day`
   is set, and whether it is a member group or a guest group—is evaluated. Closed groups never
   trigger reminders.
6. **Skip groups that already submitted this week.** If the group already has any report with
   `status = 'submitted'` (held or no-meeting, on any weekday) whose `meeting_date` falls in the
   current church week (`week_start <= meeting_date <= week_start + 6 days`), it is skipped.
7. **Skip everyone during a church-wide no-meeting week.** If `small_group_no_meeting_weeks` has a
   row for `week_start`, the batch creates no deliveries (even for groups without a `meeting_day`,
   which church-wide no-meeting skips when creating rows).
8. **Drafts still trigger a reminder, with a clear distinction.** A group with no submitted report
   this week that has a report with `status = 'draft'` dated in the current church week still gets
   reminded, flagged with `hasDraft = true` so the email makes clear a draft exists but has not been
   submitted yet. If a group somehow has more than one draft in the week, use the most recent one
   (by `meeting_date` desc, then `id` desc) for the edit link.

### Who gets it

9. **Active leaders and co-leaders.** For every group that still needs a reminder, every
   `SmallGroupMember` row with `role IN ('leader', 'co_leader')` and `left_at IS NULL`, whose
   `Member` is `ACTIVE` and has a non-null `user_id`, is a candidate. Both the leader and any
   co-leaders of a group receive their own email.
10. **Must be allowed to submit reports.** Candidates are checked through `auth-server`'s batch
    permissions lookup (`permissions_for`), keeping only users who hold both `smallGroups: view` and
    `smallGroupReports: create`. Unlinked members, banned users, unverified emails, and roles that
    cannot submit reports receive nothing.
11. **One email per person.** If a person leads or co-leads more than one unsubmitted open group,
    they receive **one** email listing all of those groups (sorted by group name, then id), marking
    which ones have an unsubmitted draft.

### Settings

12. **Third switch in My profile:** *Weekly report reminders* (category `report_reminder`, channel
    `email`), default **on** (`notification_preferences`, no row = enabled). Turning it off stops
    future reminders and suppresses any already queued (re-checked right before sending, as today).
13. **Who sees the switch:** shown in My profile's **Email notifications** card only when
    `available.reportReminder` is `true` **and** the signed-in user actively leads or co-leads at
    least one open group (`leadIds.size > 0`) and holds `smallGroups: view` +
    `smallGroupReports: create`. Hidden otherwise. The card is hidden only when all three switches
    are hidden for that user.
14. **Independent of Watching.** Group Watching switches (`report-submitted-emails.md` rule 10)
    still cover only *Conversations* and *Submitted reports*. Turning *Weekly report reminders* on
    or off does not enable or disable the Watching switches.
15. **Independent kill switch.** `REPORT_REMINDER_EMAILS_ENABLED` sits next to
    `CONVERSATION_EMAILS_ENABLED` and `REPORT_SUBMITTED_EMAILS_ENABLED`. The worker runs (embedded
    or standalone) when **any** of the three is on, and `INTERNAL_API_TOKEN` is required when any of
    the three is on.

### What the email says

16. **No pastoral or report content.** Only the recipient's name (`Member.name`), the unsubmitted
    group name(s), whether each has a saved draft, the week's encouragement note, and a link into
    `staff-app`.
17. **Link target:**
    - 1 group, no draft → `/groups/reports/new?groupId={groupId}`
    - 1 group, has draft → `/groups/reports/{draftReportId}/edit`
    - 2+ groups → `/groups/reports`
18. **Weekly rotating Scripture encouragement.** The template holds a fixed ordered list of 7
    encouragement entries grounded in the passages below (Romans 12:11, Galatians 6:9, Colossians
    3:23–24, 1 Corinthians 15:58, Ecclesiastes 9:10, Proverbs 21:5, and 2 Peter 1:5–7). One entry is
    shown per email, picked deterministically from `weekStart` (weeks since Unix epoch modulo list
    length) so every church week advances to the next entry with no extra database state.
19. **Wording (en/es, *tú*, *grupo pequeño*)** lives in `auth-server/src/emails/report-reminder.tsx`
    (with Spanish preview `report-reminder.es.tsx`):
    - **Eyebrow:** *Weekly reminder* / *Recordatorio semanal*
    - **Subject & heading:**
      - 1 group, no draft: *Time to submit your small group report* / *Es momento de enviar el
        reporte de tu grupo pequeño*
      - 1 group, has draft: *Don’t forget to submit your small group report draft* / *No olvides
        enviar el borrador del reporte de tu grupo pequeño*
      - 2+ groups: *Time to submit your small group reports* / *Es momento de enviar los reportes de
        tus grupos pequeños*
    - **Body:**
      - 1 group, no draft:
        - EN: *Hi **{recipientName}**, thank you for shepherding **{groupName}** this week. When you
          have a moment, please submit this week’s report so the elders can pray with you and care
          for your group.*
        - ES: *Hola **{recipientName}**, gracias por cuidar y servir a **{groupName}** esta semana.
          Cuando tengas un momento, envía el reporte semanal para que los ancianos puedan orar
          contigo y acompañar a tu grupo.*
      - 1 group, has draft:
        - EN: *Hi **{recipientName}**, thank you for shepherding **{groupName}** this week. You have
          a saved **draft** that hasn’t been submitted yet—when you have a moment, review and submit
          it so the elders can pray with you and care for your group.*
        - ES: *Hola **{recipientName}**, gracias por cuidar y servir a **{groupName}** esta semana.
          Tienes un **borrador** guardado que aún no ha sido enviado; cuando tengas un momento,
          revísalo y envíalo para que los ancianos puedan orar contigo y acompañar a tu grupo.*
      - 2+ groups:
        - EN: *Hi **{recipientName}**, thank you for shepherding your small groups this week. When
          you have a moment, please submit this week’s report for each group below so the elders can
          pray with you and care for your groups:* — followed by a list of groups, appending *—
          draft saved, not submitted yet* to any group with `hasDraft: true`.
        - ES: *Hola **{recipientName}**, gracias por cuidar y servir a tus grupos pequeños esta
          semana. Cuando tengas un momento, envía el reporte semanal de cada grupo para que los
          ancianos puedan orar contigo y acompañarlos:* — followed by a list of groups, appending *—
          borrador guardado, aún sin enviar* to any group with `hasDraft: true`.
    - **Scripture encouragement callout** (subtle left-bordered note between the body/list and the
      button; one entry per week, rotated by `weekStart`; the church may swap in preferred verbatim
      Bible translations in `report-reminder.tsx` later without changing any contract):
      1. **Romans 12:11 / Romanos 12:11**
         - EN: *Stay diligent and serve the Lord with a fervent spirit.* — Romans 12:11
         - ES: *No pierdas la diligencia; sirve al Señor con un espíritu ferviente.* — Romanos 12:11
      2. **Galatians 6:9 / Gálatas 6:9**
         - EN: *Do not grow weary of doing good; in due time your faithful work will bear fruit.* —
           Galatians 6:9
         - ES: *No te canses de hacer el bien; a su debido tiempo verás el fruto si no te rindes.* —
           Gálatas 6:9
      3. **Colossians 3:23–24 / Colosenses 3:23–24**
         - EN: *Whatever you do, put your whole heart into it as working for the Lord, not for
           people.* — Colossians 3:23–24
         - ES: *Todo lo que hagas, hazlo de corazón, como para el Señor y no para los hombres.* —
           Colosenses 3:23–24
      4. **1 Corinthians 15:58 / 1 Corintios 15:58**
         - EN: *Stand firm and keep giving yourself fully to the Lord’s work, knowing your labor is
           never in vain.* — 1 Corinthians 15:58
         - ES: *Mantente firme y constante en la obra del Señor, sabiendo que tu trabajo nunca es en
           vano.* — 1 Corintios 15:58
      5. **Ecclesiastes 9:10 / Eclesiastés 9:10**
         - EN: *Whatever task is in your hands today, give it your very best strength.* —
           Ecclesiastes 9:10
         - ES: *Todo lo que esté al alcance de tu mano hacer hoy, hazlo con todas tus fuerzas.* —
           Eclesiastés 9:10
      6. **Proverbs 21:5 / Proverbios 21:5**
         - EN: *Careful, diligent attention leads to steady fruit, while rushing leaves things
           unfinished.* — Proverbs 21:5
         - ES: *La diligencia y el cuidado constante dan fruto, mientras que las prisas dejan lo
           importante atrás.* — Proverbios 21:5
      7. **2 Peter 1:5–7 / 2 Pedro 1:5–7**
         - EN: *Make every effort to grow your faith with goodness, patience, and brotherly love as
           you care for others.* — 2 Peter 1:5–7
         - ES: *Pon toda diligencia en acompañar tu fe con paciencia, dominio propio y amor al
           cuidar de los demás.* — 2 Pedro 1:5–7
    - **Button:**
      - 1 group, no draft: *Submit report* / *Enviar reporte*
      - 1 group, has draft: *Review & submit draft* / *Revisar y enviar borrador*
      - 2+ groups: *Open reports* / *Abrir reportes*
    - **Footer (`IgnoreNote`):**
      - EN: *You’re getting this because you lead or co-lead an open small group. You can turn off
        weekly report reminders in My profile.*
      - ES: *Recibes este correo porque lideras o co-lideras un grupo pequeño activo. Puedes
        desactivar los recordatorios semanales de reportes en Mi perfil.*

## Contracts

### auth-server

- **Template** `report.reminder` registered in `src/notifications/templates.tsx` on the existing
  `POST /internal/notifications` route (no new route):
  - `data` (strict Zod schema):
    ```ts
    const reportReminderGroup = z.strictObject({
      name: z.string().trim().min(1).max(200),
      hasDraft: z.boolean(),
    });
    const reportReminderData = z.strictObject({
      recipientName: z.string().trim().min(1).max(200),
      groups: z.array(reportReminderGroup).min(1).max(50),
      weekStart: z.iso.date(),
    });
    ```
  - Allowed `path` regex (anchored, no full URL):
    ```ts
    const reportReminderPath =
      /^\/groups\/reports$|^\/groups\/reports\/new\?groupId=[1-9]\d*$|^\/groups\/reports\/[1-9]\d*\/edit$/;
    ```
- **Email component:** `src/emails/report-reminder.tsx` (and `src/emails/report-reminder.es.tsx`
  for `pnpm email:dev`), using `EmailShell`, `BodyText`, `Strong`, `ActionButton`, `FallbackLink`,
  and `IgnoreNote` from `src/emails/shared/layout.tsx`.
- **Unit tests** in `src/notifications/templates.test.tsx`: valid payloads (single no-draft, single
  draft, multi-group mixed), invalid `data` / `path` rejected, deterministic verse rotation from
  `weekStart`, both `en` and `es` rendering.

### membership-management

- **Migration:** new table `report_reminder_runs`:
  - `week_start DATE PRIMARY KEY` (the church Sunday `YYYY-MM-DD`)
  - `triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - No migration needed for `outbox_events`, `notification_deliveries`, or
    `notification_preferences` (event types and categories are plain strings).
- **Config (`notifications/config.py`, `NotificationSettings`):**
  - `church_timezone: str = "America/Managua"` (validated with `ZoneInfo`, matching `ApiSettings`)
  - `report_reminder_emails_enabled: bool = False`
  - `report_reminder_day: int = 6` (validated `1 <= day <= 7`)
  - `report_reminder_time: time = time(8, 0)` (parsed from `HH:MM`, default `08:00`)
  - `require_token_when_enabled` and `any_emails_enabled` updated to include
    `report_reminder_emails_enabled`.
  - Document the three new env vars in `.env.example`.
- **Scheduler step in `worker/runner.py` (`run_once`):**
  - Runs at the start of `run_once()` (after `expire_overdue`, before `process_due_events`), only
    when `notification_settings.report_reminder_emails_enabled` is `True`.
  - Computes `now_church = datetime.now(ZoneInfo(notification_settings.church_timezone))`,
    `week_start = church_sunday(now_church.date())`, `offset = 0 if day == 7 else day`,
    `target_date = week_start + timedelta(days=offset)`, and
    `scheduled_at = datetime.combine(target_date, report_reminder_time, tzinfo=tz)`.
  - If `scheduled_at <= now_church < scheduled_at + timedelta(hours=6)`:
    - In one transaction, `INSERT INTO report_reminder_runs (week_start) VALUES (:week_start) ON
      CONFLICT (week_start) DO NOTHING RETURNING week_start`.
    - If inserted, add one `OutboxEvent` (`event_type = "small_group_report.reminder_due"`,
      `schema_version = 1`, `aggregate_type = "small_group_report_reminder"`,
      `aggregate_id = int(week_start.strftime("%Y%m%d"))`,
      `payload = {"weekStart": week_start.isoformat(), "scheduledAt": scheduled_at.isoformat()}`,
      `created_at = now_utc`, `next_attempt_at = now_utc`,
      `expires_at = (scheduled_at + timedelta(hours=6)).astimezone(UTC)`) and commit.
- **Consumer (`data/small_groups/report_reminder_notifications.py`, registered in `worker/events.py`
  `_KNOWN`):**
  - `REMINDER_DUE = "small_group_report.reminder_due"`, `CATEGORY = "report_reminder"`,
    `_TEMPLATE = "report.reminder"`.
  - `candidate_user_ids`: if `small_group_no_meeting_weeks` has `week_start`, return `frozenset()`;
    otherwise return the `user_id`s of active `Member`s who are active `leader`/`co_leader` of any
    open group that has no `submitted` report in `[week_start, week_start + 6 days]`.
  - `process_report_reminder`: inside the event's fenced transaction, re-check
    `small_group_no_meeting_weeks` and open unsubmitted groups + their latest draft in the week;
    keep only candidates whose `perms` include `smallGroups: view` and `smallGroupReports: create`;
    group unsubmitted groups by `recipient_user_id` (sorted by `group.name`, `group.id`); build one
    `NotificationRequest` per recipient with category `report_reminder`, channel `email`, template
    `report.reminder`, `not_after = event.expires_at`, and pass to `create_deliveries`.
  - Note: `NotificationDelivery`'s unique constraint `(source_event_id, recipient_user_id, channel)`
    naturally matches one email per recipient per weekly event.
- **Preferences (`api/routers/me.py`, `api/schemas/notifications.py`):**
  - `GET /me/notification-preferences` adds `reportReminder`:
    ```json
    {
      "email": {
        "reportConversation": true,
        "reportSubmitted": true,
        "reportReminder": true
      },
      "available": {
        "reportConversation": false,
        "reportSubmitted": false,
        "reportReminder": false
      }
    }
    ```
  - `PUT /me/notification-preferences` accepts `reportReminder` under `email` (optional boolean,
    null and unknown keys → 422), allowed for any signed-in user (same as the other switches).
- **No fast path** needed (there is no user-triggered route that creates this event).

### staff-app

- Regenerate API types (`src/api/` or `api/notifications-api/types.ts`) for `reportReminder` in
  `NotificationPreferences`.
- Add `setReportReminderEmails(enabled: boolean)` server action in
  `app/(app)/_actions/notification-actions.ts`.
- Pass `leadsGroup={leadIds.size > 0}` from `app/(app)/users/me/page.tsx` to `MyNotifications`.
- In `MyNotifications` (`app/(app)/users/me/_components/my-notifications.tsx`):
  - Compute `canReceiveReminders = leadsGroup && can(permissions, { smallGroups: ["view"], smallGroupReports: ["create"] })`.
  - `showReminders = canReceiveReminders && available.reportReminder`.
  - Render `NotificationsCard` whenever `showConversations || showSubmitted || showReminders`.
- In `NotificationsCard` (`app/(app)/users/me/_components/notifications-card.tsx`):
  - Add optional `reminderEmails?: boolean` prop and a third `SettingSwitch` when defined.
  - Keep `emailsOn` (which controls the disabled state of the Watching list) tied only to
    `conversationEmails` and `submittedEmails` (rule 14).
- **Copy (`messages/en.json`, `messages/es.json`, under `NotificationSettings`):**
  - `reminderEmails`: *"Weekly report reminders"* / *"Recordatorios semanales de reportes"*
  - `reminderEmailsHint`: *"Get a weekly reminder to submit your small group’s report if it hasn’t
    been submitted yet."* / *"Recibe un recordatorio semanal para enviar el reporte de tu grupo
    pequeño si aún no ha sido enviado."*
- **Email links** (`/groups/reports`, `/groups/reports/new?groupId={id}`,
  `/groups/reports/{id}/edit`) already exist and redirect through `/sign-in?next=` when signed out.

## Later (not in this spec)

- **UI for church schedule settings:** moving `REPORT_REMINDER_DAY` and `REPORT_REMINDER_TIME` (and
  `CHURCH_TIMEZONE`) from `.env` to a church settings table and admin UI when multi-tenancy lands.
- **Follow-up / overdue reminders:** a second nudge on Sunday or Monday if the report is still
  missing after Saturday's reminder.
- **Per-group meeting-day reminders:** sending each group's reminder the morning after its own
  `meeting_day` instead of one church-wide day.
- **WhatsApp or push channel:** another `channel` on the same `NotificationDelivery` and
  `NotificationPreference` tables.
