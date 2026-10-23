# Prayer & follow-up (cross-repo spec)

A new dashboard page, **Dashboard ▸ Prayer & follow-up**, that gathers the three group texts of
every small group report (all groups for admins and elders, their own groups for leaders) in a Sunday–Saturday week (prayer requests, praise,
"for the elders to follow up") on one page. Elders can copy a prayer request or praise as a
WhatsApp message, and start a conversation about one of those texts. The same work renames the
other two Dashboard items: **Groups → Report status** and **Staff → Applications & access**.

**Status:** designed (desktop, 1024, 390, light and dark, English and Spanish, elder and leader),
October 2026. Not started in any repo.

- **Depends on:** `small-group-reports.md` (the three texts, rule 12 church week),
  `groups-dashboard.md` (the Dashboard submenu, the week rules), `report-conversations.md` Part 1
  (on `main`; this spec adds **section threads**, which its rule 2 left for later),
  `small-group-leader-access.md` (scope).
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page
  **"Small group reports"**, row **"Dashboard ▸ Prayer & follow-up · admin/elder weekly view"**:
  boards `PrayerFollowUp` (this week) and `PrayerFollowUp-LastWeek`, both clickable in Play, and
  `ReportDetail-SectionNew` / `ReportDetail-SectionThread` for section threads on Report detail, and
  `PrayerFollowUp-SectionNew` / `PrayerFollowUp-SectionThread` for the panel open on this page. Its
  blue rules note matches this spec. The menu is the `Sidebar` board (tweak `user` and `active`;
  `active = dashPrayer`). Applications & access is `Dashboard` / `Dashboard-Dark` on page
  "Dashboard & applications".
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/PRAYER-FOLLOW-UP-API-HANDOFF.md`
  - `staff-app/docs/design/PRAYER-FOLLOW-UP.md`
- **auth-server: no change.** No new permission (rule 3).
- **Branch name in every repo:** `prayer-follow-up`.

## Before email (Part 2 of report conversations)

Report conversations **Part 2 (email notifications) is still pending, and stays pending until this
feature is on `main`.** It's a learning exercise to be worked slowly, one change at a time (see
`report-conversations.md`), and it's next after this one.

Nothing here sends email or touches the outbox design. But section threads change three things Part
2's handoffs assumed (every thread is about a person, links use `?person=`). They're listed in
[Changes for Part 2](#changes-for-report-conversations-part-2) below, and each Part 2 handoff has a
note pointing here. **Update those handoffs when this feature lands, before Part 2 starts.**

## Implementation order

1. `membership-management`: the week's shared texts endpoint (stage 1), then section threads
   (stages 2–4).
2. `staff-app`: menu renames and the new route, the page, WhatsApp copy, then section threads on
   the page and on Report detail. The page can start once stage 1 above runs locally; the
   conversation stages need stages 2–4.

One repo per Claude Code session, as usual.

**Deploy order matters for section threads.** Today's staff-app reads `item.member.name` on every
Conversations row (`conversations/_components/conversation-row.tsx`, also used by *Waiting for your
reply*). A section thread has `member: null`, so the current code would crash on the first one.
Deploy staff-app stage 2 (anchor union, null-safe rows) **before or with** membership-management
stage 3 (the first route that can create a section thread). Until staff-app stage 6, section
threads are left out of those lists rather than shown half-done.

## Rules (decided, don't reopen)

### Menu

1. **Full roles (admin, elder)** get Dashboard ▸ **Report status** (`/`, still the landing page) /
   **Prayer & follow-up** (`/dashboard/prayer`) / **Applications & access**
   (`/dashboard/staff`, URL unchanged). Spanish: *Estado de reportes* / *Oración y seguimiento* /
   *Solicitudes y acceso*. Only the labels and the page titles change for the two renamed items.
2. **Scoped roles (leader, deacon)** get Dashboard ▸ **My groups** (`/`, the leader dashboard as
   today, still where they land) / **Prayer & follow-up** (`/dashboard/prayer`, their groups only).
   Spanish: *Mis grupos* / *Oración y seguimiento*. On the page, the header link and the *still to
   report* link say *My groups* and go to `/`. A scoped user who leads no group sees the leader
   dashboard's "You don't lead a small group yet" empty state. `none` keeps a single Dashboard item
   and is redirected away from `/dashboard/prayer`.

### Who sees what

3. **No new permission.** The page needs `smallGroupReports: view`, like the reports list. The
   three texts aren't pastoral the way observations are (reports rule 9): anyone who can see a
   report sees them.
4. **Scope:** the small group scope, as everywhere. Full roles: every group. Scoped roles: the
   groups they lead (rule 2).

### The week and the entries

5. **Week = Sunday to Saturday**, the same week as Report status (`groups-dashboard.md` rule 4).
   Any past week; a week after the current one is refused. The URL carries it as
   `?week=YYYY-MM-DD` (that Sunday), clamped like Report status.
6. **One entry per held report** whose `meeting_date` falls in the week, for groups open today
   (`groups-dashboard.md` rule 5). No-meeting reports have no texts and never appear. A group with
   two reports in the week has two entries.
7. **Three sections, in this order:** Prayer requests (`group_prayer_request`), Praise
   (`group_praise_report`), For the elders to follow up (`group_relevant_discussion`). A report
   whose field is empty (null or blank after trimming) isn't listed in that section. A section with
   no entries shows one quiet line.
8. **Order inside a section:** meeting date, oldest first, then group name.
9. **Each entry shows** the group, its current leaders, the meeting date and the text as written
   (line breaks kept), plus *View report* and the conversation control (rule 14). Prayer and praise
   entries also get *Copy for WhatsApp* (rule 11).
10. **Filter chips** above the sections: *All* (default) · *Prayer* · *Praise* · *Follow-up*, each
    with its count of entries. A chip shows only that section. The filter is page state, not in the
    URL.
11. **Still to report:** a note under the chips lists the open groups that may still add texts
    this week (Report status `notFiled` / *Due*, `today`, `upcoming`), or that didn't file in a past
    week (`notFiled`), with a link to Report status. Hidden when there are none. Groups with no
    leader or no meeting day aren't listed.

### WhatsApp copy

12. **Copy only, never share.** No share sheet (Web Share API) and no `wa.me` links, on any device:
    the elder pastes the text where they mean to, so nothing lands in a WhatsApp Status or another
    app by accident. **Copy for WhatsApp** on each prayer and praise entry. **Copy all for WhatsApp** on Prayer
    requests when 2 or more entries. **Never on follow-up** (internal pastoral items).
13. **Format** (WhatsApp markup, plain text on the clipboard, the viewer's language for titles and
    dates):
    - One entry: `*{Section title} · {Group}* ({short meeting date})`, newline, the text.
    - Copy all: `*Prayer requests · {week range}*`, a blank line, then one block per entry (`*{Group}*
      ({date})`, newline, text) separated by blank lines.
    - No leader names, no links.
    After copying, a toast: *Copied for WhatsApp* · *Check names and details before you share it.*
    If the clipboard isn't available, an error toast; nothing else changes.

### Conversations on sections

14. **Section threads** extend `report-conversations.md` (its rule 2 is lifted):
    - **One thread per report section**: unique `(report_id, section)`, `section` in `prayer`,
      `praise`, `followUp`. A thread is about a person **or** a section, never both.
    - **Starting one needs text in that section** (422 otherwise). If the text is later cleared,
      the thread stays and still opens (like a person edited off a report).
    - **Everything else is the same** as person threads: audience (rule 3 there), linked member to
      comment, sides, edit/delete own, resolve/reopen, unread, *needs your reply*, closed groups,
      cascade on report delete.
    - **API anchor:** `{ "type": "section", "key": "prayer" | "praise" | "followUp" }`, next to the
      existing `{ "type": "attendance", "memberId": n }`.
    - **Deep link:** `/groups/reports/{id}?section={key}` opens the panel on that section (as
      `?person=` does for a row).
15. **On this page**, an entry with no thread shows *Start a conversation*; with a thread, the
    comment count (amber when it needs your reply). Both open the conversation panel **on this page**,
    over the list, without leaving it: the entry gets the gold edge, the filter and scroll are kept,
    and the URL becomes `/dashboard/prayer?week=…&report={id}&section={key}` (Back closes it, links
    can be shared). It's the Report detail panel (header, context box with the section text,
    composer, resolve) plus a *View full report* link. Closing it refreshes that entry's count.
    With no thread it opens on the composer, focused.
16. **On Report detail**, each section of *What the group shared* gets the same conversation
    indicator as an attendance row, and the panel shows the section's title and text as its
    context (*Shared by {submitter} in the report* and the text). A section with no text shows no
    control. Boards: `ReportDetail-SectionNew`, `ReportDetail-SectionThread`.
17. **Inbox and dashboards**: section threads appear in Conversations and in *Waiting for your
    reply* like any other thread. Where a row shows the person's name, it shows the section title
    instead (*Prayer requests*, *Praise*, *For the elders to follow up*).

### Not in v1

18. Marking a request or follow-up as handled, date ranges or "last 4 weeks", printing, exporting,
    and editing the texts from this page.

## Contracts

### membership-management

New route (shapes are camelCase `CamelModel`):

| Route | Purpose |
| --- | --- |
| `GET /small-group-reports/shared?date=` | The week's entries and the groups still to report. `smallGroupReports: view`, scoped. |

```jsonc
// GET /small-group-reports/shared?date=2026-10-15 (date optional, default the church's today)
{
  "weekStart": "2026-10-11",
  "weekEnd": "2026-10-17",
  "today": "2026-10-15",
  "isCurrentWeek": true,
  "entries": [                              // held reports in the week, oldest meeting first
    {
      "reportId": 431,
      "meetingDate": "2026-10-13",
      "smallGroup": { "id": 2, "name": "Mujeres de Fe" },
      "leaders": [ { "memberId": 198, "name": "Elena Morales", "role": "leader" } ],
      "prayer": "Urgent: for Carmen Úbeda's mother…",   // null when empty after trimming
      "praise": "Andrea led the study for the first time…",
      "followUp": null,
      "conversations": {                    // section threads only; a key is absent when no thread
        "prayer": { "id": 77, "status": "open", "commentCount": 3, "unread": true, "needsMyReply": true }
      }
    }
  ],
  "stillToReport": [                        // open groups in scope; statuses as the week endpoint
    { "smallGroup": { "id": 5, "name": "Universitarios UNI" }, "status": "notFiled", "meetingDate": "2026-10-14" },
    { "smallGroup": { "id": 7, "name": "Jóvenes Bello Horizonte" }, "status": "today", "meetingDate": "2026-10-15" }
  ]
}
```

Section threads: one migration, the anchor union, and two routes beside the person ones.

| Route | Change |
| --- | --- |
| `GET /small-group-reports/{id}/conversations` | Summaries now include section threads; every item carries `anchor` (clients must read it, not assume `memberId`) |
| `GET /small-group-reports/{id}/conversations/sections/{key}` | New. One section thread; 404 when none yet |
| `POST /small-group-reports/{id}/conversations/sections/{key}/comments` | New. Add a comment; creates the thread; 422 when the section is empty |
| `GET /report-conversations` (inbox) | Rows carry `anchor`; `member` is null for section threads |
| Edit, delete, resolve, reopen, read | Unchanged (they work by conversation or comment id) |

Errors the staff app tells apart (status + a phrase from `detail`): 422 `future` (shared, as the
week), 422 `section is empty` (start a section thread on an empty section), 422 `section` (unknown
key), plus the existing conversation errors.

### staff-app

- Routes: `/dashboard/prayer` (full and scoped roles; `none` is redirected to `/`), `?week=` as on `/`,
  plus `?report={id}&section={key}` for the open panel (rule 15).
  `/` and `/dashboard/staff` keep their URLs.
- Nav: the full roles' Dashboard submenu gets three children (rule 1), the scoped roles' Dashboard
  becomes a two-item submenu (rule 2); keys renamed to match the labels.
- Report detail: `?section={key}` opens the panel on a section (staff-app stage 5).
- Types and client: `ReportShared` types and `getSmallGroupReportShared(date?)`; the conversation
  anchor becomes a union and every place that reads `memberId` from a summary checks the type.

## Changes for report conversations Part 2

Apply to the three Part 2 handoffs when this feature is on `main`, before Part 2 starts:

- **membership-management** (`REPORT-CONVERSATIONS-EMAIL-API-HANDOFF.md`, stage 2): `path` is
  `/groups/reports/{report_id}?section={key}` for a section thread. The payload gains
  `topic`: `"person"` | `"prayer"` | `"praise"` | `"followUp"`. Recipients don't change.
- **auth-server** (`REPORT-CONVERSATIONS-EMAIL-HANDOFF.md`, stages 2–3): accept `topic` (validate
  it); the "new conversation" body has a section variant, e.g. **{actor}** started a conversation
  about the **prayer requests** in the **{group}** report for **{date}** (ES: … sobre las
  **peticiones de oración** del reporte de **{group}** del **{date}**). The privacy rule holds: never
  the section text. Accept `?section=` paths as well as `?person=`.
- **staff-app** (`REPORT-CONVERSATIONS-EMAIL.md`, stage 3): the sign-in return must keep
  `?section=` as it keeps `?person=`; the phone panel opens for both.

## Starter prompts (copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/PRAYER-FOLLOW-UP-API-HANDOFF.md` in this repo. Read
> `../docs/specs/prayer-follow-up.md` first, then `../docs/specs/report-conversations.md` (Part 1
> rules; Part 2 is out of scope) and `../docs/specs/groups-dashboard.md` (week rules). Stage by
> stage on branch `prayer-follow-up`, one commit per stage, progress log filled in. Run `ruff` and
> `ty` each stage and try every role in the handoff's list against the routes. No email and no
> outbox.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/PRAYER-FOLLOW-UP.md` in this repo. Read
> `../docs/specs/prayer-follow-up.md` first, then open the "Small group reports" page of the Staff
> App canvas (row "Dashboard ▸ Prayer & follow-up") and the `Sidebar` board. Stage by stage on
> branch `prayer-follow-up`, one commit per stage, progress log filled in. The membership-management
> shared endpoint (and, for the conversation stages, section threads) must be running locally; if
> they aren't there yet, tell me instead of stubbing.

## Not in this spec

- Email for any conversation, including section threads: report conversations Part 2, next.
- Rule 18's list: handled flags, ranges, printing, exports, editing texts here.
- Push notifications for urgent prayer requests.
