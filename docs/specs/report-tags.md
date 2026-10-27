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

**Status:** designed (desktop, 1024, 390, light and dark, English and Spanish, leader and elder),
October 2026. Not started in any repo.

- **Depends on:** `small-group-reports.md` (the three texts, rule 9 observations),
  `prayer-follow-up.md` (the shared endpoint, section threads, WhatsApp copy),
  `guest-small-groups.md` (guests, `PersonKey`, guest search rule 14 and scope rule 17),
  `inactive-members.md` (inactive members never in pickers), `small-group-leader-access.md` (scope).
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page
  **"Tagging people"**. Its two blue notes match this spec. Rows and boards:
  - *Report form: items and tags*: `ReportForm-Tags` (typing @), `ReportForm-Tags-Edit-Elder`
    (older report, *Tag someone*, *Named in this item*), `ReportForm-Tags-Phone` (picker as a
    sheet), `ReportForm-Tags-Phone-Dark-ES`. The existing `ReportForm-*` boards on page "Small group
    reports" now show items too (ReportForm tweaks `tags`, `legacy`, `user`).
  - *Where tags show*: `ReportDetail-Tags`, `PrayerFollowUp-Tags` (the existing `ReportDetail-*`,
    `PrayerFollowUp-*` and `ThreadPanel` boards were updated the same way).
  - *Person pages: Profile and Timeline tabs*: `MemberDetail-Activity`, `MemberDetail-Timeline`,
    `GuestDetail-Activity`, `GuestDetail-Timeline`, `GuestDetail-Activity-Leader`,
    `GuestDetail-Timeline-Leader`.
  - *Timeline card: filters, preview and phone*: `PersonTimeline` (component, tweaks `variant`,
    `viewer`, `person`, `range`, `group`, `filter`, `size`), `PersonTimeline-Filtered`,
    `PersonTimeline-Phone-Filters`, `PersonTimeline-Phone-Dark-ES`.
- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/REPORT-TAGS-API-HANDOFF.md`
  - `staff-app/docs/design/REPORT-TAGS.md`
- **auth-server: no change.** No new permission, no email (rules 13 and 24).
- **Branch name in every repo:** `report-tags` for Part 1, `person-timeline` for Part 2.

## Implementation order

Part 1 is an **expand / contract** change, because the report body changes shape:

1. `membership-management` stages 1–4 (Part 1, *expand*): items and tags tables with a backfill,
   the new `sections` field on writes and reads, the tag search, section threads and the shared
   endpoint on items. The old text fields keep working in both directions. Deploy.
2. `staff-app` stages 1–5 (Part 1): types and client, the item editor in the report form, the read
   views. Deploy.
3. `membership-management` stage 5 (Part 1, *contract*): drop the old text fields and columns.
   **Only after staff-app Part 1 is deployed**; nothing else reads them.
4. `membership-management` stages 6–7 (Part 2): the timeline endpoints.
5. `staff-app` stages 6–9 (Part 2): the timeline component, tabs and Recent activity, the Timeline
   tab, docs.

One repo per Claude Code session, as usual. Part 2 can start in membership-management while
staff-app is still on Part 1 (it only reads the new tables).

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

### membership-management

Shapes are camelCase `CamelModel`. `Person` is the existing `{ type: "member" | "guest", id, name }`.

**Segments** are how an item travels in both directions:

```jsonc
// A segment is plain text or a tagged person. Input sends `person` as { type, id };
// output adds `name` (current) and `viewable` (rule 12, for the caller).
[
  { "type": "text", "text": "For " },
  { "type": "person", "person": { "type": "member", "id": 198, "name": "Gabriela Castro", "viewable": true } },
  { "type": "text", "text": "’s mother, recovering after Tuesday’s surgery." }
]
```

**Report write** (`POST /small-groups/{id}/reports`, `PATCH /small-group-reports/{id}`, held body):
new optional field `sections`. When present it wins; when absent, the old three text fields are
used (each line becomes an item, rule 2) until stage 5 removes them.

```jsonc
"sections": {
  "prayer":   [ { "segments": [ { "type": "text", "text": "For " }, { "type": "person", "person": { "type": "member", "id": 198 } }, { "type": "text", "text": "’s mother…" } ] } ],
  "praise":   [],
  "followUp": [ { "segments": [ { "type": "text", "text": "Several asked how to talk about their faith…" } ] } ]
}
```

**Report reads** (`GET /small-group-reports/{id}`, and each entry of `GET /small-group-reports/shared`)
gain `sections` with the same keys; each item is `{ "id": 9012, "segments": [...] }`. The old text
fields stay in responses (items joined by line breaks, people by full name) until stage 5.

| Route | Purpose |
| --- | --- |
| `GET /small-groups/{id}/tag-search?q=` | New. Church-wide people to tag in this group's reports (rules 8, 10). `smallGroupReports: create` or `update`, small group scope. ≤ 10 rows; `[]` under 2 characters. |
| `GET /members/{id}/timeline` | New (Part 2). `members: view` + members scope. |
| `GET /guests/{id}/timeline` | New (Part 2). `guests: view` + guests scope. |
| Section thread start | 422 `This section is empty.` now means *no items*. |

```jsonc
// GET /small-groups/7/tag-search?q=pab
[
  { "person": { "type": "member", "id": 211, "name": "Pablo Sánchez" }, "inThisGroup": true,
    "groups": [ { "id": 7, "name": "Jóvenes Bello Horizonte", "audience": "members", "role": "member" } ], "phoneLast4": null },
  { "person": { "type": "member", "id": 340, "name": "Pablo Medina" }, "inThisGroup": false,
    "groups": [ { "id": 3, "name": "Matrimonios Altamira", "audience": "members", "role": "member" } ], "phoneLast4": null },
  { "person": { "type": "guest", "id": 45, "name": "Pablo José Ortiz" }, "inThisGroup": false,
    "groups": [ { "id": 9, "name": "Primeros Pasos", "audience": "guests", "role": "member" } ], "phoneLast4": "4821" }
]
```

```jsonc
// GET /members/162/timeline?from=2026-07-16&to=2026-10-15&smallGroupId=  (or ?latest=3)
{
  "person": { "type": "member", "id": 162, "name": "Lucía Fernández" },
  "from": "2026-07-16", "to": "2026-10-15",          // null with ?latest
  "earliestDate": "2026-02-02",                       // oldest visible row, any group (Show 3 more months)
  "groups": [ { "id": 7, "name": "Jóvenes Bello Horizonte", "audience": "members" } ],  // groups with a visible row, any time
  "counts": { "notes": 2, "prayer": 2, "praise": 3, "followUp": 1 },   // in from..to and the group, after rule 23
  "rows": [
    {
      "reportId": 418, "meetingDate": "2026-10-08",
      "smallGroup": { "id": 7, "name": "Jóvenes Bello Horizonte", "audience": "members" },
      "attendance": { "role": "co_leader", "attendedGroup": true, "attendedChurch": true },   // null: not on the list, or hidden (rule 23)
      "observation": null,                                // or { "text": "…", "submittedBy": { "memberId": 130, "name": "Andrea Gutiérrez" } }
      "items": [ { "id": 9031, "section": "praise", "segments": [ … ] } ]   // only items tagging this person
    }
  ]
}
```

Errors the staff app tells apart (status + a phrase from `detail`): 422 `tag` (an unknown person or
a newly tagged inactive member), 422 `items` (more than 20 items or 10 tags), 422 `range` (from
after to, in the future, or longer than 2 years), plus the existing report errors.

### staff-app

- Routes: `/members/[id]/timeline` and `/guests/[id]/timeline` (Part 2), with `?range`, `?from`,
  `?to`, `?group`. The existing pages become the Profile tab.
- Types and client: `ReportSegment`, `ReportItem`, `ReportSections`; `searchTaggablePeople(groupId,
  q)`; `getMemberTimeline` / `getGuestTimeline`. `ReportInput` sends `sections`; the old text fields
  go away when the API's stage 5 lands.
- The report draft in the browser moves from three strings to three item lists; older drafts are
  split into items on load (rule 2).

## Deploy order

- **API stages 1–4 before staff-app Part 1.** They accept both body shapes and return both, so
  today's staff-app keeps working against them.
- **API stage 5 only after staff-app Part 1 is deployed.** Today's staff-app sends and reads the
  old fields; it would lose the three texts against stage 5.
- Part 2 has no ordering constraint beyond the API endpoint existing before the staff-app tab ships.

## Starter prompts (copy into a fresh Claude Code session per repo)

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement Part 1, stages 1–4, of `docs/REPORT-TAGS-API-HANDOFF.md` in this repo. Read
> `../docs/specs/report-tags.md` first, then `../docs/specs/prayer-follow-up.md` (section threads,
> shared endpoint) and `../docs/specs/guest-small-groups.md` (guest search and scope). Stage by stage
> on branch `report-tags`, one commit per stage, progress log filled in. Run `ruff`, `ty` and
> `alembic check` each stage and try every role in the handoff's list. Stop after stage 4: stage 5
> waits for the staff app.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement Part 1 of `docs/design/REPORT-TAGS.md` in this repo. Read
> `../docs/specs/report-tags.md` first, then open the "Tagging people" page of the Staff App canvas
> and its blue notes. Stage by stage on branch `report-tags`, one commit per stage, progress log
> filled in. membership-management stages 1–4 must be running locally; if they aren't there yet, tell
> me instead of stubbing.

For Part 2, the same prompts with *Part 2*, branch `person-timeline`, and the Timeline rows of the
canvas page.
