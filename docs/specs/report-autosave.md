# Report auto-save: drafts on the server (cross-repo spec)

Small group leaders came from Google Sheets, where nothing is ever lost. Today a report is only kept
in the browser that started it (`localStorage`, new reports only, keyed by group and exact date),
and the edit screen keeps nothing, so leaders who "forgot to save" sometimes start over. This spec
makes every report **auto-save to the server** from the first change, adds a **Draft / Submitted**
state, and keeps a device copy as an offline buffer.

- **Depends on:** `small-group-reports.md` (rules 1–13), `small-group-leader-access.md` (scope),
  `report-tags.md` (items), `report-conversations.md`, `prayer-follow-up.md`,
  `groups-dashboard.md`, `guest-small-groups.md`. All are on `main`.
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/REPORT-AUTOSAVE-API-HANDOFF.md`
  - `staff-app/docs/design/REPORT-AUTOSAVE.md`

  Both are committed on each repo's `report-autosave` branch (not merged to `main`).
- **auth-server: no change.** Starting a draft and submitting use `smallGroupsReport: create`;
  saving uses `update`; discarding uses `delete`. Every role that files reports already has all
  three.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page **"Report
  auto-save"**. Its blue rules note matches this spec.
- **Branch name in every repo:** `report-autosave`.

## Implementation order

1. `membership-management` stages 1–5 (expand): schema, draft-blind reads, draft writes, draft
   reads. The old staff app keeps working throughout: a create without `status` still makes a
   submitted report, and a PATCH without `version` is still accepted.
2. `staff-app` (all stages). Starts once API stage 4 runs locally.
3. `membership-management` stage 6 (contract): `version` becomes required on PATCH and submit, the
   create default becomes `draft`. Only after the new staff app is deployed.

## Rules (decided, don't reopen)

### States

1. **A report is `draft` or `submitted`.** Every report that exists today becomes `submitted`. A
   no meeting (`held = false`) is always `submitted`; it is never a draft.
2. **A draft occupies its date** exactly like a report (rule 1 of the reports spec, the unique
   `(small_group_id, meeting_date)` is unchanged). Opening that date again continues the draft;
   nobody gets a second one.
3. **Drafts are dated today or earlier** (reports rule 2). No future drafts.
4. **A draft can be incomplete:** people may have one or both answers missing, and the sections
   may be empty. The attendance rows still match the roster for the date (reports rule 3); only
   the two answers may be null.
5. **Submit is one-way.** It needs both answers for every person (absent stays an explicit `false`)
   and the same caller checks as creating a report today (reports rule 5: a linked member; a
   scoped caller must lead or co-lead the group on the meeting date). It sets `submitted_by`
   (the caller's member) and `submitted_at` (now); reports rule 6 applies from then on. There is
   no "back to draft". Submitting is the only event that will send email later.

### Saving

6. **Auto-save everywhere:** new reports, drafts and submitted reports. There is no Save button.
   - A new report becomes a draft on its **first change** after group and date are chosen.
   - Taps (yes/no, mode, adding/removing an item or a tag) save at once.
   - Text saves when the field loses focus and after about 3 seconds without typing.
7. **Each save sends the whole report** (the existing PATCH shape) plus the `version` it was
   based on. One save is in flight at a time; later changes wait and go out as one.
8. **Device first.** Every change is written to the device before it is sent, and removed when the
   server confirms it. Offline, the leader keeps working and the indicator says *Saved on this
   device*; the device copy is sent when the connection is back.
9. **Two writers:** if the report changed since the version a save was based on, the save is
   refused (409). The editor shows who changed it and a **Reload**; the refused change is not
   merged. No live presence, no field-level merge.
10. **Submitted reports keep auto-saving** and the changes are visible right away. The report shows
    *Last edited by {name} · {time}*. Edit has **Done**, no Save or Cancel.
11. **Roster drift:** if the roster for the date changed since the draft was last saved (someone
    joined or left with an earlier date), the editor adds the new people unanswered, drops the
    ones who no longer belong, and shows a one-line notice. The API refuses a save whose rows
    don't match the roster (422 `attendance`, as today), which is how the editor finds out.

### Coming back

12. **A draft opens on the full list** with its progress (*5 of 8 answered · 3 to go*). Group, date
    and the attendance mode are not asked again. **Continue one at a time** starts at the first
    person with **either** answer missing; once everyone is answered it reads **Go through one at
    a time** and starts at the first person. Date and place change from the list (*Change date or
    place*), with the duplicate-date check as today.
13. **Leaving keeps the draft.** The new-report screen's Cancel becomes **Back to My reports**.
    Only **Discard draft** (with a confirm that says what is deleted) removes it.

### Who sees a draft

14. **Only the group's current leaders and co-leaders** (the leader-access scope), **plus whoever
    started it**. Admins and elders don't see other people's drafts.
15. **Everyone else sees a label only:** *Draft started* on that date's row in Report status and in
    Reports, with no link and no content. The date still counts as **Due / Not filed** everywhere,
    including Needs follow-up and the 28-day window (reports rule 10), until it is submitted.
16. **A draft does not exist** for anything else: Prayer & follow-up, tags and person timelines,
    missed-meeting streaks (rule 11), attendance figures, Last report, filed counts, the guests
    pages (last attended), conversations (none can start on a draft) and, later, email.
17. **Someone who can't see a date's draft can't file that date either:** creating a report there is
    409 *a draft is in progress*. The leaders continue it.

### Other states

18. **No meeting on a date with a draft:** a confirm, then the draft is replaced by the no meeting in
    one transaction (`replacesDraft: true`). Only someone who can see the draft can do it.
19. **Closing a group discards its drafts** (in the same transaction). The close dialog says how many.
20. **A draft is never deleted automatically.** It stays until it is submitted or discarded.
21. **Old browser drafts:** on first open of a group and date that has an old `ekk-report-draft:*`
    entry and no server draft, the staff app creates the server draft from it once and removes the
    entry.

## Contracts

### membership-management

Schema (`small_group_reports`, migration on `report-autosave`):

| Column | Change |
| --- | --- |
| `status` | **New**, text, `draft` \| `submitted`, not null, default `submitted` (backfill: all `submitted`) |
| `submitted_by_member_id`, `submitted_at` | Become **nullable**; CHECK: both null when `draft`, both set when `submitted` |
| `started_by_member_id`, `started_at` | **New.** Who and when the report was first saved (backfill: the submitter and `submitted_at`) |
| `last_edited_by_member_id`, `last_edited_at` | **New**, nullable. Last save after the first one (member null for an unlinked admin) |
| `version` | **New**, int, not null, default 1. +1 on every write |

`small_group_report_attendances.attended_group` and `attended_church` become **nullable**. The
service makes sure a submitted report never has a null (rule 5); the DB can't check across tables.

Routes (camelCase JSON, unchanged ones not listed):

| Route | Change |
| --- | --- |
| `POST /small-groups/{id}/reports` | Body gains `status` (`draft` \| `submitted`; default `submitted` until stage 6, then `draft`). A draft allows null answers. Response has `id`, `status`, `version` |
| `PATCH /small-group-reports/{id}` | Body gains `version`. Draft: null answers allowed. Submitted: complete, as today. Bumps `version`, sets `lastEdited*` |
| `POST /small-group-reports/{id}/submit` | **New.** `{ version }`. Checks rule 5, sets status, submitter, time. 200 with the detail |
| `DELETE /small-group-reports/{id}` | Unchanged; a draft can be deleted by anyone who can see it (rule 14) |
| `POST /small-groups/{id}/reports` (no meeting) | Gains `replacesDraft: true` (rule 18) |
| `GET /small-group-reports/{id}` | Gains `status`, `version`, `startedBy`, `startedAt`, `lastEditedBy`, `lastEditedAt`. A draft the caller can't see is 404 |
| `GET /small-groups/{id}/report-roster?date=` | `existingReport` gains `status`; for a draft the caller can't see: `{ status: "draft" }` with no id |
| `GET /small-group-reports` | Draft rows (`kind: "draft"`) for those who see them; `hasDraft` on not-filed rows otherwise |
| `GET /small-group-reports/summary` | Per group: `draft` (id, date, answered / roster count, `lastSavedAt`) when the caller sees one |
| `GET /small-group-reports/week` | `hasDraft` on `notFiled` / `today` rows. Status is unchanged (rule 15) |
| Every other report read | Filters `status = 'submitted'` (rule 16) |

Errors the staff app tells apart (status + a phrase from `detail`, never shown):

| Status | `detail` contains | Meaning |
| --- | --- | --- |
| 409 | `changed since` | Version conflict (rule 9). Body also has `version`, `lastEditedBy`, `lastEditedAt` |
| 409 | `draft is in progress` | Someone else's draft holds the date (rule 17) |
| 409 | `already submitted` | Submit on a submitted report |
| 409 | `draft` (conversations) | Starting a conversation on a draft (rule 16) |
| 422 | `incomplete` | Submit with an answer missing (rule 5) |
| 422 | `attendance` | Rows don't match the roster: reload it (rule 11) |

The existing reports errors (`already a report`, `Link your account`, `closed`, `future`,
`didn't lead`) are unchanged.

