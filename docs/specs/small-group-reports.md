# Small group reports (cross-repo spec)

A small group files **one report per meeting**: where it met, what the group shared (prayer
requests, praise, points for the elders) and an attendance line for **every** member active in the
group that day (came to the meeting, was at church the Sunday before, optional pastoral note).
Admins and elders see every group's reports; leaders and deacons see and work on the reports of
the groups they lead or co-lead ("My reports").

- **Depends on:** `docs/specs/small-group-leader-access.md`. Its scope (rules 2, 3, 4, 11) and
  rule 10 apply to reports from the start; implement it first in both repos.
- **Already in the database:** `small_group_reports` and `small_group_report_attendances`
  (models in `membership-management/src/membership_management/data/small_groups/models/`,
  migration `1282e2f6b5ff`, seed `data/seed/small_group_reports.py`). **No schema change is
  expected.**
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/SMALL-GROUP-REPORTS-API-HANDOFF.md`
  - `staff-app/docs/design/SMALL-GROUP-REPORTS.md`
- **auth-server: no change.** `smallGroupsReport` statements are already granted to the roles
  below.
- **Design:** Staff App canvas, page "Small group reports"
  (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1). Its blue "rules" note matches this spec.
- **Branch name in every repo:** `small-group-reports`.

## Implementation order

1. `membership-management`: report endpoints, roster for a date, list with "not filed" rows,
   summary for the dashboard.
2. `staff-app`: list, detail, new/edit flow, entry points. It can start once step 1 runs locally.
   One repo per Claude Code session.

## Rules (decided, don't reopen)

Rules from the leader access spec are referred to as *access rule N*.

1. **One report per group per meeting date** (unique `small_group_id, meeting_date`). A second one
   for the same date is 409 and names the existing report, so the UI can link to it.
2. **Dates:** any date up to **today in the church's time zone** (`church_today()`), not only the
   group's meeting weekday. Future dates are refused (422).
3. **Attendance is complete.** The report has exactly one row for each member whose membership
   period covers the meeting date (`joined_at <= date` and (`left_at` is null or `left_at >=
   date`)). Missing or extra rows are 422. "Absent" is always an explicit `false`.
4. **Who can do what** (by role, then scope from the leader access spec):
   - `admin`, `elder`: view, create, edit and delete every group's reports.
   - `smallGroupLeader`, `deacon`: the same, only for groups in their scope. A deacon is treated
     exactly like a leader here.
   - Any other role: 403.
   - Outside the scope: 404 (access rule 4). Former leaders see nothing (access rule 3).
5. **Submitting needs a member** (access rule 10). `submitted_by_member_id` = the caller's member.
   An admin or elder with no linked member can view, edit and delete, but create is 409 "Link your
   account to a member to submit reports." A scoped caller must also hold `leader` or
   `co_leader` in that group **on the meeting date** (422 otherwise); full roles don't.
6. **Submitted by / at never change.** Editing keeps the original submitter and timestamp. Any
   leader or co-leader of the group (or a full role) may edit or delete, whoever submitted it.
7. **Edit and delete any time.** No time window.
8. **Closed groups are read-only.** Reports of a closed group can be viewed (by full roles and by
   the leaders when it closed, access rule 11) but not created, edited or deleted: 409.
9. **Observations are pastoral and private.** An attendance row's `observation` is returned only
   to callers with the **`admin`** or **`elder`** role and to the report's **submitter** (the
   caller's member is `submitted_by_member_id`). Everyone else, including the group's other leaders
   and deacons, never receives it: not in the detail, not in lists, not in the summary. When such a caller edits a report, observations they
   can't see are left untouched (the field is ignored, not cleared).
10. **"Not filed"** is computed, never stored. For each group in scope with a `meeting_day`, every
    date in the last **28 days** before today that falls on that weekday, while the group was open
    (`closed_at` null or the date `<= closed_at`) and had an active `leader` or `co_leader`, with
    no report, is a *not filed* meeting. Today never counts (the meeting may be tonight). Groups
    without a meeting day never show it.
11. **"Missed the last N meetings"** is computed per member from that group's previous reports
    (strictly before the date): the count of consecutive most recent reports where the member was
    a row with `attended_group = false`. Shown from 2 up. Reports where the member had no row
    don't break or extend the streak.
12. **Church Sunday** for a meeting date is the most recent Sunday on or before it (the same day if
    the meeting is a Sunday). The API returns it so both apps agree.
13. **No meeting** (added Oct 2026; handoffs `membership-management/docs/SMALL-GROUP-NO-MEETING-API-HANDOFF.md`
    and `staff-app/docs/design/SMALL-GROUP-NO-MEETING.md`, branch `small-group-no-meeting`; this one
    **does** change the schema: `small_group_reports.held`, `not_held_reason`).
    1. A leader or co-leader of an open group can record that the group didn't meet on a date
       (today or earlier), with an optional reason (≤ 255). It is stored as that date's report with
       `held = false`, no attendance rows and no group texts, so it occupies the date like a report
       (rule 1) and follows rules 2, 4–8.
    2. A no-meeting date is never Not filed / Due, and doesn't count toward Needs follow-up (rule 10).
    3. It is not a Last report, not Filed in counts, has no attendance and is skipped by
       missed-meeting streaks (rule 11) and attendance figures.
    4. Its reason is visible to everyone who can view the group's reports (not private like rule 9).
    5. Creating a held report on a no-meeting date is allowed only with `replacesNoMeeting: true`;
       the no meeting is deleted and the report inserted in one transaction. The reverse is never
       allowed (delete the report first).

## Contracts

### membership-management

Reuse `require_roles`, `get_current_member` and the small group scope dependency from the leader
access work. Routes (camelCase JSON, `CamelModel`):

| Route | Purpose |
| --- | --- |
| `GET /small-group-reports` | List: filed reports and not-filed meetings, filters, counts, paging |
| `GET /small-group-reports/summary` | Per group in scope: last report and not-filed dates (dashboard) |
| `GET /small-groups/{id}/report-roster?date=` | Who goes in a report for that date; existing report id; church Sunday |
| `POST /small-groups/{id}/reports` | Create |
| `GET /small-group-reports/{id}` | Detail (observations per rule 9) |
| `PATCH /small-group-reports/{id}` | Edit (whole report replaced, rule 9 for observations) |
| `DELETE /small-group-reports/{id}` | Delete (attendance cascades) |

Shapes, errors and stages: `membership-management/docs/SMALL-GROUP-REPORTS-API-HANDOFF.md`.

Errors the staff app tells apart (matched on status and `detail`, never shown):

| Status | `detail` contains | Meaning |
| --- | --- | --- |
| 409 | `already a report` | Duplicate date (response also has `existingReportId`) |
| 409 | `Link your account to a member` | Rule 5, no member |
| 409 | `closed` | Rule 8 |
| 422 | `future` | Rule 2 |
| 422 | `attendance` | Rule 3 (stale roster: reload the form) |
| 422 | `didn't lead` | Rule 5, scoped caller not a leader on that date |

