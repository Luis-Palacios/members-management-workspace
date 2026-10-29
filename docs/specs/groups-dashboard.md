# Groups dashboard (cross-repo spec)

> *Update (Oct 2026):* the menu labels changed in `prayer-follow-up.md`: **Groups** is now
> **Report status** and **Staff** is **Applications & access** (URLs unchanged), with **Prayer &
> follow-up** between them. Leaders and deacons now get Dashboard ▸ **My groups** / **Prayer &
> follow-up** instead of a single item.

Dashboard becomes a nested menu for admins and elders: **Dashboard ▸ Groups** (where they land,
`/`) and **Dashboard ▸ Staff** (today's dashboard: applications, users and invites,
`/dashboard/staff`). The Groups dashboard keeps what leaders already get (*My groups*) and adds,
for admins and elders, a **weekly view** of every open group's report and a **Needs follow-up**
card for groups that are behind or have no leader. Leaders and deacons keep a single Dashboard
item with their own groups, unchanged.

- **Depends on:** `docs/specs/small-group-reports.md` (on `main` in both repos). Its rules are
  referred to as *reports rule N*. Rule 9 (observations), 10 (not filed), 12 (church Sunday)
  matter most here.
- **Already in the database:** everything. **No schema change is expected.**
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/GROUPS-DASHBOARD-API-HANDOFF.md`
  - `staff-app/docs/design/GROUPS-DASHBOARD.md`
- **auth-server: no change.** No new role or permission.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page "Small
  group reports", row "Dashboard ▸ Groups · admin/elder weekly view". Its blue note matches this
  spec. The Staff boards are `Dashboard` / `Dashboard-Dark` on page "Dashboard & applications";
  the menu is the `Sidebar` board (tweak `user` and `active`).
- **Branch name in every repo:** `groups-dashboard`.

## Implementation order

1. `membership-management`: two more fields on the summary, then the week endpoint.
2. `staff-app`: menu and routes, then the Groups dashboard. It can start once step 1 runs locally.
   One repo per Claude Code session.

## Rules (decided, don't reopen)

1. **Menu by small group access** (`getSmallGroupAccess`):
   - `full` (admin, elder): Dashboard ▸ **Groups** (`/`, the landing page) / **Staff**
     (`/dashboard/staff`). Groups is listed first.
   - `scoped` (leader, deacon): a single **Dashboard** item (`/`), the leader dashboard as today.
   - `none`: a single **Dashboard** item (`/`) showing the Staff dashboard, as today.
2. **Staff dashboard** = today's admin/elder dashboard minus the *My groups* section and the
   "No groups yet" card. Both move to the Groups dashboard.
3. **Groups dashboard for full roles**, top to bottom: greeting, **Needs follow-up**, **the week**,
   **My groups** (only the groups the user's member leads or co-leads, hidden when none; today's
   `ledOnly` behaviour). With no open groups at all, the "No groups yet" card replaces the follow-up
   card and the week.
4. **Week = Sunday to Saturday**: `[church_sunday(d), church_sunday(d) + 6]` for any date `d`
   (reports rule 12), so a report's week and its church Sunday always agree. Default: the week of
   the church's today. Any past week can be shown; a week after the current one is refused.
   *(Changed by `church-wide-no-meeting.md`, rule 11: next week is allowed too.)*
5. **Groups in a week:** groups that are **open today**. Closed groups never show, not even in past
   weeks (they can't take a report, reports rule 8).
6. **Status of a group in a week**, first match wins. `D` is the week's date that falls on the
   group's `meeting_day`.
   1. `submitted`: at least one report with `meeting_date` in the week (any weekday, reports
      rule 2). All of them are returned, newest first.
   2. `noMeetingDay`: the group has no `meeting_day`.
   3. `noLeader`: no `leader` or `co_leader` membership period covers `D` (if `D` is today or
      earlier) or today (if `D` is later). Same per-date test as reports rule 10.
   4. `notFiled`: `D` is before today. The staff app labels it **Due** in the current week and
      **Not filed** in past weeks.
   5. `today`: `D` is today (the meeting may be tonight; reports rule 10 never counts today).
   6. `upcoming`: `D` is after today.
7. **Numbers on a submitted row** come from its newest report in the week: *at the meeting* =
   `attendedGroupCount` of `rosterCount`; *observations* = how many attendance rows have an
   observation. Only admins and elders may see that count (reports rule 9), so the week endpoint
   is for full roles only.
8. **Order** (staff app): `notFiled`, `today`, `upcoming`, `submitted`, `noLeader`,
   `noMeetingDay`, then group name.
9. **Needs follow-up** is about *now*, not the week being viewed:
   - Open groups with **2 or more** not-filed meetings in the reports-rule-10 window (the 28 days
     before today), most first, then by name. Each shows that window's meeting dates (at most the
     last 4, oldest to newest), filed or not filed.
   - Open groups with **no active leader or co-leader today**.
   - When nothing qualifies, the card is not shown. The threshold is one constant in the staff app
     (`FOLLOW_UP_MIN_NOT_FILED = 2`).
10. **Where things link:**
    - submitted row → the newest report (`/groups/reports/{id}`);
    - `notFiled` row and a behind group in follow-up → that group's not-filed meetings:
      `/groups/reports?groupId={id}&status=notFiled&from={today − 28 days}`;
    - every other row, and a no-leader group in follow-up → the group (`/groups/{id}`).
11. **Leaders and deacons** get no weekly view and no follow-up card. They keep *My groups* on
    their dashboard.

## Contracts

### membership-management

| Route | Change |
| --- | --- |
| `GET /small-group-reports/summary` | Adds `hasLeader` and `recentMeetings` to each group. Scope and roles unchanged. |
| `GET /small-group-reports/week?date=` | New. Admin and elder only (403 otherwise). |

```jsonc
// Summary item: new fields only
{
  "hasLeader": true,                      // an active leader or co-leader today
  "recentMeetings": [                     // newest first: every date reports rule 10 looks at
    { "date": "2026-10-14", "reportId": null },   // in the 28-day window, filed or not
    { "date": "2026-10-07", "reportId": null },
    { "date": "2026-09-30", "reportId": null },
    { "date": "2026-09-23", "reportId": 402 }
  ]
  // "notFiledDates" stays, equal to the recentMeetings dates with reportId null
}

