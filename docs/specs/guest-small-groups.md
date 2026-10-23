# Guest small groups (cross-repo spec)

Some churches run small groups for **guests**: people who visit the church or are going through
its process but aren't members yet. These groups meet and report like any other small group, but
their people change much more often: guests stop coming without notice, and new ones walk in on the
night of a meeting. Guest groups are usually few (1–3 per church) and are led by members.

This feature adds **guests** as their own kind of person (never mixed into members), lets a group
be a **guest group**, and lets guests take part in guest groups and their reports, using the same
reports, conversations and dashboards as member groups.

**Status:** rules agreed, core screens designed, handoffs written (October 2026). Not started in
any repo.

- **Depends on:** `small-group-reports.md` (*reports rule N*), `small-group-leader-access.md`
  (*access rule N*), `roles-and-permissions.md` (*permissions rule N*), `groups-dashboard.md`,
  `prayer-follow-up.md`, `report-conversations.md` Part 1.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page
  **"Guests"**. Its blue rules notes match this spec. Main boards (the others are variants of
  these, set through their tweaks):
  - `GuestGroupDetail` (tweaks `overlay`: `add`, `move`, `new`, `remove`, `menu`; `toast`;
    `viewer`; `lang`): guests split from leaders and members, the stopped-coming suggestion,
    *Add a guest* (search, move note, new guest with a possible match), remove with a reason.
  - `ReportFormGuests` (tweaks `size`: `desktop` | `phone`; `overlay`: `add`, `move`, `new`):
    attendance split in two blocks, *Someone new came*, *Remove after this report*.
  - `Guests`, `GuestDetail` (`viewer`: `elder` | `leader`), `GuestForm` (`variant`, `matches`).
  - Changed shared boards: `Sidebar` (`guests` tweak: the Guests menu item), `Groups` and
    `GroupForm` (`guests` tweak: the badge, and *Who is this group for?* on create).
  - Not drawn yet: the Guests badge on Report status, Prayer & follow-up, Reports, My groups and
    Conversations rows (same pill as `Groups-Guests`).
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/GUEST-SMALL-GROUPS-HANDOFF.md` (small: the `guests` statements)
  - `membership-management/docs/GUEST-SMALL-GROUPS-API-HANDOFF.md`
  - `staff-app/docs/design/GUEST-SMALL-GROUPS.md`
- **Branch name in every repo:** `guest-small-groups`.

## Implementation order

1. `auth-server`: the `guests` resource and its grants (rule 16). One stage.
2. `membership-management`: schema and models, then guest groups and guest participants, then
   `/guests`, then reports, attendance and conversations.
3. `staff-app`: after the design is approved and step 2 runs locally.

One repo per Claude Code session, as usual.

**Deploy order matters for participant shapes.** Group detail, report roster, report detail and
conversation rows gain a `person` object (Contracts). The old `memberId`/`memberName` keys stay,
null on guest rows, until staff-app reads `person` everywhere; a last membership-management stage
removes them. Guest rows can only exist once the setting is on (rule 1), so turn it on only after
staff-app has deployed the stage that reads `person`.

## Rules (decided, don't reopen)

### The setting

1. **Guest groups are a per-church setting, off by default.** Until multi-tenancy arrives, it's
   `GUEST_GROUPS_ENABLED` in membership-management's `ApiSettings`, like `CHURCH_TIMEZONE` (it
   moves onto the church then). `GET /me` returns it (`features.guestGroups`), so staff-app has no
   copy of it. When off: creating a guest group or a guest is 409 `guest groups are off`, and
   staff-app hides every guest control (the Guests menu, the audience choice, *Add a guest*).
   Existing guest data is never touched by turning it off.

### Guests are not members

2. **Guests live in their own table** (`guests`), never in `members`. No members list, members
   search, `GET /members/options`, member count or member profile ever includes a guest, and the
   Guests list never includes a member.
3. **A guest record:** name (required), phone, email, sex, address, first visit date, invited by
   (a member, optional), plus `created_by_member_id` / `created_at`. Email is **not unique**
   (shared family phones and emails are common), and duplicates are caught by search instead
   (rule 13). `legacy_id` (nullable, unique) points to the assimilation DB's `Persona.Id_Persona`,
   like `members.legacy_id`. This feature never sets it: importing is a separate scope.
4. **No user account for guests.** No `user_id`, no invites, no My profile.

### Guest groups

5. **A group has an audience: `members` (default) or `guests`**, chosen when it's created and
   **never changed** (a `PATCH` with `audience` is 422). Existing groups are `members`.
6. **Who can be in which group:**
   - **Member groups:** members only. Adding a guest is 422 `guest group`.
   - **Guest groups:** guests, plus members in any role. The leader and co-leaders are always
     members. A guest's role is always `member` (shown as *Participant*); a guest can't be leader
     or co-leader (422).
   - The database enforces both (Schema).
7. **One active guest group per guest.** Being in two at once is a data mistake. Adding a guest who
   is active in another guest group **moves** them: the old period ends with `left_reason =
   moved_group` and the new one starts, in one transaction. The API refuses this with 409 `in
   another group` (and names that group) unless the request says `moveFromOtherGroup: true`, so the
   UI always confirms first ("Ana is in *Nuevos Jueves* since 2 Oct. Move her to this group?"). A
   move is allowed even when the other group is outside the caller's scope. They learn only its
   name.
8. **Why someone left.** `small_group_members.left_reason` (nullable): `stopped_coming`,
   `moved_group`, `other`. The remove route takes it as an optional body. It's null for history
   before this feature, for role changes and for group closes. It's used for guests now, but member
   groups may send it too.
9. **Everything else about groups is unchanged:** history periods, leader rules, closing, scope
   (access rules), not-filed and no-meeting rules apply to guest groups as they are.

### Reports

10. **Guests are attendance rows like members.** Reports rule 3 (complete attendance) covers every
    active participant, guests included. Observations (reports rule 9), missed streaks (reports
    rule 11) and conversations (report conversations; prayer & follow-up rule 14) work the same for
    a guest's row. The submitter is always a member (reports rule 5).
11. **"Someone new came."** In the report form of a guest group, the leader can add a guest who
    came: search existing guests or create one (rule 13). Adding is **immediate**: it adds the guest
    to the group from the report's meeting date (moving them if rule 7 applies), not on submit.
    Their row appears marked *came to the meeting*. Members (supporters) are added from Group detail,
    as today.
12. **Stopped-coming suggestion (guests only).** When a guest's missed streak (reports rule 11) is
    **3 or more**, staff-app suggests *Hasn't come in N meetings. Still coming?* with **Mark as
    stopped coming**. It is only a suggestion: nothing is ever removed automatically, and there is
    no "dismiss". It shows again on every report and on Group detail for as long as the streak is
    3+ and the guest is still in the group.
    - From Group detail it ends the period today (`church_today()`), `left_reason =
      stopped_coming`.
    - From the report form it ends the period **on that meeting date**, so this report still has
      their row (marked absent), and they're gone from the next one.
    - The threshold is one staff-app constant, `GUEST_STOPPED_COMING_SUGGEST_AFTER = 3`. Member
      groups keep today's hint only (from 2 up, no action).

### Finding and creating guests

13. **Search before create.** Adding a guest (report form, Group detail, Guests page) starts with a
    search by name or phone (accent- and case-insensitive, phone by digits). *Add a new guest* is
    always there, and its form shows close matches again before saving. The API doesn't block
    creating a likely duplicate.
14. **Search results are minimal on purpose:** name, the last 4 digits of the phone, the current
    guest group (or last group and when they left), and the last date they came to a meeting. No
    email, address or observations. That's enough to recognise someone without exposing them.
15. **Guest detail** shows contact details, first visit, invited by, the guest's group history
    (periods with reasons) and their recent attendance (last 12 reports, like the missed-streak
    window). Observations show only to those who may see them (reports rule 9).

### Who can do what

16. **New resource `guests`: `all`, `view`, `search`, `create`, `update`.**
    - `admin`, `elder`: everything (through `appStatement`).
    - `smallGroupLeader`, `deacon`: `view`, `search`, `create`, `update`.
    - `user`, `pending`: nothing.
    - Creating a guest group stays `smallGroups: create` (full roles). Adding guests to a group
      stays `smallGroups: manageMembers` plus `guests: create` for a new one.
17. **Scope without `guests: all`** (as permissions rule 3): guests active in an **open guest
    group** the caller leads or co-leads. View and edit work on that scope; out of scope is 404.
    **Search** is church-wide (rule 14's fields only) but only for a caller who leads or co-leads
    at least one open guest group; anyone else gets an empty list. Leaders of member groups only
    never see guests.
18. **Guests page:** the Guests list is for `guests: all` (admins, elders), with *Add guest* (with
    or without a group). Leaders reach Guest detail and its edit form from Group detail and the
    report, for guests in scope, the way they reach member profiles (permissions rule 8).

### Lists and dashboards

19. **Guest groups are listed with member groups**, with a **Guests** badge (ES *Invitados*):
    Groups, Report status, Prayer & follow-up, Reports, My groups, Conversations. No separate
    dashboard.
    **Naming (decided):** *Guests / Invitados* everywhere in the UI: badge, menu, counts ("8
    invitados · 2 miembros"), forms ("Nuevo invitado"), and a guest's role is shown as
    *Participant / Participante*. It's a status (not a member yet), not a measure of time, so it
    fits a first-timer and someone who has come for months. Not *Nuevos* (it clashes with the
    app's "Nuevo …" buttons and stops being true), not *Visitas* (sounds like one or two visits).
    `guest` is the fixed term in code and the API. A per-church display label is possible later
    (rule 21).
20. **People counts never mix the two.** Within a guest group, the roster count shows guests and
    members separately ("8 guests · 2 members"). Any number that adds up people across groups (none
    exists yet) is split by audience or covers members only. Per-report figures (*at the meeting X
    of Y*) stay as they are: they belong to one group.

### Not in v1

21. Promoting a guest to member (it will happen when a membership application is approved, adding
    `guests.member_id` and `left_reason = became_member` then). Importing guests from the
    assimilation DB. Merging duplicates. Deleting guests. Welcome teams. Guests in member groups.
    An audience filter on lists (1–3 guest groups don't need one). A per-church label for guests
    (e.g. *Visitas*).

## Schema (membership-management, one migration)

```
small_groups
  + audience      VARCHAR(10) NOT NULL DEFAULT 'members'   CHECK IN ('members','guests')
  + UNIQUE (id, audience)                                  -- target of the composite FK below

