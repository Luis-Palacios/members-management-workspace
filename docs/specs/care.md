# Care and the care log (cross-repo spec)

Small group reports and their conversations only capture what happens **in** a group. Pastoral
work also happens outside it: a phone call, WhatsApp messages, a meeting in person or online, a
visit, or someone telling an elder about a member. Today none of that has a home, so it ends up in
conversation comments and gets lost. And some of it isn't one event but **something going on**
(a family crisis, an illness) that has to be followed until it's resolved, without being forgotten.

Four pieces of work, shipped in this order:

- **Part 1: the care log.** A **care log entry** (*registro de cuidado*) records that something
  happened, or is planned: a call, messages, a meeting, a visit, something we heard, a note. It is
  about one or more people (members or guests) and shows on **each person's timeline**. Leaders,
  co-leaders and elders can all log.
- **Part 1b: the care calendar** (added November 24, 2026). Planned entries get **Add to
  calendar** (Google, Outlook, an `.ics` file), carrying only what's needed to show up (rule 48),
  and a **Care calendar** page shows past and future entries by month or as an agenda, *Mine*
  first. Emailed calendar invitations come later, with care emails (rule 44). *(November 25, 2026)*
  Part 1b also brings **an entry's own page** (`/care-log/{id}`, the link leaders send each other;
  rules 56–58) and changes who sees an entry: **people named in *With* see it**, *Elders only*
  included (rules 3 and 8).
- **Part 1c: notes from those who took part** (added November 25, 2026). When several leaders or
  elders took part, each adds **one note** of their own under the entry's summary (rules 59–63).
- **Part 2: care.** A **care** (*acompañamiento*) is something going on that needs following up:
  people, one or more owners, a status, an *Urgent* flag, a **next check-in date** and its own
  stream of updates (care log entries plus events). A **Care** page lists them, with *Needs
  attention* first, so none goes stale. A care can be started from a blank form, a report note, a
  follow-up item, a conversation or a care log entry; the source stays linked.

