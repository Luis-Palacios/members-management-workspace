# Report submitted emails (cross-repo spec)

Elders and admins get an email when a small group report is submitted in a group they **watch**.
Watching already exists for report conversations (`report-conversations.md`, rules 18–23); this
spec makes it cover a second event. The "Conversation emails" switch in My profile becomes an
**Email notifications** section with one switch per kind of email.

**Status:** drafted Nov 22, 2026. Not started. Report conversations Part 2 is merged in all three
repos but **not deployed**, so the renamed switch and the changed preferences contract ship before
anyone has seen the old ones (no data or client to migrate).

- **Depends on:** `report-conversations.md` (Part 2: outbox, worker, `notifications/`, watching,
  rule 23's shared read check), `report-autosave.md` (Draft / Submitted), `small-group-reports.md`
  (rules 5 and 6), `church-wide-no-meeting.md`. All are on `main`.
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/REPORT-SUBMITTED-EMAILS-HANDOFF.md`
  - `membership-management/docs/REPORT-SUBMITTED-EMAILS-API-HANDOFF.md`
  - `staff-app/docs/design/REPORT-SUBMITTED-EMAILS.md`
- **Branch name in every repo:** `feature/report-submitted-emails`.
- **No new permission.** Who can get these emails comes from report conversations rule 18.
- **Design:** no canvas board yet. The My profile Notifications card and the group page's Watching
  switch already exist (staff-app PR #109); this changes their copy and adds one switch. Add a board
  to the Staff App canvas if the layout changes more than that.

## Implementation order

1. `auth-server`: the `report.submitted` template (en/es) and the report link shape.
2. `membership-management`: the event on submit, its consumer, the `report_submitted` category, the
   second kill switch and the new preferences contract.
3. `staff-app`: the Email notifications section, the second switch, the new copy for Watching.

One repo per Claude Code session, as usual. Runs as usual (not learning mode): it reuses what Part
2 built.

## Rules (decided, don't reopen)

### When an email goes out

1. **Only when a report becomes Submitted.** Two paths do this: filing a report straight as
   submitted (`create_report` with `status = submitted`, held or no meeting, including one that
   replaces a draft or a no meeting), and submitting a draft (`submit_report`). Starting a draft,
   auto-saves, edits after submitting and deleting send nothing.
2. **Once per report.** Submitted-by and submitted-at never change (reports rule 6), so a report
   has one submit event. A report that is deleted and filed again is a new report and sends again.
3. **Church-wide no-meeting weeks send nothing.** Those reports are created by an elder or admin
   for every group at once (`church-wide-no-meeting.md`); the people who would get the emails are
   the ones who did it.
4. **A no meeting a leader files does send**, with its own wording ("didn't meet"). Elders want to
   know a group skipped a week as much as that it met.

### Who gets it

5. **Watchers only** (report conversations rule 18): the full-scope observation audience, every
   group by default, minus the groups they unwatched (rule 21). The same check decides it, by the
   same function (rule 23, `can_read_group_conversations`), so there is still one copy of the rule.
6. **Never the submitter.** If an elder or admin submits a report themselves, the other watchers
   still get it. The submitter is the user linked to `submitted_by_member_id`.
7. **Leaders get nothing.** They file the reports. Leaders have no Submitted reports switch.
8. **No throttle.** One email per report per watcher. The conversation throttle (rule 20) is about
   threads and doesn't apply. Volume is about one email per group per week per watcher. A daily
   digest is the planned answer if that turns out to be too many (see *Later*); nothing in this
   spec should make it harder.

### Settings

9. **One switch per kind of email**, in an **Email notifications** section of My profile:
   *Conversations* (category `report_conversation`, today's "Conversation emails", renamed) and
   *Submitted reports* (new category `report_submitted`). Both default on (`notification_preferences`,
   no row = enabled). Turning one off stops its queued emails too (checked again right before each
   send, as today). The *Submitted reports* switch shows only to the watch audience.
10. **Watching is shared.** One Watching switch per group covers both kinds: leaders' comments and
    submitted reports. Unwatching a group stops both from that group. The Watching switches are
    disabled (not hidden) only when **both** email switches are off; with one on, they work.
11. **Its own kill switch:** `REPORT_SUBMITTED_EMAILS_ENABLED` (default `false`), next to
    `CONVERSATION_EMAILS_ENABLED`. Off = submitting writes no event row; the *Submitted reports*
    switch is hidden. Each can be turned on in production on its own.

### What the email says

12. **No free text from the report**: no observations, no prayer or praise text, no not-held
    reason (it is typed by the leader), no member names. Only the group, the meeting date, who
    submitted it, the attendance count for a held meeting, and a link. Same rule as the
    conversation emails.
13. **Wording** (en / es). Held: subject *"{group} submitted its report for {date}"* / *"{group}
    envió su reporte del {date}"*; body *"{submitter} submitted the report. {attended} of {people}
    attended."* / *"{submitter} envió el reporte. Asistieron {attended} de {people}."* No meeting:
    subject *"{group} didn't meet on {date}"* / *"{group} no se reunió el {date}"*; body *"{submitter}
    reported that the group didn't meet."* / *"{submitter} reportó que el grupo no se reunió."*
    Button *Open report* / *Abrir reporte*. Why line: *"You're getting this because you watch this
    group. You can unwatch it, or turn off submitted report emails, in My profile."* / *"Recibes
    este correo porque sigues este grupo. Puedes dejar de seguirlo, o desactivar los correos de
    reportes enviados, en Mi perfil."* `{people}` counts the report's attendance rows (members and
    guests); `{attended}` those with `attended_group`.

## Contracts

### auth-server

- **New template `report.submitted`** in the zod union of `POST /internal/notifications`. `data`:
  `submitterName`, `groupName`, `meetingDate` (ISO date), `held` (bool), `attendedCount` and
  `peopleCount` (ints, present only when `held`), `reason` (`watcher`, the only value for now).
  Rendered in the recipient's language, as today.
- **New link shape**: `/groups/reports/{id}` with no query, added to the allowed paths in
  `src/notifications/templates.tsx`. The three existing shapes stay.
- Everything else (idempotency, `notification_sends`, status codes) is unchanged.

### membership-management

- **Event** `small_group_report.submitted`, `schema_version` 1, `aggregate_type`
  `small_group_report`, `aggregate_id` the report id. Payload: `reportId`, `smallGroupId`,
  `submittedByMemberId`, `occurredAt` (= the report's `submitted_at`). Ids and facts only. Written
  in the submit transaction (the placeholder comment in `submit_report` marks the spot, and the
  same in `create_report` for a submitted report), only while `REPORT_SUBMITTED_EMAILS_ENABLED` is
  on. `next_attempt_at = now() + 60 s` and `expires_at = created_at + 24 h`, as for comments.
- **Consumer** (domain, next to the report-conversations one; the worker picks the consumer by
  `event_type`, `_KNOWN` gains the new type):
  - Candidates = the possible watchers the sweep already fetched (`with-permission`), minus the
    submitter's user. They go through the batch permissions lookup as today.
  - Report gone (deleted before processing), or no longer submitted → `processed`, no deliveries.
  - Keep those `can_read_group_conversations` accepts for the group (rule 5), drop those in
    `small_group_watch_opt_outs` for it, hand the rest to `notifications/` with category
    `report_submitted`, channel `email`, template `report.submitted`, the event's `expires_at`.
  - Counts and names are read when the event is processed, so a quick edit after submitting shows
    in the email. The payload stored on the delivery never changes after that (Resend's rule).
- **Fast path**: the submit routes add the same best-effort `BackgroundTasks` task the comment
  routes use. Nothing depends on it.
- **Worker** runs (embedded or on its own) when **either** kill switch is on. With only one on, it
  only ever sees that one's events, because the other writes none.
- **Preferences** (changes Part 2's contract; staff-app is the only client and isn't deployed):
  - `GET /me/notification-preferences` →
    ```json
    {
      "email": { "reportConversation": true, "reportSubmitted": true },
      "available": { "reportConversation": false, "reportSubmitted": false }
    }
    ```
    `available` is the kill switch per category (replaces `emailsEnabled`).
  - `PUT /me/notification-preferences` with any subset, e.g. `{ "email": { "reportSubmitted":
    false } }`; returns the same shape as `GET`. Unknown keys → 422.
  - `PUT` on `reportSubmitted` is allowed for anyone (it only concerns their own inbox), as for
    conversations; staff-app shows the switch only to the watch audience.
- **Watching routes unchanged** (`GET /me/watched-groups`, `PUT /small-groups/{id}/watch`). They
  are available while either kill switch is on.
- **No migration**: `outbox_events.event_type`, `notification_deliveries.category` and
  `notification_preferences.category` are plain strings; migration `b453135219c0` only constrains
  the `status` columns.

### staff-app

- **My profile, Notifications card** (eyebrow *Email*, title *Notifications*, unchanged):
  - *Conversations* / *Conversaciones*. Hint unchanged from today's "Conversation emails" hint.
  - *Submitted reports* / *Reportes enviados*, only for the watch audience. Hint: *"Get an email
    when a report is submitted in a group you watch."* / *"Recibe un correo cuando se envíe un
    reporte en un grupo que sigues."*
  - Each switch is hidden while its `available` is false; the card is hidden when both are.
  - *Watched groups* hint: *"You get emails about leaders' comments and submitted reports in the
    groups you watch. Unwatching doesn't stop emails for conversations you've commented in."* /
    *"Recibes correos sobre los comentarios de los líderes y los reportes enviados en los grupos que
    sigues. Dejar de seguir un grupo no detiene los correos de conversaciones en las que comentaste."*
  - With both switches off, the Watching switches are disabled with *"Turn on conversation or
    report emails to choose groups."* / *"Activa los correos de conversaciones o de reportes para
    elegir grupos."*
- **Group page Watching switch** hint: *"Get an email when a leader comments in this group's reports
  or a report is submitted."* / *"Recibe un correo cuando un líder comente en los reportes de este
  grupo o se envíe un reporte."* The disabled hint changes as in My profile (both off).
- **Email link** `/groups/reports/{id}` already exists; signed out, it goes through
  `/sign-in?next=` as the conversation links do.
- Regenerate the API types for the new preferences shape.

## Later (not in this spec)

- **Daily digest** of submitted reports per watcher, if one email per report is too many. It would
  be a different delivery shape (one email for many events), so it gets its own spec.
- **Push**: another `channel` on the same deliveries and preferences (report conversations rule 22).
- **Missing report reminders** (`small-group-reports.md`, *Not in v1*) would be a third category in
  the same section.
