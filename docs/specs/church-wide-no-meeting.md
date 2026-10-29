# Church-wide no meeting (cross-repo spec)

When the church cancels small groups for a week (retreat, holiday, a church event), an admin or
elder marks **the whole week as no meeting for every open group** in one step, with an optional
reason. No leader has to mark it for their group. It builds on the per-group no meeting (reports
rule 13).

- **Depends on:** `docs/specs/small-group-reports.md` (rules 1–13, on `main` in both repos) and
  `docs/specs/groups-dashboard.md` (the week view). *Reports rule N* and *dashboard rule N* refer
  to those.
- **Schema change:** yes, a new table and a column on `small_group_reports` (rules 2 and 3).
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/CHURCH-WIDE-NO-MEETING-API-HANDOFF.md`
  - `staff-app/docs/design/CHURCH-WIDE-NO-MEETING.md`
- **auth-server: no change.** The checks below use existing permissions.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page "Small
  group reports", new row "Church-wide no meeting" (button, confirm dialog, week banner, edit
  reason, undo). To be drawn before the staff-app stages.
- **Branch name in every repo:** `church-wide-no-meeting`.

## Implementation order

1. `membership-management`: table and column, next week in the week endpoint, future dates for no
   meetings, the no-meeting-week endpoints.
2. `staff-app`: the stepper going one week ahead, the button and confirm dialog, the banner with
   edit reason and undo. It can start once step 1 runs locally.
   One repo per Claude Code session.

## Rules (decided, don't reopen)

1. **Who:** callers with `smallGroups: all` and `smallGroupReports: create` (mark),
   `update` (edit reason), `delete` (undo); in practice admin and elder. Anyone else is 403.
   Marking needs a linked member, like any report (reports rule 5): 409 otherwise. That member is
   the `submitted_by` of every no meeting the batch creates.
2. **A no-meeting week** is one row in `small_group_no_meeting_weeks`: `week_start` (a church
   Sunday, reports rule 12; **unique**), optional `reason` (≤ 255), `created_by_member_id`,
   `created_at`, `updated_at`. There is at most one per week.
3. **Each group's mark is a normal no meeting** (reports rule 13: `held = false`, no attendance,
   `not_held_reason` = the week's reason) with a new nullable
   `small_group_reports.no_meeting_week_id` (FK, `ON DELETE SET NULL`, only allowed when
   `held = false`). So the week view, lists, Needs follow-up, detail and the replace flow work
   unchanged.
4. **Which weeks:** the current week or **next week** (`week_start <= church_sunday(today) + 7`).
   Past weeks too. Later weeks are 422 `future`. Whole weeks only.
5. **Which groups:** every group **open today** (`closed_at` null) with a `meeting_day`, **with or
   without an active leader**. It gets one no meeting on `D`, the week's date that falls on its
   `meeting_day` (dashboard rule 6). It is **skipped** when it already has **any report dated in
   the week**, of either kind and on any weekday:
   - a held report: the group met, so it stays as filed;
   - a no meeting a leader recorded: it stays as it is, with its own reason, and is **not linked**
     to the week, so undo never removes it.
   Groups without a `meeting_day` are skipped (they never show Not filed).
6. **Running it again** for a week that already has a no-meeting week marks the groups that have
   nothing yet (for example a group opened since) and links them to the **same** row. It doesn't
   change the reason: that is a separate edit. Nothing is ever marked automatically.
7. **Future dates for no meetings:** reports rule 2 becomes "a **held** report: today or earlier;
   **a no meeting: up to the end of next week** (`church_sunday(today) + 13`)", for create and edit
   alike, so editing a future mark's reason works. The staff app's leader flows still offer only
   today or earlier (see *Not in this spec*). A held report is still never dated in the future,
   so a group that met anyway replaces the mark (reports rule 13.5) on or after the day.
8. **Edit reason** changes the week's `reason` and the `not_held_reason` of every report still
   linked to it, in one transaction.
9. **A leader changing their group's mark:**
   - Edit its reason → allowed. The report is **unlinked** from the week (`no_meeting_week_id`
     null), since it now says something else.
   - Delete it, or replace it with a held report → allowed as today. The link goes with the row.
10. **Undo** deletes every report still linked to the week, then the week row, in one
    transaction. Reports a leader unlinked, replaced or recorded themselves stay. A linked report
    of a group closed since is deleted too (undo is the elder's action, not a report edit;
    reports rule 8 doesn't block it).
11. **Week endpoint (dashboard rule 4)** accepts next week. In it, groups with nothing are
    `upcoming` as today, and marked ones `notHeld`. The prayer & follow-up shared endpoint keeps
    refusing future weeks.
12. **Display:** a marked week shows a banner above the week's pills: reason, who marked it and
    when, **Edit reason** and **Undo** (with a confirm). A report linked to a week reads
    "No meeting · church-wide" wherever a no meeting shows (list row, detail, Group detail),
    so leaders can tell it from their own.
13. **Confirm dialog counts** come from the week already loaded (each group's `status`), with no
    preview call: *"Marks N groups. M already filed a report or a no meeting and stay as they
    are. K have no meeting day."* The API's response is the truth after it runs.

## Contracts

### membership-management

| Route | Purpose |
| --- | --- |
| `GET /small-group-reports/week?date=` | Accepts next week (rule 11). Adds `noMeetingWeek` (or `null`). Reports gain `noMeetingWeekId`. |
| `POST /no-meeting-weeks` | Mark (or re-run) a week. 201 the first time, 200 on a re-run. |
| `PATCH /no-meeting-weeks/{id}` | Edit the reason (rule 8). |
| `DELETE /no-meeting-weeks/{id}` | Undo (rule 10). 204. |

Detail and list items (`GET /small-group-reports`, `GET /small-group-reports/{id}`) gain
`noMeetingWeekId: int | null`. The summary doesn't change.

```jsonc
// POST /no-meeting-weeks
{ "date": "2026-11-04", "reason": "Church retreat" }   // any day of the week; reason optional

