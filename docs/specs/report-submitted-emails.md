# Report submitted emails (cross-repo spec)

Elders and admins get an email when a small group report is submitted in a group they **watch**.
Watching already existed for report conversations (`report-conversations.md`, rules 18–23); this
spec made it cover a second event. The "Conversation emails" switch in My profile became an
**Email notifications** section with one switch per kind of email.

**Status:** done (Nov 22, 2026), merged in all three repos: auth-server PR #36, membership-management
PR #73, staff-app PR #110. Emails stay off until `REPORT_SUBMITTED_EMAILS_ENABLED=true` in
production; turn it on only once auth-server's `report.submitted` template is deployed. Report
conversations Part 2 wasn't deployed when this was built, so the renamed switch and the new
preferences contract shipped before anyone saw the old ones. Only the decisions are kept here; the
code and the repo handoffs hold the rest:

- `auth-server/docs/REPORT-SUBMITTED-EMAILS-HANDOFF.md`
- `membership-management/docs/REPORT-SUBMITTED-EMAILS-API-HANDOFF.md`
- `staff-app/docs/design/REPORT-SUBMITTED-EMAILS.md` (browser checks and what they didn't cover)

No new permission: who gets these emails comes from report conversations rule 18. No canvas board:
the existing Notifications card and Watching switch, with new copy and one more switch.

Built with one subagent per repo from the main session (`CLAUDE.md`, *Working across repos*):
auth-server and membership-management in parallel, since this spec fixed the template contract
between them; staff-app after membership-management's API was merged.

## Rules (decided, don't reopen)

### When an email goes out

1. **Only when a report becomes Submitted**: filed straight as submitted (held or no meeting,
   including one that replaces a draft or a no meeting), or a draft submitted. Starting a draft,
   auto-saves, edits after submitting and deleting send nothing.
2. **Once per report.** Submitted-by and submitted-at never change (reports rule 6). A report that
   is deleted and filed again is a new report and sends again.
3. **Church-wide no-meeting weeks send nothing.** An elder or admin creates them for every group at
   once; the people who would get the emails are the ones who did it.
4. **A no meeting a leader files does send**, with its own wording ("didn't meet").

### Who gets it

5. **Watchers only** (report conversations rule 18), minus the groups they unwatched (rule 21),
   decided by the same read check as conversation emails (rule 23), one copy of the rule.
6. **Never the submitter.** If an elder or admin submits a report, the other watchers still get it.
7. **Leaders get nothing** and have no Submitted reports switch.
8. **No throttle.** One email per report per watcher, about one per group per week. A daily digest
   is the planned answer if that turns out to be too many (see *Later*).

### Settings

9. **One switch per kind of email**: *Conversations* (category `report_conversation`) and
   *Submitted reports* (category `report_submitted`, watch audience only). Both default on. Turning
   one off stops its queued emails too. Each is hidden while its kind is off at the server.
10. **Watching is shared.** One switch per group covers both kinds. The Watching switches are
    disabled (not hidden) only when both email switches are off.
11. **Its own kill switch**, `REPORT_SUBMITTED_EMAILS_ENABLED`, next to
    `CONVERSATION_EMAILS_ENABLED`; each can be turned on in production on its own. The worker runs
    when either is on.

### What the email says

12. **No free text from the report**: no observations, prayer or praise text, not-held reason or
    member names. Only the group, the meeting date, who submitted it, the attendance count for a
    held meeting ("9 of 12 attended": attendance rows, members and guests), and a link to
    `/groups/reports/{id}`.
13. **Wording** (en/es) lives in auth-server's `src/emails/report-submitted.tsx`: a held subject
    ("{group} submitted its report for {date}"), a no-meeting subject ("{group} didn't meet on
    {date}"), *Open report*, and a "why" line pointing to Watching and the switch in My profile.

## Contracts (as built)

- **Event** `small_group_report.submitted` (v1, ids and facts only), written in the submit
  transaction while the kill switch is on; same head start and 24 h deadline as comment events.
  Names and counts are read when the event is processed.
- **Template** `report.submitted` on `POST /internal/notifications`; `data` is strict, with
  `held: true` requiring `attendedCount` and `peopleCount` and `held: false` forbidding them.
- **Preferences** `GET /me/notification-preferences` → `{ email: { reportConversation,
  reportSubmitted }, available: { … } }`; `PUT` takes any subset under `email` in one transaction.
  This replaced Part 2's `{ conversationEmails, emailsEnabled }`.
- No migration: event type and categories are plain strings.

## Later (not in this spec)

- **Daily digest** of submitted reports per watcher, if one email per report is too many: a
  different delivery shape (one email for many events), so its own spec.
- **Push**: another `channel` on the same deliveries and preferences (report conversations rule 22).
- **Missing report reminders** (`small-group-reports.md`, *Not in v1*): a third category in the
  same section.
