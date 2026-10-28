# Report items, person tags and the person timeline (cross-repo spec)

Two pieces of work that build on each other:

- **Part 1: items and tags.** In a small group report, *Prayer requests*, *Praise* and *For the
  elders to follow up* stop being one free-text block each and become **lists of items**. An item
  can **tag** members or guests (`@Gabriela`), from any group. Report detail, Prayer & follow-up and
  the conversation panel show the items with person chips.
- **Part 2: the person timeline.** Member detail and Guest detail get **Profile · Timeline** tabs.
  The Timeline tab lists every report the person was on the attendance list of or was tagged in,
  with a date range (last 3 months by default), group and type filters. The Profile tab gets a
  *Recent activity* card.

**Status:** built in staff-app and membership-management (Part 1 and Part 2) and design-reviewed in
October 2026. Only the decisions are kept here; the code and the repo handoffs hold the rest. Still
open in staff-app (`docs/design/REPORT-TAGS.md`): a screen-reader pass on the editor, a touch
`(hover: none)` pass and a full focus-order pass.

- **Depends on:** `small-group-reports.md` (the three texts, rule 9 observations),
  `prayer-follow-up.md` (the shared endpoint, section threads, WhatsApp copy),
  `guest-small-groups.md` (guests, `PersonKey`, guest search rule 14 and scope rule 17),
  `inactive-members.md` (inactive members never in pickers), `small-group-leader-access.md` (scope).
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page **"Tagging
  people"** (report form, where tags show, Profile and Timeline tabs, `PersonTimeline`).
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/REPORT-TAGS-API-HANDOFF.md`
  - `staff-app/docs/design/REPORT-TAGS.md`
- **auth-server: no change.** No new permission, no email (rules 13 and 24).
- **Branch name in every repo:** `report-tags` for Part 1, `person-timeline` for Part 2.

## Order it was built in

Part 1 was expand / contract (the report body changed shape): API stages 1–4, staff-app Part 1,
then API stage 5 (drop the old text fields) only after staff-app Part 1 was deployed. Part 2 (the
timeline endpoints, then the tabs) has no ordering constraint beyond the endpoint existing first.

## Rules (decided, don't reopen)

### Items

1. **Each of the three sections is a list of items**, in the order the leader wrote them. An item
   is one request, one reason to be thankful, or one point for the elders. Order:
   `prayer`, `praise`, `followUp` (the keys section threads already use).
2. **Writing:** Enter in an item starts the next item; pasting text with line breaks makes one
   item per line (leading `-`, `•`, `*` and `1.` / `1)` markers are dropped). An item has no line
   breaks of its own. Empty items (blank after trimming) aren't saved. A section with no items is
   empty, exactly as an empty text was.
3. **Limits:** up to 20 items per section, up to 1024 characters per item (the old section limit),
   up to 10 tags per item.
4. **An item with no tag is about the group as a whole.** No flag, no extra UI.
5. **Older reports:** each section's text becomes items, one per line, with list markers dropped
   (rule 2). Nothing is tagged automatically. Opening an older report in the edit form shows a
   banner saying so (board `ReportForm-Tags-Edit-Elder`). Suggesting tags from the text comes later
   with the LLM features, not here.

### Tags

6. **Who can tag:** whoever can create or edit the report (the group's leaders and co-leaders, and
   elders and admins when they edit). No new permission.
7. **Who can be tagged:** any **active member** (of any group or none) and any **guest**. A member
   who becomes inactive stays tagged on existing items; they can't be newly tagged. Nobody is created
   from the picker; someone who isn't in the system stays plain text.
8. **Picker** (typing `@` in an item, or the item's person button):
   - Results in this order: **At this meeting** (people on this report marked as came), **In {this
     group}** (the rest of the roster, absent ones with the amber *missed this meeting*), then
     **Everyone else in the church** (church-wide search, members and guests).
   - Each result shows enough to tell people apart: members their role and group (or *not in a
     group*); guests their group and the last 4 phone digits, plus the *Guest* pill.
   - Church-wide search starts at 2 characters. People already tagged in that item aren't offered.
   - Not listed: the name stays plain text (the footer says so).
9. **Person button with nothing typed:** first **Named in this item** (people at this meeting
   whose first name already appears as a word in the item, in order of appearance), then the rest of
   **At this meeting**. Picking a name that's already written **turns that word into the tag**;
   otherwise the tag goes at the cursor.
10. **Church-wide search is new reach for leaders, on purpose.** Today a leader of a member group
    can't search guests (guest rule 17). Here any report writer can find any active member and any
    guest **by name**, and sees only what rule 8 lists: name, group, role, last 4 phone digits. No
    email, address, notes or attendance. This is what makes tagging across groups possible.
11. **Chip:** the person's **first name**; first name + last initial (*Pablo S.*) when two people
    tagged in the same report share a first name. Full name in the tooltip and for screen readers.
    Members: soft accent fill. Guests: outline with the waving hand. Pages always show the person's
    **current** name, so a rename carries through.
12. **Links:** a chip opens the person's page (Timeline tab, Part 2) when the viewer may open it:
    admins and elders, anyone; leaders, people in their members or guests scope. Otherwise it's a
    plain chip, not a link.
13. **No notifications** of any kind. Tagging someone tells nobody.

### Where items and tags show

14. **Report detail**, *What the group shared*: each section is a list (gold dot per item) with
    chips. A section with no items shows *Nothing shared this week.* as today. Section conversation
    indicators are unchanged.
15. **Conversation panel** (section threads): the context box lists the section's items with chips.
16. **Prayer & follow-up**: each entry lists its items with chips; nothing else about the page
    changes (rules 5–18 there). The page's group/leader search also matches tagged people's names.
17. **Copy for WhatsApp:** one line per item, starting with `• `, tagged people as **plain first
    names** (no `@`, no last names). Otherwise rule 13 of `prayer-follow-up.md` holds.
18. **Section threads:** a section can start a thread when it has at least one item (was: non-empty
    text). The rest of section threads is unchanged.

### The person timeline (Part 2)

19. **Tabs.** Member detail and Guest detail get **Profile** (what the page shows today) and
    **Timeline**, under the person's header, each its own route: `/members/{id}`,
    `/members/{id}/timeline`, `/guests/{id}`, `/guests/{id}/timeline`. Same access as the page today.
20. **Recent activity** card on the Profile tab, top of the right column: the **3 newest rows** the
    viewer can see (same rows as the Timeline), and *See full timeline*. On Guest detail it replaces
    *Recent meetings*. Hidden when there are no rows.
21. **Rows:** one per **held** report where the person is on the attendance list **or** tagged in
    an item, newest first, grouped under month headings with the number of reports. A row shows the
    date, group, the person's role there, attendance (came / church on Sunday), the observation about
    them (*Note from {submitter}*), and **only the items that tag them**, by section. Their own chip
    is solid; other chips follow rule 12. A row where only a tag is visible says *Tagged in this
    report*. A row with nothing visible to the viewer isn't shown.
22. **Filters:**
    - **Dates:** *Last 3 months* (default), *Last 6 months*, *This year*, *Custom range* (From/To,
      never in the future; at most 2 years). In the URL: `?range=3m|6m|year`, or
      `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`.
    - **Group:** *All groups* or one of the groups with a visible row (any time). `?group={id}`.
    - **Type chips:** *All*, *Notes*, *Prayer*, *Praise*, *Follow-up*, with
      counts for the dates and group. Page state, not in the URL. A type hides attendance-only rows.
    - A summary line under the filters: *11 reports · Jul 16 – Oct 15, 2026* (· group when one is
      picked).
    - **Show 3 more months** moves the start back 3 months (it becomes a custom range). When nothing
      older exists: *That's everything since her first report* (guests: *since her first visit*;
      leaders: *That's everything you can see for {name}*).
    - **Phone:** dates and group behind one *Filters* button (bottom sheet, *Show N reports*); the
      type chips scroll sideways.
23. **Who sees what on the timeline:**
    - **Admins and elders** (`smallGroups: all` + `smallGroupReports: viewObservations`): everything.
    - **Leaders** (anyone else in the person's members / guests scope, i.e. leading one of the
      person's current groups): attendance, observations **and follow-up items only from reports of
      groups they lead or co-lead** (the observation audience, reports rule 9); **prayer and praise
      items from any group's report**. Follow-up items from other groups' reports are never shown to
      them.
    - **The person themselves never sees it** (no member access exists). If that changes, notes
      and follow-up stay hidden from them.
24. **No notifications, no export, no printing** in Part 2.

### Not in this spec

25. Marking a prayer request as answered, item-level conversations, LLM tag suggestions and
    summaries, notifications to tagged people or their leaders, merging duplicate people.

## Contracts

The endpoints, bodies and errors live in the code and in `membership-management/docs/REPORT-TAGS-API-HANDOFF.md`
(tag search, `sections` on reports, `GET /members|guests/{id}/timeline`). Errors the staff app tells
apart (status + a phrase from `detail`): 422 `tag` (an unknown person or a newly tagged inactive
member), 422 `items` (more than 20 items or 10 tags), 422 `range` (from after to, in the future, or
longer than 2 years).

## Known gaps (decided not to do, October 2026)

- **Timeline and Recent activity chip names (rule 11).** The timeline returns only the items that
  tag the person, so it can't see a same-first-name person tagged only in another item of the same
  report (report 53: *Kevin Ú.* and *Kevin M.* both show *Kevin* there). The report pages, the
  conversation panel, Prayer & follow-up and *Copy for WhatsApp* do disambiguate. Fixing it needs
  the timeline API to return a per-report short name.