guests (new)
  id, name, phone, email, sex, address, first_visit_date,
  invited_by_member_id → members.id NULL, created_by_member_id → members.id, created_at,
  legacy_id NULL UNIQUE
  index on lower(unaccent(name)); phone digits searchable

small_group_members
  member_id       → NULL allowed
  + guest_id      → guests.id NULL
  + audience      NOT NULL (backfilled 'members')
  + FK (small_group_id, audience) → small_groups (id, audience)
  + left_reason   VARCHAR(20) NULL  CHECK IN ('stopped_coming','moved_group','other')
  CHECK num_nonnulls(member_id, guest_id) = 1
  CHECK guest_id IS NULL OR (audience = 'guests' AND role = 'member')
  + UNIQUE (guest_id) WHERE left_at IS NULL                -- rule 7, across all groups
  (uq_small_group_members_active on (small_group_id, member_id) keeps working: NULLs are distinct)

small_group_report_attendances
  member_id       → NULL allowed
  + guest_id      → guests.id NULL
  CHECK num_nonnulls(member_id, guest_id) = 1
  + UNIQUE (report_id, guest_id)

report_conversations
  + guest_id      → guests.id NULL
  one_anchor becomes num_nonnulls(member_id, guest_id, section) = 1
  + UNIQUE (report_id, guest_id)