### staff-app

- **One editor** for a draft and a submitted report at `/groups/reports/[id]/edit`; `/new` hands
  over to it with `router.replace` after the first save, so a reload resumes the server draft.
  `EditReportForm` and the browser-draft code are removed.
- The save queue, device outbox and indicator live in one client module (the handoff names it).
- My reports, the leader dashboard and Group detail show drafts to the people who see them;
  Reports and Report status show *Draft started* to everyone else.

## Starter prompts (copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Check out the existing `report-autosave` branch (it holds the handoff). Implement stages 1–5 of
> `docs/REPORT-AUTOSAVE-API-HANDOFF.md` in this repo. Read
> `../docs/specs/report-autosave.md` first for the rules, then `../docs/specs/small-group-reports.md`.
> Stage by stage on branch `report-autosave`, one commit per stage, progress log filled in. Run
> `ruff` and `ty` each stage and try every role against the routes. Don't start stage 6.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Check out the existing `report-autosave` branch (it holds the handoff). Implement
> `docs/design/REPORT-AUTOSAVE.md` in this repo. Read `../docs/specs/report-autosave.md`
> first, then open the "Report auto-save" page of the Staff App canvas for each stage's boards.
> Stage by stage on branch `report-autosave`, one commit per stage, progress log filled in, light
> and dark, 1440 / 1024 / 390, English and Spanish. The membership-management `report-autosave`
> stages 1–4 must be running locally; if they aren't there yet, tell me instead of stubbing.

## Not in this spec

- The submit email to elders (it hooks onto the submit transition, through the outbox pattern of
  `report-conversations.md` Part 2).
- Live presence ("Lucía is editing"), field-level merging, edit history of a report.
- Drafts for future dates, automatic expiry of old drafts.
