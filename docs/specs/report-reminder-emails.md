# Report reminder emails (cross-repo spec)

Active small group leaders and co-leaders get a weekly email (by default Saturday 08:00 in the
church's time zone) when an open group they lead hasn't submitted a report for the current church
week. Unsubmitted drafts are called out, each email carries a short Scripture encouragement that
rotates weekly, and a third switch in My profile lets leaders opt out.

**Status:** done (Nov 23, 2026), merged in all three repos: auth-server PR #38,
membership-management PR #75, staff-app PR #112. Emails stay off until
`REPORT_REMINDER_EMAILS_ENABLED=true` in production. Deploy order:
1. auth-server, with the `report.reminder` template.
2. The membership-management migration `7e1a4c9b2d58` (`python -m membership_management.data.migrate`).
3. membership-management's code.
4. staff-app.
5. Only then turn on the flag.

Only the decisions are kept here; the code and the repo handoffs hold the rest:

- `auth-server/docs/REPORT-REMINDER-EMAILS-HANDOFF.md`
- `membership-management/docs/REPORT-REMINDER-EMAILS-API-HANDOFF.md` (Postgres checks)
- `staff-app/docs/design/REPORT-REMINDER-EMAILS.md` (browser checks and what they didn't cover)

No new permission: eligibility is `smallGroups: view` + `smallGroupReports: create` plus active
leadership. No canvas board: one more switch in the existing Notifications card.

Built with one subagent per repo from the main session (`CLAUDE.md`, *Working across repos*):
auth-server and membership-management in parallel, since this spec fixed the template and
preferences contracts between them; staff-app after membership-management's API was merged.

## Rules (decided, don't reopen)

### Schedule and trigger

1. **Church-level `.env` schedule for now.** `REPORT_REMINDER_EMAILS_ENABLED` (kill switch, default
   off), `REPORT_REMINDER_DAY` (ISO weekday 1–7, default 6 = Saturday) and `REPORT_REMINDER_TIME`
   (local `HH:MM`, default `08:00`), in `CHURCH_TIMEZONE`. Invalid values fail startup. It moves to
   church settings once multi-tenancy lands.
2. **Triggered by the existing worker loop**, not a cron rule. Each sweep compares the church wall
   clock with this week's scheduled time.
3. **Once per church week** (Sunday to Saturday), only within 6 hours of the scheduled time. A row in
   `report_reminder_runs` (keyed by the week's Sunday), written in the same transaction as the
   outbox event, guarantees one batch per week across sweeps and replicas. Day 7 means the Sunday
   that starts the week. A late time whose window crosses midnight loses the part after midnight.
4. **No stale reminders.** The event and every delivery expire at scheduled time + 6 h, so after an
   outage nothing fires late.

### Which groups

5. **Open groups only** (member and guest groups, with or without a meeting day).
6. **Skip a group that already submitted** any report (held or no meeting, any day) dated in the
   church week.
7. **A church-wide no-meeting week reminds nobody.**
8. **Drafts still get a reminder, flagged.** The email says a draft is saved but not submitted and
   links to the most recent draft in the week.

### Who gets it

9. **Active leaders and co-leaders** (no `left_at`) whose member is active and linked to a user.
10. **Only people who can submit reports**: auth-server's batch permissions lookup must return
    `smallGroups: view` and `smallGroupReports: create`. Unlinked, banned, unverified and other roles
    get nothing.
11. **One email per person**, listing all their unsubmitted groups (by name, case-insensitive, then
    id; at most 50), with drafts marked.

### Settings

12. **A third switch, *Weekly report reminders*** (category `report_reminder`, email), default on.
    Turning it off stops queued reminders too.
13. **Who sees it:** someone whose linked member currently leads or co-leads an open group and holds
    both permissions, while the kind is on at the server. That means current periods, not
    `GET /me` `leads`, which keeps groups led when they closed. The card is hidden only when all
    three switches are hidden.
14. **Independent of Watching.** Watching still covers only *Conversations* and *Submitted
    reports*. The reminder switch never enables or disables it, and a card that holds only the
    reminder switch shows no Watched groups list.
15. **Independent kill switch** next to the other two. The worker runs, and `INTERNAL_API_TOKEN` is
    required, when any of the three is on.

### What the email says

16. **No report content**: only the recipient's name, the group names, whether each has a draft,
    the week's encouragement and a link.
17. **Link:** one group with no draft → `/groups/reports/new?groupId={id}`; one group with a draft
    → `/groups/reports/{draftId}/edit`; two or more → `/groups/reports`.
18. **Weekly Scripture encouragement**, one of 7 entries picked from the week's Sunday (weeks since
    the epoch, mod 7), with no database state. The passages are Romans 12:11, Galatians 6:9,
    Colossians 3:23–24, 1 Corinthians 15:58, Ecclesiastes 9:10, Proverbs 21:5 and 2 Peter 1:5–7. The
    church may swap in verbatim translations later without changing any contract.
19. **Wording** (en/es, *tú*, *grupo pequeño*) lives in auth-server's
    `src/emails/report-reminder.tsx`: three variants (one group, one group with a draft, several
    groups), with subject, body, button and a footer pointing to the switch in My profile.

## Contracts (as built)

- **Event** `small_group_report.reminder_due` (v1), written by the worker itself. The aggregate is
  `small_group_report_reminder` / the week as `YYYYMMDD`, and the payload is
  `{ weekStart, scheduledAt }`.
- **Template** `report.reminder` on `POST /internal/notifications`. `data` is strict:
  `{ recipientName, groups: [{ name, hasDraft }] (1–50), weekStart }`. The path must be one of the
  three in rule 17. Names are cut to 200 UTF-16 units, matching Zod's count.
- **Preferences:** `GET /me/notification-preferences` and `PUT` gain `reportReminder` in `email`
  and `available`.
- **Migration** `7e1a4c9b2d58`: `report_reminder_runs (week_start DATE PK, triggered_at)`.

## Later (not in this spec)

- **Schedule in church settings** with an admin UI, once multi-tenancy lands.
- **A follow-up nudge** on Sunday or Monday if the report is still missing.
- **Per-group timing**: the morning after each group's own meeting day.
- **WhatsApp or push**: another `channel` on the same deliveries and preferences.
