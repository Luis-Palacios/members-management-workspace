# Inactive guests and status on the timeline (cross-repo spec)

Two pieces of work:

- **Part 1: inactive guests.** Guests get a **status** (`active` | `inactive`) like members. Today
  a guest is "active" only while they're in a guest group, and the Guests list's second tab is *Not
  in a group*. That tells nobody whether the person moved away, joined another church or is simply
  between groups. Marking a guest inactive says so, with a reason, keeps their record and history,
  and takes them out of everything aimed at current guests. Leaders can bring a guest back when
  they walk in again.
- **Part 2: status changes on the person timeline.** Member and guest timelines show *Marked
  inactive* (reason and note) and *Reactivated* entries among the report rows. The timeline endpoint
  changes from a list of report rows to a list of **typed entries**, so later features that don't
  come from small group reports add a new kind of entry instead of a new endpoint.

**Status:** rules agreed (October 29, 2026). Design and handoffs next. Not started in any repo.

- **Builds on:** `inactive-members.md` (*inactive rule N*), `guest-small-groups.md` (*guest rule
  N*), `report-tags.md` (*tags rule N*: the timeline, rules 19–24), `roles-and-permissions.md`
  (*permissions rule N*), `small-group-leader-access.md`.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1). Each row's
  blue rules note matches this spec. Main boards (the others are variants set through their
  tweaks):
  - Page **"Guests"**, row *Inactive guests · leaving and coming back*:
    - `Guests` (tweak `filter`: `active` | `inactive` | `all`): the new tabs, *Left* and *Last
      group* columns, the *Inactive* badge.
    - `GuestDetail` (tweaks `status`: `active` | `inactive`; `overlay`: `deactivate`,
      `reactivate`): *Mark as inactive*, the banner, *Status history*, both dialogs.
    - `GuestGroupDetail` (`overlay`: `reactivate`; `toast`: `reactivated`): an inactive guest in
      *Add a guest* and *Reactivate and add*. The report form's *Someone new came* works the same
      way; it isn't drawn separately.
    - Variants: `Guests-Inactive`, `Guests-All`, `GuestDetail-Deactivate`, `GuestDetail-Inactive`,
      `GuestDetail-Reactivate`, `GuestDetail-Inactive-Dark-ES`, `GuestGroupDetail-Reactivate`.
  - Page **"Tagging people"**, row *Status on the timeline*:
    - `PersonTimeline` (tweak `status`: `off` | `on`) and `GuestDetail` (`statusEntries`).
    - Variants: `PersonTimeline-Status`, `PersonTimeline-Status-Dark-ES`,
      `GuestDetail-Timeline-Status-Leader`, `GuestDetail-Activity-Status-Leader`.
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/INACTIVE-GUESTS-HANDOFF.md` (small: two `guests` actions)
  - `membership-management/docs/INACTIVE-GUESTS-API-HANDOFF.md`
  - `staff-app/docs/design/INACTIVE-GUESTS.md`
- **Branch name in every repo:** `inactive-guests`.

## Implementation order

1. `auth-server`: `guests: deactivate` and `guests: reactivate` (rule 4). One stage.
2. `membership-management`:
   1. Schema: `guests.status`, `status_changed_at`, `guest_status_changes`, the `guest_inactive`
      left reason. Every existing guest becomes `active`, with no history backfilled.
   2. Deactivate and reactivate routes, the status fields on guests, the list's `status` meaning
      (rule 10), search and picker changes (rule 8).
   3. Reactivate-and-add on `POST /small-groups/{id}/guests` (rule 6).
   4. Timeline entries, **expand**: `entries` beside the existing `rows` (rule 15), with status
      entries for members and guests.
   5. Timeline entries, **contract**: drop `rows`. Only after staff-app reads `entries` is
      deployed.
3. `staff-app`: after the design is approved and steps 2.1–2.4 run locally. Part 1 screens, then
   the timeline reading `entries`.

One repo per Claude Code session, as usual.

## Rules (decided, don't reopen)

### Part 1: inactive guests

1. **A status, separate from being in a group.** `guests.status` is `active` or `inactive`. An
   active guest may be in a guest group or not (they stopped coming, or are waiting for a group).
   *Not in a group* is no longer a status; it's what the *Group* column says. Guests are never
   deleted (guest rule 21).
2. **History is append-only**, as for members (inactive rule 2): every change is a row in
   `guest_status_changes`; `guests.status` and `status_changed_at` copy the latest row in the same
   transaction.
3. **Reasons** (required to deactivate, none on reactivate): `moved_away`, `stopped_attending`,
   `joined_another_church`, `deceased`, `other`. Labels: Moved away, Stopped attending, Joined
   another church, Deceased, Other. Plus an optional note and the date they left (today or
   earlier, informational, as inactive rule 6). There's no *Church discipline* for guests.
4. **Who** (two new actions on `guests`):
   - **`guests: deactivate`**: `admin` and `elder`, through `appStatement`. Leaders keep *Remove*
     and *Mark as stopped coming* (guest rules 8 and 12), which only end a group period.
   - **`guests: reactivate`**: `admin` and `elder` (`appStatement`), plus `smallGroupLeader` and
     `deacon`.
   - No `setStatus` action for guests: unlike members, the two sides go to different roles.
5. **Deactivating ends the guest's group period today**, with `left_at = church_today()` and
   `left_reason = 'guest_inactive'` (a new value), like inactive rule 6. The date they left never
   moves `left_at`. There's no leader check (a guest can't lead, guest rule 6) and no sign-in to
   turn off (guest rule 4).
6. **Reactivating:**
   - Sets `active` from today, with an optional note. The group isn't restored.
   - **From Guest detail** (`POST /guests/{id}/reactivate`): needs `guests: reactivate` and the guest
     in the caller's guest scope. An inactive guest is in no group, so in practice this is admins
     and elders.
   - **From *Add a guest* and *Someone new came*** (Group detail, report form): a leader who finds
     an inactive guest in the search can **reactivate and add** them in one step. The add request
     says `reactivate: true` and the API reactivates the guest and opens the new period in one
     transaction. This needs `guests: reactivate` plus what adding already needs
     (`smallGroups: manageMembers` on that group). Without `reactivate: true`, adding an inactive
     guest is 409 `guest_inactive`. The confirmation takes an optional note, and the status change
     records the caller.
7. **Leaders see an inactive guest only in search**, with an *Inactive* pill and the date they
   left: never the reason or note (they aren't in scope, guest rule 17). Once reactivated and added,
   the guest is in their scope and the timeline shows the full history (rule 13).
8. **Inactive guests are out of everything aimed at current guests:**
   - The tag picker never offers them (tags rule 7 now reads "any active member and any active
     guest"). Existing tags stay.
   - The stopped-coming suggestion never shows for them (they're in no group).
   - Guest search (guest rule 14) still finds them, marked *Inactive*, so nobody creates a
     duplicate. *Add a new guest*'s possible-match list does the same.
   - The top bar search (`guests: all`) finds them and says so.
9. **Reason, note and history on Guest detail** are returned only to callers with
   `guests: deactivate` (`null` otherwise), like inactive rule 5. The timeline is the exception
   (rule 13).
10. **Guests list:** tabs *Active* (default) / *Inactive* / *All* with counts, `?status=` in the URL,
    matching the Members list (inactive rule 13). *Inactive* swaps the *Group* and *Last attended*
    columns for *Left* (date and reason). *All* marks inactive rows with the *Inactive* badge.
    `GET /guests?status=` now filters on `guests.status`. The old *Not in a group* tab is gone;
    *Not in a group* stays as the Group column's value.
11. **Guest detail** mirrors Member detail: active guests get a *Mark as inactive* danger section
    (for `guests: deactivate`); an inactive guest gets the *Inactive* pill, a banner with
    *Reactivate…* (for `guests: reactivate`), and *Status history*. The group history card already
    lists the period with *Ended when marked inactive*.

### Part 2: status changes on the person timeline

12. **Status entries.** The timeline of a member or a guest shows one entry per status change, on
    its effective date (the date they left; the day of reactivation):
    - *Marked inactive*: the reason, the note, and who did it.
    - *Reactivated*: the note (if any) and who did it.
    - "Who did it" is the member linked to `changed_by_user_id`, by current name. No linked member:
      the entry leaves it out.
13. **Who sees them:** everyone who can open the person's timeline (tags rule 23): admins and
    elders always; leaders while the person is in their scope, which in practice means after they
    were reactivated and added back to the leader's group. Reason and note included. This widens
    inactive rule 5 for the timeline only; the member and guest detail fields and
    `GET /members/{id}/status-history` stay as they are.
14. **Filters:**
    - **Dates:** status entries follow the date range like report rows, and count for *Show 3 more
      months* and *That's everything since…* (now *since their first activity* for members,
      *since their first visit* for guests).
    - **Group:** status entries have no group: shown with *All groups*, hidden when one group is
      picked.
    - **Type chips:** shown under *All* only; no chip of their own yet. A chip comes when there are
      more kinds.
    - **Recent activity** (tags rule 20) picks the 3 newest entries of any kind, so it shows when
      the only entry is a status change.
    - The summary line counts reports only: *11 reports · Jul 16 – Oct 15, 2026*.
15. **Typed entries.** The timeline response is a list of entries, newest first. Every entry has a
    `kind` and a `date`; the rest depends on the kind. Today's kinds: `report` (what a row is
    today) and `status`. A future feature adds a kind:
    - membership-management: one more **source**. Each source takes the person, the caller's access
      and the date range, and returns its entries already filtered for that caller. A shared step
      merges them, sorts, applies `latest`, and works out `earliestDate`, `groups` and `counts`.
      No source knows about the others.
    - staff-app: one more entry component. **Entries of a kind staff-app doesn't know are
      skipped**, so the API can ship a kind before the UI draws it.
    - Ties on one date: newest recorded first; a status entry goes above a report row of the same
      date.
16. **No notifications**, as tags rule 13 and inactive members.

### Not in this spec

17. Group joins, leaves and moves on the timeline (*Joined Nuevos Jueves*, *Stopped coming*). It's
    the natural next kind, but not now. Coming back through a membership application, promoting a
    guest to member, reports by reason, bulk deactivate, automatic deactivation after N weeks.

## Contracts

membership-management's `/docs` page will be the reference once built. What the code won't tell
you:

- `POST /guests/{id}/deactivate` `{ reason, effectiveDate, note? }` and `POST /guests/{id}/reactivate`
  `{ note? }`. 409 bodies keep the English `detail` and add `code`, as for members:
  `already_inactive`, `already_active`, `guest_inactive` (adding without `reactivate: true`). A
  future `effectiveDate` is 422.
- Guest detail, list rows and search results gain `status` and `inactiveSince`; detail adds
  `inactiveReason`, `inactiveNote` (rule 9) and the list `?status=` changes meaning (rule 10).
- `POST /small-groups/{id}/guests` gains `reactivate: bool` (rule 6). It can be combined with
  `moveFromOtherGroup` only in theory: an inactive guest is in no group.
- `GET /members|guests/{id}/timeline` gains `entries` beside `rows` (stage 2.4), and loses `rows`
  in stage 2.5:

  ```jsonc
  "entries": [
    { "kind": "status", "date": "2026-10-20", "status": "inactive", "reason": "moved_away",
      "note": "Moved to Monterrey", "changedBy": { "memberId": 7, "name": "Ana Rivas" } },
    { "kind": "report", "date": "2026-10-15", "report": { /* today's row */ } }
  ]
  ```

  For guests `reason` takes rule 3's values, for members inactive rule 3's. `status: "active"`
  entries have `reason: null`. `changedBy` is null when no member is linked to the user.