// Week (GET /small-group-reports/week?date=2026-10-15; date optional, default today)
{
  "weekStart": "2026-10-11",
  "weekEnd": "2026-10-17",
  "today": "2026-10-15",
  "isCurrentWeek": true,
  "groups": [                             // open groups, by name
    {
      "smallGroup": { "id": 5, "name": "Universitarios UNI", "meetingDay": 3 },
      "leaders": [ { "memberId": 151, "name": "Marco Antonio Pérez", "role": "leader" } ],
                                          // active today: leader, then co-leaders by name
      "status": "notFiled",               // submitted | notFiled | today | upcoming | noLeader | noMeetingDay
      "meetingDate": "2026-10-14",        // D; null when meetingDay is null
      "reports": []                       // dated in the week, newest first
    },
    {
      "smallGroup": { "id": 2, "name": "Mujeres de Fe", "meetingDay": 2 },
      "leaders": [ … ],
      "status": "submitted",
      "meetingDate": "2026-10-13",
      "reports": [
        { "id": 431, "meetingDate": "2026-10-13", "rosterCount": 12, "attendedGroupCount": 10,
          "attendedChurchCount": 9, "observationCount": 2,
          "submittedBy": { "memberId": 198, "name": "Elena Morales" } }
      ]
    }
  ]
}
```

Errors the staff app tells apart (status + a phrase from `detail`, never shown):

| Status | `detail` contains | Meaning |
| --- | --- | --- |
| 422 | `future` | `date` is in a week after the current one (rule 4) |
| 403 | | Not an admin or elder |

### staff-app

- Routes: `/` (Groups for full roles, the leader dashboard for scoped, Staff for `none`) and
  `/dashboard/staff` (full roles; anyone else is redirected to `/`).
- The week is chosen with `?week=YYYY-MM-DD` (a week's Sunday) on `/`. Missing, malformed or
  future → the current week.
- Nav: `config/site.ts` gets the Dashboard item per access level (rule 1).
- Types and client: `ReportSummaryGroup` gains `hasLeader` and `recentMeetings`; new
  `ReportWeek` types and `getSmallGroupReportWeek(date?)`.

## Starter prompts (copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/GROUPS-DASHBOARD-API-HANDOFF.md` in this repo. Read
> `../docs/specs/groups-dashboard.md` first, then `../docs/specs/small-group-reports.md` for the
> rules it refers to. Stage by stage on branch `groups-dashboard`, one commit per stage, progress
> log filled in. Run `ruff` and `ty` each stage and try every role against the routes.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/GROUPS-DASHBOARD.md` in this repo. Read `../docs/specs/groups-dashboard.md`
> first, then open the "Small group reports" page of the Staff App canvas for the boards (row
> "Dashboard ▸ Groups · admin/elder weekly view") and the `Sidebar` board. Stage by stage on branch
> `groups-dashboard`, one commit per stage, progress log filled in, light and dark,
> 1440 / 1024 / 390, English and Spanish. The membership-management summary fields and week
> endpoint must be running locally; if they aren't there yet, tell me instead of stubbing.

## Not in this spec

- Reminders or notifications for due reports (email, WhatsApp).
- Trends over several weeks, charts, exports.
- Observation text on the dashboard (only the count; the text stays in report detail).
- A weekly view for leaders or deacons, or deacons overseeing groups they don't lead.
- Closed groups in past weeks.
- Making the follow-up threshold a church setting.