**Status:** rules agreed (November 6, 2026). Design approved for both parts and repo handoffs
written (November 6, 2026).
**Part 1 (care log) is implemented and merged in all three repos** (November 24, 2026: auth-server
#42, membership-management #80 and #81, staff-app #117 and #118). Decisions taken while building it
are folded into rules 1, 3, 6, 8, 11 and 12 below, each marked *(Part 1 build)*. **Part 1b (care
calendar) is implemented and merged** (November 24, 2026: membership-management #82, staff-app #119;
auth-server and design-canvas had nothing to do). Its build decisions are folded into rules 3, 8, 48,
52 and 56 below, each marked *(Part 1b build)*; the rest lives in the two handoffs' *Part 1b*
sections. **Part 1c (notes)** is next: rules agreed November 25, 2026 (rules 59–63); boards to draw
first. **Part 2 (care) follows**, on
`feature/care`. Report conversations Part 2 (email) is on `main`, so the owner picker's auth-server
endpoint (rule 27) and the outbox for later email (rule 41) exist.

- **Depends on:** `small-group-reports.md` (*reports rule N*; rule 9 observations),
  `report-conversations.md` (*conversations rule N*), `prayer-follow-up.md` (section threads),
  `report-tags.md` (*tags rule N*: the timeline, rules 19–24), `inactive-guests.md` (rule 15, typed
  timeline entries), `guest-small-groups.md` (guest scope, rule 17), `roles-and-permissions.md`
  (*permissions rule N*), `small-group-leader-access.md`.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page **"Care"**.
  Each row's blue rules note matches this spec. Part 1 (approved):
  - Row *Care log · logging care*: `CareLogForm` (tweaks `variant`: `new` | `complete`; `kind`;
    `when`: `done` | `planned`; `from`: `person` | `conversation` | `report`; `visibility`;
    `viewer`; `size`; `lang`; `mode`). Variants: `CareLog-Call`, `CareLog-Planned`,
    `CareLog-Heard`, `CareLog-Complete`, `CareLog-Leader-Message`, `CareLog-Phone-Dark-ES`.
  - Row *on the person timeline*: `PersonTimeline` (tweak `care`: `off` | `on`, plus the existing
    ones) and `MemberDetail` (`care`). Variants: `MemberDetail-Timeline-Care`,
    `MemberDetail-Activity-Care`, `PersonTimeline-Care`, `PersonTimeline-Care-Leader`,
    `PersonTimeline-Care-Filter`, `PersonTimeline-Care-Guest`, `PersonTimeline-Care-Phone-Dark-ES`.
  - Row *Coming up on the dashboards*: `LeaderDashboard` (tweak `care`). Variants:
    `LeaderDashboard-Elder-Care`, `LeaderDashboard-Care`, `LeaderDashboard-Care-Phone-Dark-ES`.
  - Part 2 (approved), Part 2 rows of the same page:
    - *The Care page*: `CareList` (tweaks `tab`: `attention` | `open` | `unread` | `prayer` |
      `closed`; `user`; `state`; `size`; `lang`; `mode`) and `Sidebar` (`care`: `on`, `active`:
      `care`). Variants: `CareList-Open`, `CareList-Leader`, `CareList-Prayer-Leader`,
      `CareList-Empty`, `CareList-Phone-Dark-ES`, `Sidebar-Care`.
    - *A care's page*: `CareDetail` (`care`: `marisol` | `lucia` | `carmen` | `teresa`; `user`;
      `overlay`: `none` | `update` | `close`) and `CareLogForm` (`variant`: `care`, the *Add
      update* form with the next check-in). Variants: `CareDetail-Update`, `CareDetail-Lucia-Leader`,
      `CareDetail-NeedsOwner`, `CareDetail-Close`, `CareDetail-Closed`, `CareDetail-Phone-Dark-ES`.
    - *Starting care, adding to care*: `StartCareForm` (`variant`: `start` | `edit`; `from`:
      `blank` | `followUp` | `observation` | `careLog`; `visibility`; `own`; `viewer`),
      `AddToCareDialog` (`from`: `note` | `careLog`) and `CareMenu` (the row menu: *Log care*,
      *Start care*, *Add to care*, and the linked-care chip). Variants: `StartCare-Blank`,
      `StartCare-FromFollowUp`, `StartCare-Leader-NoOwner`, `StartCare-Leader-Private`,
      `StartCare-FromCareLog`, `StartCare-Edit`, `StartCare-Phone-Dark-ES`, `AddToCare`,
      `AddToCare-Entry`.
    - *On the dashboards and the timeline*: `LeaderDashboard` and `PersonTimeline` / `MemberDetail`
      (`care`: `full`). Variants: `LeaderDashboard-Elder-CareFull`, `LeaderDashboard-CareFull`,
      `MemberDetail-Timeline-CareFull`, `PersonTimeline-CareFull-Leader`.
  - Not drawn: the status menu (open ↔ monitoring) on the status pill; the owner picker's list;
    email (rule 41).
  - **Part 1b (approved November 25, 2026, design-canvas #4; built):** rows *Part 1b · Care
    calendar and Add to calendar* (`CareCalendar`, `CareCalendarEntry`, `AddToCalendarMenu`,
    `AddToCalendar`, `Sidebar` `careCalendar: on`) and *Part 1b · A care log entry's page*
    (`CareLogEntry`). Choices the boards settle: a month cell shows 2 entries, then "+N more"
    (opens the agenda); done soft blue, planned a dashed outline, past due amber; weeks start
    Sunday (en) or Monday (es). *To fix on the board:* `CareCalendar`'s leader *All* hint still says
    *Elders only* entries don't show; since rules 3 and 8 changed, the app reads "Care about people
    in your groups, and entries you wrote or took part in."
  - **Part 1c (to draw, then approve)**, a new row on the same page, its blue rules note matching
    rules 59–63: the timeline row with notes collapsed and open, the note form (add, edit), the
    entry page with its notes and *Add your note*, the calendar panel with notes, phone dark ES.
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/CARE-HANDOFF.md` (small: two resources)
  - `membership-management/docs/CARE-API-HANDOFF.md`
  - `staff-app/docs/design/CARE.md` (uses the filled open-hands `CareIcon` from the canvas's
    `Sidebar` board for care everywhere; prayer keeps the heart)
  - Part 1b: the *Part 1b* sections of the membership-management and staff-app handoffs above
    (done, merged).
  - Part 1c: likewise a *Part 1c* section in the same two handoffs, after its boards are approved.
- **Branch name in every repo:** `feature/care-log` for Part 1, `feature/care-calendar` for Part 1b,
  `feature/care-log-notes` for Part 1c, `feature/care` for Part 2 (the workspace branch hook
  requires the prefix).

## Words

The UI never says "case" or "caso": they sound legal or clinical. Code may use `care_case` where
"care" alone is ambiguous (tables, routes); people never see it.

| Concept | English | Spanish | Code |
| --- | --- | --- | --- |
| Something going on, followed until closed | Care ("Start care", "Open care · 4") | Acompañamiento | `care_case` |
| One recorded event | Care log entry ("Log a call") | Registro de cuidado ("Registrar una llamada") | `care_log_entry` |
| Someone responsible for a care | Owner | Responsable | `owner` |
| Statuses | Open · Monitoring · Closed | Abierto · En observación · Cerrado | `open`, `monitoring`, `closed` |
| The date it must be looked at again | Next check-in | Próxima revisión | `next_check_in_on` |
| No owner yet | Needs an owner | Sin responsable | |
| List of what's overdue or unowned | Needs attention | Requiere atención | |
| Shareable line for prayer | Prayer summary | Resumen para oración | `prayer_summary` |
| Copy a plan into your own calendar | Add to calendar | Agregar al calendario | |
| The page of entries by date | Care calendar | Calendario de cuidado | `care-calendar` |
| Staff who took part in an entry | With ("planned by … with …") | Con | `participants` |
| One participant's own account of it | Note ("Notes from those who took part", "Add your note") | Nota ("Notas de quienes participaron", "Agregar tu nota") | `care_log_entry_note` |

*Pastoral* is avoided in Spanish labels: leaders and co-leaders log care too, not only pastors and
elders.

## Implementation order

Part 1, care log:
1. `auth-server`: the `careLog` resource (rule 40). One stage.
2. `membership-management`: tables and routes for entries (rules 1–12); the `careLog` timeline
   source (rule 13).
3. `staff-app`: the log form, the timeline entry, *Log* on the person page and from report rows and
   conversations, *Coming up* on the dashboards (rule 11).

Part 1b, care calendar: **done** (membership-management #82, staff-app #119, November 24, 2026).

Part 1c, notes (auth-server: nothing):
- `design-canvas` first: the Part 1c boards, approved before any code.
- `membership-management`: the notes table and routes; notes in the entry and the timeline
  (rules 59–63).
- `staff-app`, once that is merged: notes on the timeline row, the entry page and the calendar
  panel.

Part 2, care:
4. `auth-server`: the `care` resource (rule 40). One stage.
5. `membership-management`: tables, the access function (rule 18), create / update / owners /
   status / read routes; entries inside a care; links and *Start care from…* (rules 34–37); the
   Care lists and counts; the `care` timeline source (rule 38); owner options (rule 27).
6. `staff-app`: the Care page, the care page, the start form, *Start care* / *Add to care* from
   each source, the sidebar badge and dashboard blocks.

One repo per Claude Code session, as usual. Part 1 can ship and be used on its own; so can 1b and
1c, each on top of the one before.

## Rules (decided, don't reopen)

### Part 1: the care log

1. **An entry records one event**, done or planned, of one kind:
   - `call`: a phone or video call.
   - `message`: WhatsApp, text or email exchange.
   - `meeting`: with a `mode`, `inPerson` or `online`.
   - `visit`: at their home, hospital, etc.
   - `heard`: someone told us (verbally, by email…). Has a `from` (free text, ≤ 200, e.g. "her
     sister", "Pastor Ruiz by email"). *(Part 1 build)* The API requires it (422 `heard_from`).
   - `note`: anything else worth recording.
2. **About whom:** one or more people (members or guests), picked like tags (`PersonKey`, the same
   search; inactive members are never offered). Plus an optional **Others** free text
   (≤ 200, e.g. "her daughter, 15") for people who aren't in the system. Nobody is created from it.
   Keep it minimal, especially for minors.
3. **With whom (optional):** other staff who took part ("Ana and I met with them"), picked from
   members. *(Changed in Part 1b, November 25, 2026; it was display only.)* **Naming someone gives
   them that entry**: they see it wherever its audience does (rule 8), *Elders only* included, and
   get *Coming up*, *Record how it went* (rule 11), *Add to calendar* and *Mine* on the calendar for
   it. It covers that one entry only: not its people's pages (names link only if they may open that
   person, tags rule 12), and inside a care not the care (rule 9). They don't edit or delete it
   (rule 10). Being named doesn't need `careLog: view`, but a user without it has no page to see it
   on. The form still asks `POST /care-log/audience`, now to say who gains it: for each participant
   who wouldn't see the entry otherwise, "{name} will see this entry, including what you write."
   (on an *Elders only* entry, for every participant who isn't an elder or admin). Adding someone
   to an existing entry warns the same way. A user without a linked member can't be named (the
   picker lists members). *(Part 1b build)* The audience answers `gains: [{ memberId, name }]`, or
   null when auth-server can't be asked (no warning then); never the author, one of the entry's
   people (rule 8 keeps it from them anyway) or a member with no account. Editing warns only for
   people newly added. A participant may complete or cancel a plan they're named on; edit and delete
   stay the author's.
4. **Text:** plain, 1–4000 characters after trimming. A `planned` entry may have none (its purpose
   is optional); completing it requires the outcome text.
5. **Date:** `occurred_on` (church date) and an optional time. A `done` entry can't be in the
   future.
6. **Status:** `done`, `planned` or `cancelled`. `call`, `meeting` and `visit` can be `planned`;
   the others are always `done`.
   - **Complete** a planned entry: set the outcome text and the actual date (defaults to the planned
     one). It becomes `done`.
   - **Cancel** it, with an optional reason. It stays visible as cancelled.
   - A planned entry whose date has passed is **Record how it went** (rule 11) until completed or
     cancelled. *(Part 1 build)* **Past due** counts the time: a plan with a time is past due once
     that time passes in church time (a 3 PM call at 3 PM that day); without a time, the day after
     its date. *Record how it went* is also offered on the plan's own day, before its time; the
     amber badge follows past due only.
7. **Who logs:** anyone with `careLog: create`, about people in their members / guests scope
   (permissions rule 3; guest rule 17). **Needs a linked member**, like conversations rule 5: the
   entry stores the author's `user_id` and `member_id`; without a link, 409 "Link your account to a
   member to log care."
8. **Who sees an entry not inside a care** (`visibility`):
   - `leaders` (default): admins and elders (`careLog: all`), the author, its participants
     (rule 3), and anyone with `careLog: view` who has **at least one of its people** in their
     members / guests scope. That's the observation audience idea (reports rule 9) applied to
     people instead of groups.
   - `private` (*Elders only*): admins and elders, the author and its participants (rule 3). Shown
     as "Elders only" alone when it has no participants who aren't elders, else "Elders only · and
     {names}". *(Part 1b build)* The API doesn't say which participants are elders, so staff-app
     lists every participant; a flag on participants would let it list only the others.
   - A leader who sees an entry sees all its people's names; each name links only if they may open
     that person (tags rule 12).
   - The person themselves never sees it (tags rule 23). *(Part 1 build)* Staff are people too: a
     viewer without `careLog: all` never sees an entry about their own member unless they wrote it
     (a co-leader in their own group's scope included). `careLog: all` still sees everything, about
     themselves too (decided: "only for leaders"). Being a participant doesn't lift this: someone
     named in *With* on an entry about themselves still doesn't see it.
9. **Inside a care** an entry has no visibility of its own: it follows the care's audience
   (rule 18), now and when the care's visibility changes. Its people default to the care's people
   and may be fewer; inside a care, people are optional (a note about the care as a whole). Its
   participants also see that entry (rule 3), outside the care's stream: on its page, the timeline
   and the calendar, with no mention of the care unless they can open it (rules 19, 37).
10. **Edit and delete your own**, any time, like conversations rules 8–9: `edited_at`, previous text
    kept in a revisions table and never returned; soft delete, shown as "Entry deleted · date" in a
    care's stream and removed from timelines. Nobody edits or deletes someone else's entry.
11. **Coming up.** The leader dashboard and the elder Report status page show, under *Waiting for
    your reply* and when there are any: the viewer's past-due planned entries (author or *with*),
    each with *Record how it went*, then their planned entries in the next 7 days. All of them, no
    "see all" link: only your own plans are listed, so the list stays short. Part 2's Care page
    brings the full lists. On the person timeline, planned entries still ahead sit under a *Coming
    up* heading above the months, whatever the date range. *(Part 1 build)* "Past due" follows
    rule 6 (the plan's time counts). *(Part 1b)* Every participant gets their plans here, since
    naming them gives them the entry (rule 3).
12. **Linked source (optional):** an entry can be logged from a report attendance row, a report
    section item or a conversation thread; it keeps a link and shows "From the report of Oct 12 ·
    Nuevos Jueves". The link opens only for viewers who can see the source. Deleting the report
    removes the link, not the entry. *(Part 1 build)* A report item links as its report's
    **section** (`prayer`, `praise`, `followUp`), not the item: editing a report re-creates its
    items, so an item id would break on the first edit. The *Log care* menu sits on each section and
    prefills its tagged people. A source the viewer can't open shows "A report note you don't have
    access to" and nothing else (not even which section). A no-meeting report has no sections.
13. **On the person timeline** (new kind `careLog`, inactive-guests rule 15): every entry the viewer
    can see (rule 8 or 18) that is about that person, at its date. Planned entries show with a
    *Planned* badge; cancelled ones are left out. A **Care** type chip filters them (tags rule 22);
    report counts are unchanged. *Recent activity* includes them. *(Part 1b)* The row's title opens
    the entry's page (rule 56).

### Part 1b: the care calendar

Numbered after rule 46 so the existing rule numbers stay put. Decided November 24, 2026; rules
56–58 and Part 1c (59–63) added November 25, 2026.

#### Add to calendar

47. **Add to calendar** is offered on a **planned** entry (not done or cancelled) to anyone who can
    see it (rule 8; inside a care, rule 18), on the timeline row, the *Coming up* row, the calendar's
    entry panel (rule 54), and as an action in the toast after saving a plan. Three choices:
    **Google Calendar** (a `calendar.google.com/calendar/render?action=TEMPLATE…` link),
    **Outlook** (an `outlook.office.com/calendar/deeplink/compose?…` link) and **Download (.ics)**
    (Apple Calendar, Outlook desktop and anything else). Built in staff-app; no API change, nothing
    stored, no third-party call from our servers.
48. **What leaves the app is the minimum** (calendars get synced to other companies and shared with
    family or assistants):
    - **Title:** the kind and the first person's first name plus initial, in the viewer's language:
      "Call · Óscar A." / "Llamada · Óscar A."; with more people, "+N" ("Visit · Óscar A. +1").
      An *Elders only* entry (`private`) gets a neutral title with no name: "Care call" /
      "Llamada de cuidado" (likewise for meeting and visit).
    - **Description:** one line, "Care log entry in ekklesiaio", and the link to the entry's page,
      `/care-log/{id}` (rule 56; it needs signing in and still applies rule 8). Never the purpose
      or outcome text, *Others*, *heard from*, the participants' names or the visibility.
      *(Changed November 25, 2026: it linked to the calendar with the panel open, before the entry
      had a page.)*
    - **Location:** "Online" / "En línea" for an online meeting; nothing otherwise (no address is
      stored).
    - **When:** the planned date and time in the church's time zone (`CHURCH_TIMEZONE`). Length by
      kind, since a plan has none: call 30 minutes, meeting and visit 1 hour. A plan with no time
      is an all-day event.
    - The `.ics` carries a stable `UID` per entry (`care-log-{id}@` + the app's host), so a client
      that imports it again can recognise it.
    - *(Part 1b build)* Times go out as UTC instants of the church's wall clock (no `VTIMEZONE`);
      the name is the first word and the next word's initial ("Óscar A.").
49. **A copy, not a sync.** Moving, editing or cancelling the plan in the app doesn't change the
    calendar event. The menu says so in one line: "This adds a copy. If the plan changes, update
    your calendar too." Keeping calendars in sync is the later invitations work (rule 44).

#### The calendar page

50. **Care calendar** (`/care/calendar`, sidebar *Care calendar* / *Calendario de cuidado*, needs
    `careLog: view`): the care log entries the viewer can see (rule 8; inside a care, rule 18), past
    and future, done and planned. Cancelled and deleted entries are left out, as on the timeline
    (rule 13).
51. **Views:** **Month** (the default from `md` up; each day lists its entries, "+N more" when they
    don't fit) and **Agenda** (a list by day, the default on phones and available everywhere).
    *Today*, previous and next. The view and the month are in the URL (`?view=month|agenda&month=YYYY-MM`)
    so a link or a reload keeps them.
52. **Filters:** **Mine** (the default for everyone: entries the viewer wrote or is *with*) and
    **All** (everything the viewer can see: for an elder or admin, the whole church; for a leader,
    what rule 8 shares with them). A **group** picker narrows *All* to entries about people
    currently in that group (any group for `careLog: all`, the groups the viewer leads otherwise),
    and **kind** chips (Call, Messages, Meeting, Visit, Someone told us, Note). The filter and group
    are in the URL too. *(Part 1b build)* So are the kinds. The group reach is the small group scope
    (co-led groups and closed ones the viewer led count too); a group the API refuses falls back to
    no group. The month view fetches only the month's own days.
53. **API:** `GET /care-log?from=&to=&mine=&groupId=&kind=` (`careLog: view`), `from`/`to` church
    dates at most 62 days apart (a month view with the days around it), returning
    `CareLogEntrySchema` items ordered by date and time, with the same visibility condition as every
    other read (rule 8 with its participants, rule 3; rule 18 once Part 2 adds cares). `mine` =
    author or participant; `groupId`
    outside the caller's reach is 404; `kind` repeats. No paging within the range; a range over the
    limit is 422 `range`.
54. **An entry on the calendar** shows its kind icon, time (or nothing for all-day), the people's
    names (each a link only if the viewer may open that person, tags rule 12), and a *Planned* or
    amber past-due mark (rule 6). Opening it shows a panel (a dialog from `md` up, a bottom sheet
    below) with the entry as the timeline row shows it, and *Edit*, *Record how it went* and *Add to
    calendar* when they apply (rules 6, 10, 47), and *Open page* (rule 56). *Log care* from the
    page opens the form with the picked day as the date and nobody in *About*; the **+** on a
    month day does the same for that day.
55. **Where it goes in Part 2.** Part 2's **Care** page (rule 39) gains a *Calendar* tab at the same
    route, and its *Care* sidebar item replaces *Care calendar*. A care's own entries show on the
    calendar like any other (inside a care they follow rule 18), with "Care: {title}" in the panel
    for viewers who can open the care (rule 37).

#### An entry's page (added November 25, 2026)

56. **Every entry has a page**, `/care-log/{id}`: the link leaders send each other and the one
    *Add to calendar* puts in the event (rule 48). It shows the entry as the timeline row does, with
    room: kind, status badge (*Planned*, past-due *Record how it went*, *Cancelled*), date and
    time, *About* (names link only if the viewer may open that person, tags rule 12), *Planned by*
    / *By*, *With*, *Where* (meetings), the purpose or *How it went*, why it was cancelled, who can
    see it (rule 8's wording), the source link (rule 12) and when it was logged. Actions as they
    apply: **Copy link** (toast: "Link copied. Only people who can see this entry can open it."),
    *Add to calendar* (rule 47), *Record how it went* (rule 6; also as a banner when past due),
    *Edit* and *Delete* (the author, rule 10). Part 1c adds its notes; Part 2 adds "Care: {title}"
    for viewers who can open the care (rule 37). *(Part 1b build)* *Edit* is hidden on a cancelled
    entry, as on the timeline (the board draws it); *Delete* confirms, then goes to the calendar.
57. **Who can open it:** whoever can see the entry (rule 8 with its participants, rule 3; rule 18
    inside a care). Anyone else, a deleted entry and an unknown id all get the same not-found page
    ("We couldn't find this entry. It may have been deleted, or it isn't shared with you."), with no
    hint which. Signed out: sign-in first, then back to the page. Uses the existing
    `GET /care-log/{id}` (404 outside the audience).
58. **Linked from** the timeline row's title (rule 13), a *Coming up* row (rule 11), the calendar's
    entry panel (*Open page*, rule 54) and the *Add to calendar* description (rule 48). Its
    breadcrumb goes back to the care calendar.

### Part 1c: notes from those who took part

Decided November 25, 2026. When several leaders or elders take part, each tends to give their own
report. One shared text would grow too long for the timeline and blur who said what; separate
entries would show the same meeting several times.

59. **One note per person.** On a **done** entry that has **participants** (rule 3), the author and
    each participant can add **one note** of their own (plain text, 1–4000 characters after
    trimming). The entry's text stays the **summary** (what *Record how it went* wrote). Planned and
    cancelled entries take no notes; an entry with no participants has none (its author has the
    summary).
60. **Who sees the notes:** exactly who sees the entry (rule 8 with rule 3; inside a care, rule 18).
    No separate visibility.
61. **Edit and delete your own note,** like rule 10: `edited_at`, previous text kept in a revisions
    table and never returned; soft delete (the note just disappears). Nobody edits another's note,
    the entry's author included. A participant removed from *With* keeps their note on the entry
    (it's still part of what happened) but stops seeing the entry. Deleting the entry hides its
    notes with it.
62. **Where they show:**
    - **Timeline row:** collapsed under the summary, "2 notes from those who took part", opening in
      place. Collapsed again when the page reloads.
    - **Entry page (rule 56):** open under *How it went*, each with its writer and date (and
      "edited"); *Add your note* for anyone on the entry who hasn't written one, *Edit* / *Delete*
      on your own.
    - **Calendar panel (rule 54):** open, like the page, with *Add your note*.
    - *Recent activity* and the calendar's month cells don't show them.
63. **Quiet:** a missing note isn't a task. Nothing in *Coming up*, no badge, no reminder, no
    notification. Adding a note doesn't change the entry's date or status.

### Part 2: care

#### What a care is

14. **A care has:** a title (≤ 120), a description (≤ 4000), people (one or more, like rule 2, plus
    Others), owners (zero or more, rule 24), a status, an *Urgent* flag, a visibility (rule 17), a
    next check-in date, an optional prayer summary (rule 32), and a stream (rule 29).
15. **Starting a care is deliberate.** The form asks for title, people, what's going on, who can see
    it (no default: the starter picks), owners and next check-in. It carries one line of guidance:
    *Write only what's needed to care well. Choose carefully who can see it.* Most things stay a
    care log entry, a report note or a conversation; a care is for what needs following over time.
16. **Who starts one:** anyone with `care: create`, about people in their scope (like rule 7, linked
    member required).

#### Who sees it

17. **Visibility** (who can open the care), chosen by the starter, changed later by owners and
    `care: all`:
    - `private`: *Elders and owners*.
    - `peoplesLeaders`: *Elders, owners and these people's leaders* (anyone with `care: view` who has
      at least one of its people in scope).
    - `allLeaders`: *All leaders* (everyone with `care: view`), for things shared with every leader
      for follow-up or prayer.
18. **One access function** decides who can open a care, used by every route, list, count and
    timeline source (as conversations rule 23):
    `care: all` → yes; otherwise needs `care: view` and one of: an owner; `peoplesLeaders` with a
    person in scope; `allLeaders`. Starting a care doesn't give access by itself: a leader who
    starts a `private` care without owning it loses it (the form warns).
19. **No hint of what you can't open.** Outside the audience a care is 404, and it appears nowhere:
    not in lists, counts, timelines, or as "linked to a care" on its sources. The one exception is a
    prayer summary someone chose to share (rule 32).
20. **Admins are treated exactly as elders** for now: both roles get `care: all` and `careLog: all`.
    Nothing checks the role name, so splitting them later is a change in `statements.ts` only.
21. **Losing access is immediate:** a leader who steps down, whose person leaves their group, or who
    is removed as owner stops seeing the care on the next request.

#### Status, check-ins, urgent

22. **Status:** `open` → `monitoring` (acute part over, keep an eye on it) → `closed`. Any order
    between open and monitoring. **Closing** needs a closing note; **reopening** asks for a new
    check-in date. Owners and `care: all` change the status.
23. **Next check-in** (church date) is required while open or monitoring, null when closed. When
    starting or changing status the form suggests: urgent 3 days, open 14, monitoring 30 (constants
    in v1).
    - **No silent snoozing:** the date moves only together with an update by an owner or `care: all`
      (a care log entry inside the care; a `note` is enough). The update form shows *Next check-in*
      pre-filled with the suggestion.
    - **Overdue** when the date is before church today; **due** on the day.
    - Updates by anyone else don't move the date: the owners are still responsible.

#### Owners and awareness

24. **Owners** are zero or more members linked to users who have `care: view` and can open the care.
    A leader can own a care: often the leader is the one who walks with the person, and the elders
    just need to know.
25. **Needs an owner:** a care with no owners. Anyone who can open it can **Take it** (become its
    owner); that clears it for everyone (a shared queue, like conversations rule 12).
26. **Adding and removing owners:** owners and `care: all`. An elder **steps in** by adding
    themselves next to the leader, without taking it away. Removing the last owner makes it *Needs
    an owner* again.
27. **The owner picker** lists linked members whose users have `care: view`, from auth-server's
    `GET /internal/users/with-permission` (report conversations Part 2). That's why Part 2 of this
    spec waits for it. For `private` and `peoplesLeaders` cares, picking an owner gives them access
    (rule 18); the form says so.
28. **Awareness is per person**, like conversations rule 11: a care is **unread** for you when it's
    new or has an update (entry or event) by someone else after your `last_read_at`. Opening the
    care marks it read (explicit `POST …/read`). That's how elders know what's going on without
    having to act.

#### The stream

29. **One stream; updates are the discussion** (no separate comment thread). Newest first by
    default, it mixes:
    - care log entries inside the care (rule 9), including planned ones;
    - events: started (and from what, rule 34), status changed, urgent set or cleared, owners
      added or removed, visibility changed, people added or removed, closed (with the note),
      reopened. Events are written by the server, never edited.
30. **Editing the care** (title, description, people, Others, prayer summary): owners and `care:
    all`. Previous values go to a revisions table, never returned. People changes appear as events.
31. **Closed cares stay readable** and still take entries, but reopening is the way to bring one
    back into *Needs attention*.

#### Prayer

32. **Prayer summary (optional, ≤ 280):** a line the owners choose to share with **all leaders**
    (`care: view`) whatever the visibility, e.g. *"Pray for the Pérez family: a hard season with
    their teenage daughter."* It shows on the Care page's **For prayer** tab with its date and who
    shared it, **without** the title, people or a link unless the viewer can open the care. Writing
    names in it is the owner's choice. Clearing it hides it everywhere.
33. **Not on Prayer & follow-up** in v1, and **no WhatsApp copy** of prayer summaries yet (rule 45).

#### Starting from something else

34. **Start care from…** (pre-fills people and description, links the source):
    - a report attendance row with an observation (Report detail), for viewers in the observation
      audience (reports rule 9);
    - a report section item (prayer, praise or follow-up), prefilled with the item's tagged people;
    - a conversation thread (person or section);
    - a care log entry, which moves inside the new care (its visibility then follows the care, and
      the form warns if that narrows or widens who sees it).
35. **Add to care…** on the same sources links them to an existing open care the viewer can update.
    A care log entry moves inside it (same warning).
36. **Links, not copies:** the stream shows "Started from the report of Oct 12 · Nuevos Jueves" (or
    "Linked …") and opens the source only for viewers who can see it; others see "A report note you
    don't have access to". The description holds whatever the starter chose to quote. Deleting the
    report or the thread removes the link and leaves an event saying it was deleted.
37. **On the source,** viewers who can open the care see "Care: {title}" with a link (report row,
    item, thread panel, entry). Everyone else sees nothing (rule 19).

#### Where it shows

38. **On the person timeline** (new kind `care`): a *Care started* and, when closed, a *Care
    closed* entry for each care about that person the viewer can open, linking to it. Covered by
    the **Care** chip (rule 13).
39. **The Care page** (`/care`, nav **Care** / *Acompañamientos*, needs `care: view`):
    - Tabs: **Needs attention**, **Open** (open and monitoring), **Unread**, **For prayer**,
      **Closed**. Counts on each. *Needs attention* lists: every care the viewer can open that has
      no owner; the viewer's own cares that are overdue, due today or urgent; and, with `care: all`,
      everyone's overdue, due and urgent cares. Urgent first, then by check-in, ownerless ones
      ahead of others on the same rank.
    - Filters: *Mine* (I'm an owner) / *All*; *Urgent*; group (cares with a person in that group).
    - A row shows title, people, owners (or *Needs an owner*), status, *Urgent*, last update and next
      check-in (overdue in red, due in amber).
    - **Sidebar badge:** your *Needs attention* count: cares you own that are overdue or due, plus,
      with `care: all`, cares with no owner. A leader's badge never counts other people's cares.
    - **Dashboards:** *Care needing attention*, up to 3 *Needs attention* rows with a link to the
      Care page, at the top of the leader dashboard and the elder Report status page (above
      *Waiting for your reply*), hidden when there are none (like conversations rule 16). *Coming
      up* (rule 11) stays below.

### Permissions

40. **New resources** in `auth-server/src/permissions/statements.ts`:
    - `careLog`: `all`, `view`, `create`. With `all`, every entry; without, rule 8.
    - `care`: `all`, `view`, `create`, `update`. With `all`, every care; without, rule 18.
      `update` covers adding entries and taking an unowned care; owner-only actions (status,
      check-in, owners, visibility, editing) are checked by ownership on top.
    - **Roles:** `admin`, `elder`: all of both. `smallGroupLeader`, `deacon`: `careLog: view,
      create`; `care: view, create, update`. `user`, `pending`: nothing.
    - Also: the typed unions in staff-app `lib/auth/permissions.ts` and the route table in
      membership-management `docs/ARCHITECTURE.md` (permissions spec, *Changing what a role can
      do*).

### Not in this spec (later)

41. Reminders by email: a new care to elders, *Needs an owner*, overdue check-ins to owners,
    updates to owners. They'd use report conversations Part 2's outbox and *watching*-style
    preferences. A Part 3 once Part 2 is in use.
42. Configurable check-in suggestions, care categories or tags, attachments, @mentions.
43. The person seeing anything about their own care (never, unless a later spec says otherwise).
44. Push notifications, calendar invites for planned meetings, syncing with WhatsApp. *(Updated
    November 24, 2026)* **Calendar invitations** go with rule 41's care emails (a Part 3): an `.ics`
    invitation emailed to the author and to participants who can see the entry (rule 3), through
    the outbox and an auth-server template with an attachment, with updates and a cancellation
    sent when the plan changes (same `UID`, higher `SEQUENCE`, `METHOD:CANCEL`), the content of
    rule 48, and an on/off preference. Weigh then, instead of or beside it, a **personal calendar
    feed** (one private subscribe link per user, kept in sync, with *Reset link*). Direct Google or
    Outlook account integration stays out.
45. Prayer summaries on Prayer & follow-up and *Copy for WhatsApp* for them.
46. A safeguarding policy (who must be told, what may be written down for minors). Nothing official
    exists today; if one is adopted, it likely forces `private` plus named owners for some cares.

## Data model (sketch for the handoffs)

membership-management, own Postgres. `user_id` columns are strings with no foreign key (auth-server
is another database). A "person" column pair is `member_id` / `guest_id`, exactly one set (check
constraint), as for tags.

| Table | Columns (beyond `id`) |
| --- | --- |
| `care_log_entries` | `kind`, `meeting_mode` null, `status`, `occurred_on`, `occurred_at_time` null, `text` null, `heard_from` null, `others` null, `visibility` null (null inside a care), `care_case_id` null FK, `author_user_id`, `author_member_id` FK, `completed_at` null, `cancel_reason` null, source link columns (rule 12), `created_at`, `edited_at`, `deleted_at` |
| `care_log_entry_people` | `entry_id` FK cascade, person pair; unique per entry and person |
| `care_log_entry_participants` | `entry_id` FK cascade, `member_id` FK |
| `care_log_entry_revisions` | `entry_id` FK, `text`, `created_at` |
| `care_log_entry_notes` (Part 1c) | `entry_id` FK cascade, `author_user_id`, `author_member_id` FK, `text`, `created_at`, `edited_at`, `deleted_at`; unique per entry and author member among rows not deleted |
| `care_log_entry_note_revisions` (Part 1c) | `note_id` FK, `text`, `created_at` |
| `care_cases` | `title`, `description`, `others` null, `prayer_summary` null, `prayer_summary_by_member_id` null, `prayer_summary_at` null, `status`, `urgent`, `visibility`, `next_check_in_on` null, `started_by_user_id`, `started_by_member_id`, `created_at`, `last_activity_at`, `closed_at` null, `closing_note` null |
| `care_case_people` | `care_case_id` FK cascade, person pair; unique |
| `care_case_owners` | `care_case_id` FK cascade, `member_id` FK, `user_id`, `added_by_user_id`, `added_at`; unique |
| `care_case_events` | `care_case_id` FK cascade, `kind`, `data` jsonb, `by_user_id`, `by_member_id` null, `created_at` |
| `care_case_links` | `care_case_id` FK cascade, `source_kind` (`attendance`, `section`, `conversation`), source columns null FK (set null on delete), `created_by_user_id`, `created_at` |
| `care_case_reads` | `care_case_id` FK cascade, `user_id`, `last_read_at`; unique |
| `care_case_revisions` | `care_case_id` FK, `field`, `value`, `by_user_id`, `created_at` |

`last_activity_at` works like conversations rule 17 (set on every entry and event, never moved
back) and drives *Unread* and ordering.

## Contracts (sketch; the handoffs fix the details)

- `POST /care-log`, `GET /care-log/{id}`, `PATCH /care-log/{id}`, `DELETE /care-log/{id}`,
  `POST /care-log/{id}/complete`, `POST /care-log/{id}/cancel`, `GET /care-log/coming-up`,
  `GET /care-log/people-search`, `POST /care-log/audience` *(Part 1 build: rule 3's warning)*.
- Part 1b: `GET /care-log?from=&to=&mine=&groupId=&kind=` (rule 53). *Add to calendar* is built in
  staff-app from the entry it already has (rules 47–48). The participants change (rule 3) widens
  the visibility condition behind every read (`GET /care-log/{id}`, `coming-up`, the timeline
  source, `GET /care-log`); `POST /care-log/audience` then reports who **gains** the entry instead
  of who misses it (the handoff fixes the field names). The entry page (rule 56) uses
  `GET /care-log/{id}`.
- Part 1c: `POST /care-log/{id}/notes`, `PATCH /care-log/{id}/notes/{noteId}`,
  `DELETE /care-log/{id}/notes/{noteId}`; `CareLogEntrySchema` gains `notes` (writer, text, dates,
  `canEdit`) and `canAddNote`; the timeline's `careLog` item gains the notes too (or a count, the
  handoff decides). Errors: 403 when the caller isn't the author or a participant, 409 when they
  already have a note, 422 when the entry isn't done or has no participants.
- `GET /members|guests/{id}/timeline` gains entries of kind `careLog` (Part 1) and `care` (Part 2).
  staff-app skips kinds it doesn't know, so the API can ship them first.
- `GET /care-cases?tab=attention|open|unread|prayer|closed&mine=&urgent=&group=`,
  `GET /care-cases/counts`, `POST /care-cases`, `GET /care-cases/{id}` (with the stream),
  `PATCH /care-cases/{id}`, `POST /care-cases/{id}/status`, `POST /care-cases/{id}/take`,
  `POST|DELETE /care-cases/{id}/owners[/{memberId}]`, `POST /care-cases/{id}/read`,
  `POST /care-cases/{id}/links`, `GET /care-cases/owner-options`.
- Errors staff-app tells apart (status + a phrase from `detail`): 409 `link` (no linked member),
  422 `check-in` (missing or in the past), 422 `closing note`, 403 `owner` (owner-only action),
  404 for anything outside the audience.