```

`audience` on `small_group_members` is copied from the group so the database itself refuses a
guest in a member group. Attendance rows aren't given an `audience`: they're only created from a
membership active on the meeting date (reports rule 3), which the service already checks and the
database can't, like the submitter rule. Seed: one guest group with guests, a supporter, a few
reports, one guest past the stopped-coming threshold, and one who moved groups.

## Contracts

### auth-server

`guests: ['all', 'view', 'search', 'create', 'update']` in `appStatement`, granted per rule 16.
Also: staff-app's typed unions in `lib/auth/permissions.ts`, and membership-management's
`ARCHITECTURE.md` route table (permissions spec, *Changing what a role can do*).

### membership-management

The participant shape used everywhere a row can be a member or a guest:

```jsonc
"person": { "type": "member" | "guest", "id": 42, "name": "Ana Rivas" }
```

| Route | Change |
| --- | --- |
| `GET /me` | + `features: { guestGroups: bool }` |
| `GET /small-groups`, `GET /small-groups/{id}` | + `audience`. Detail rows gain `person`; `memberId`/`memberName` null on guest rows (until cleanup). Guest group detail adds `missedStreak` per guest row (rule 12) |
| `POST /small-groups` | + `audience` (default `members`; `guests` needs the setting) |
| `PATCH /small-groups/{id}` | `audience` refused (422) |
| `POST /small-groups/{id}/members` | Unchanged: members may join guest groups in any role |
| `POST /small-groups/{id}/guests` | **New.** `{ guestId }` or `{ newGuest: {…} }`, optional `joinedAt` (report form: the meeting date), `moveFromOtherGroup`. 409 `in another group` (with that group's id and name), 422 `guest group` on a member group |
| `DELETE /small-groups/{id}/guests/{guestId}` | **New.** Optional `{ leftReason, leftAt }`. `leftAt` defaults to today. It may be earlier (rule 12's meeting date) but never before `joinedAt` or before a report that already has their row (422), so filed reports stay complete |
| `DELETE /small-groups/{id}/members/{memberId}` | + optional `{ leftReason }` |
| `GET /guests` | **New.** List, `guests: view` + `all`. Filters: `status=active\|inactive`, `q`. Rows: contact, current group, last attended |
| `GET /guests/search?q=` | **New.** Rule 14 fields, rule 17 scope, at most 10 |
| `GET /guests/{id}` | **New.** Rule 15 |
| `POST /guests`, `PATCH /guests/{id}` | **New.** Create without a group needs `guests: all` |
| `GET /small-groups/{id}/report-roster` | Rows gain `person` |
| `POST /small-groups/{id}/reports`, `PATCH /small-group-reports/{id}` | Attendance items take `memberId` **or** `guestId` |
| `GET /small-group-reports/{id}` | Attendance rows gain `person` |
| Conversations | Anchor `{ "type": "attendance", "guestId": n }` beside `memberId`; routes `…/conversations/guests/{guestId}` and `…/guests/{guestId}/comments` beside the member ones; inbox rows gain `person` |

Errors the staff app tells apart: 409 `guest groups are off`, 409 `in another group`, 422 `guest
group`, 422 `audience`, plus the existing ones.

### staff-app

- Routes: `/guests` (list, `guests: all`), `/guests/new`, `/guests/[id]`, `/guests/[id]/edit`.
- Nav: a **Guests** item after Members for `guests: all` when `features.guestGroups` is on.
- Group form: audience choice on create only, when the setting is on.
- Group detail (guest group): roster split into *Guests* and *Members*, *Add a guest* (search,
  new, move confirmation), the stopped-coming suggestion, *Remove* with a reason.
- Report form (guest group): *Someone new came* (rule 11), the suggestion on rows (rule 12).
- Badges per rule 19; every place that reads `memberId` from a participant, attendance row or
  conversation reads `person` instead.

## Starter prompts (copy into a fresh Claude Code session per repo)

**auth-server** (run from `members-management/auth-server`, `--add-dir ../docs`)

> Implement `docs/GUEST-SMALL-GROUPS-HANDOFF.md` in this repo. Read
> `../docs/specs/guest-small-groups.md` first. One stage on branch `guest-small-groups`, progress log
> filled in. Run `pnpm typecheck` and `pnpm exec biome check .`.

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/GUEST-SMALL-GROUPS-API-HANDOFF.md` in this repo. Read
> `../docs/specs/guest-small-groups.md` first, then `../docs/specs/small-group-reports.md` and
> `../docs/specs/report-conversations.md` (Part 1). Stage by stage on branch `guest-small-groups`, one
> commit per stage, progress log filled in. Run `ruff`, `ty` (and `alembic check` in stage 1) each
> stage and try every role in the handoff's list, with the setting on and off, on a scratch database.
> Stage 3 needs auth-server's `guests` permissions; if they aren't there, tell me and stop.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/GUEST-SMALL-GROUPS.md` in this repo. Read
> `../docs/specs/guest-small-groups.md` first, then open the "Guests" page of the Staff App canvas for
> each stage's boards. Stage by stage on branch `guest-small-groups`, one commit per stage, progress
> log filled in, light and dark, 1440 / 1024 / 390, English and Spanish. The membership-management
> stages each stage depends on must be running locally; if they aren't there yet, tell me instead of
> stubbing.