// 201 / 200
{
  "id": 7,
  "weekStart": "2026-11-01",
  "reason": "Church retreat",
  "createdBy": { "memberId": 12, "name": "Jorge Ramírez" },
  "createdAt": "2026-10-28T15:04:00Z",
  "marked": 22,                       // created by this call
  "skipped": { "reported": 3, "noMeetingDay": 1 }
}

// In GET /small-group-reports/week
"noMeetingWeek": { "id": 7, "reason": "Church retreat",
                   "createdBy": { "memberId": 12, "name": "Jorge Ramírez" },
                   "createdAt": "2026-10-28T15:04:00Z", "linkedCount": 22 }
```

Errors the staff app tells apart (status + a phrase from `detail`, never shown):

| Status | `detail` contains | Meaning |
| --- | --- | --- |
| 403 | | Missing `smallGroups: all` or the report action |
| 409 | `Link your account to a member` | Rule 1, no member |
| 422 | `future` | A week after next (rule 4), or a no meeting dated after next week (rule 7) |
| 404 | | Unknown no-meeting week |

### staff-app

- `WeekStepper` and `parseWeekParam` allow one week past the current one; `?week=` beyond that
  falls back to the current week.
- The button lives in the week section header next to the stepper (`report-week-section.tsx`),
  for full roles, on any week rule 4 allows. Its label reads "Mark no meeting for all groups" when
  the week has no `noMeetingWeek`, and "Mark the remaining groups" when it has one and some
  groups still have nothing (rule 6). Hidden when every group is reported.
- Server actions: `markNoMeetingWeek`, `updateNoMeetingWeekReason`, `undoNoMeetingWeek`
  (revalidate `/`, `/groups/reports`, affected group pages).
- Types: `ReportWeek.noMeetingWeek`, `noMeetingWeekId` on report items.

## Starter prompts (copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/CHURCH-WIDE-NO-MEETING-API-HANDOFF.md` in this repo. Read
> `../docs/specs/church-wide-no-meeting.md` first, then rule 13 of
> `../docs/specs/small-group-reports.md` and rules 4–6 of `../docs/specs/groups-dashboard.md`.
> Stage by stage on branch `church-wide-no-meeting`, one commit per stage, progress log filled
> in. Run `ruff` and `ty` each stage and try every role against the routes.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/CHURCH-WIDE-NO-MEETING.md` in this repo. Read
> `../docs/specs/church-wide-no-meeting.md` first, then open the "Small group reports" page of the
> Staff App canvas, row "Church-wide no meeting". Stage by stage on branch
> `church-wide-no-meeting`, one commit per stage, progress log filled in, light and dark,
> 1440 / 1024 / 390, English and Spanish. The membership-management endpoints must be running
> locally; if they aren't there yet, tell me instead of stubbing.

## Not in this spec

- Leaders marking their own no meeting ahead of time in the staff app (the API allows it after
  rule 7; the leader flows keep today as the latest date).
- Telling leaders about an upcoming church-wide no meeting on their dashboard, or notifying them.
- Part of a week (some days or some groups), and weeks after next.
- Recurring or scheduled cancellations (e.g. "the last week of every month").
- Marking automatically groups opened after the batch ran (an elder runs it again, rule 6).