### staff-app

- Routes: `/groups/reports` (list), `/groups/reports/new` (`?groupId=` preselects the group),
  `/groups/reports/[id]`, `/groups/reports/[id]/edit`. The Reports nav item already exists.
- `getSmallGroupAccess(role)` from the leader access work picks full vs *My reports*. `getMe()`
  tells "not linked" from "leads nothing" for the empty states and disables **New report** for an
  unlinked full role (rule 5).
- The new-report flow always asks: *One person at a time* or *Quick list*. Both end on the same
  full list, which is also the edit screen. Submit needs every person marked.
- Entry points: a "Recent meetings" card on Group detail and a leader dashboard ("My groups").

## Starter prompts (copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/SMALL-GROUP-REPORTS-API-HANDOFF.md` in this repo. Read
> `../docs/specs/small-group-reports.md` and `../docs/specs/small-group-leader-access.md` first
> for the rules. The leader access stages must already be on `main`; if not, tell me and stop.
> Stage by stage on branch `small-group-reports`, one commit per stage, progress log filled in.
> Run `ruff` and `ty` each stage and try every role against the routes.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/SMALL-GROUP-REPORTS.md` in this repo. Read
> `../docs/specs/small-group-reports.md` first, then open the "Small group reports" page of the
> Staff App canvas for each stage's boards. Stage by stage on branch `small-group-reports`, one
> commit per stage, progress log filled in, light and dark, 1440 / 1024 / 390, English and
> Spanish. The membership-management report endpoints must be running locally; if they aren't
> there yet, tell me instead of stubbing.

## Not in this spec

- Notifications or reminders for not-filed reports (email, WhatsApp).
- Report exports, printing and charts over time.
- Uploaded member photos (the avatar is initials; a photo later uses the same circle).
- Former leaders seeing past reports (access rule 3 stays).
- Drafts saved on the server (the staff app keeps an unsent draft in the browser only).
