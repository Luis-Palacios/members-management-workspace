# Inactive members (cross-repo spec)

Members leave the church: they move away, transfer, stop attending, are under church discipline,
or die. Today the only options are to keep them as regular members or delete them. This feature
gives a member a **status** (`active` | `inactive`). An inactive member keeps their record and
history, drops out of everything aimed at current members (small groups, pickers, member lists,
later bulk email), loses sign-in, and can be reactivated.

**Status:** rules agreed, screens designed, handoffs written (October 24, 2026). Not started in
any repo.

- **Builds on:** `member-user-linking.md`, `user-admin-actions.md` (*ban rule N*: the ban this
  feature uses), `roles-and-permissions.md` (*permissions rule N*), `small-group-leader-access.md`,
  `guest-small-groups.md` (`LeftReason` on membership periods).
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page
  **"Members"**, row *Inactive members · leaving and coming back*. Its blue rules note matches this
  spec. Main boards (the others are variants set through their tweaks):
  - `Members` (tweak `filter`: `active` | `inactive` | `all`): status tabs, the *Left* column, the
    *Inactive* badge.
  - `MemberDetail` (tweaks `status`: `active` | `inactive`; `overlay`: `deactivate`,
    `deactivateLeader`, `reactivate`; `toast`: `deactivated`, `reactivated`): the *Mark as
    inactive* section, the inactive banner, *Past groups*, *Status history*, the Account card's
    *Sign-in off*, and the three dialogs.
  - `GroupDetail` (`overlay`: `add`): the picker's *Only active members are listed* hint, and the
    *Show N past members* toggle.
  - Variants: `Members-Inactive`, `Members-All`, `MemberDetail-Deactivate`,
    `MemberDetail-DeactivateLeader`, `MemberDetail-Inactive`, `MemberDetail-Reactivate`,
    `MemberDetail-Inactive-Dark`.
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/INACTIVE-MEMBERS-HANDOFF.md` (small: the `members: setStatus` action)
  - `membership-management/docs/INACTIVE-MEMBERS-API-HANDOFF.md`
  - `staff-app/docs/design/INACTIVE-MEMBERS.md`
- **Branch name in every repo:** `inactive-members`.

## Implementation order

1. `auth-server`: `members: setStatus` (rule 4). One stage.
2. `membership-management`: schema and migration, then deactivate / reactivate / history, then
   inactive members filtered out everywhere (rule 11), then docs.
3. `staff-app`: API client and actions, Members list, Member detail, dialogs, Group detail.

One repo per Claude Code session, in this order.

## Rules (decided, don't reopen)

1. **A status, not an archive and not a delete.** `members.status` is `active` or `inactive`.
   Members are never deleted for leaving. Someone can leave and come back more than once.
2. **History is append-only.** Every change is a row in `member_status_changes`. `members.status`
   (and `status_changed_at`) is a copy of the latest row, written in the same transaction.
3. **Reasons** (required to deactivate, none on reactivate): `moved_away`, `transferred`,
   `stopped_attending`, `church_discipline`, `deceased`, `other`. Labels: Moved away, Transferred
   to another church, Stopped attending, Church discipline, Deceased, Other. They exist for
   filtering and reporting later; no reason gets special handling in v1.
4. **Who:** deactivating and reactivating need **`members: setStatus`**, a new action in
   `appStatement`. `admin` and `elder` get it through their spread; `smallGroupLeader` and
   `deacon` don't.
5. **Reason, note and history are private.** They're returned only to callers with `members:
   setStatus` (`null` / 403 otherwise), enforced by the API, not only hidden by the UI. Everyone
   who can see the member sees *that* they're inactive and since when.
6. **Leaving ends every group membership, today.** Deactivating closes every open
   `small_group_members` period of the member, in member and guest groups, with `left_at =
   church_today()` and `left_reason = 'member_inactive'`. The *date they left* the person enters
   is informational (today or earlier) and never moves `left_at`, so past reports and attendance
   don't change.
7. **A group's leader can't be deactivated.** If the member is the `leader` of an open group, the
   API refuses with the list of those groups. The UI sends the caller to the existing leader
   swap. Co-leader and member roles don't block.
8. **Not yourself.** A member linked to the caller (`sub`) can't be deactivated by that caller.
9. **Sign-in is always turned off, by banning the linked user.** Right after the API accepts the
   deactivation, staff-app bans the member's user (if any) through better-auth's admin plugin, as
   the Users page does: `banReason` = the fixed string **`Member marked inactive`**, no expiry.
   The ban revokes every session at once (*ban rule 8*).
   - membership-management never calls auth-server for this (*ban rule 3*).
   - Deactivation comes first and is never rolled back. If the ban then fails, the member stays
     inactive, staff-app shows a warning, and the Account card shows *Sign-in still on* with *Turn
     off sign-in* to retry. That includes the admin-account guard (*ban rule 5*): an elder can
     deactivate a member whose user is an admin, but only an admin can then turn that sign-in off.
     staff-app can't tell beforehand, since it doesn't check role names (*permissions rule 1*).
10. **Reactivating** sets `active` from today, with an optional note.
    - Groups are **not** restored. People are added back from the group page.
    - With *Turn sign-in back on* (default on, shown when a user is linked), staff-app unbans the
      user **only if** their ban reason is exactly `Member marked inactive`. A ban for any other
      reason is left alone and the dialog says so.
    - Coming back through a membership application is out of scope.
11. **Inactive members are out of everything for current members:**
    - `GET /members` returns active members unless asked for `status=inactive|all`.
    - `GET /members/options` (every add-member and leader picker, member and guest groups)
      returns active members only, with no override.
    - Adding an inactive member to a group, linking a user to them, and inviting from them are
      **409** in the API, not only hidden.
    - An accepted invite never links to an inactive member: the internal accepted-invite route
      skips them, as if no member matched.
    - Member counts (dashboards) count active members.
    - Later bulk messages go to active members only.
    - The top bar search (`members: view` + `all`) still finds inactive members and says so;
      scoped callers never see them, since they're in no open group.
12. **Leader scope follows on its own.** Scope is "active in an open group of the caller's"
    (*permissions rule 3*). Once their periods end, an inactive member is out of every leader's
    scope (404). Past reports, attendance, observations and conversations keep their name.
13. **Members list:** tabs *Active* (default) / *Inactive* / *All* with counts, in the URL as
    `?status=`. *Inactive* swaps the Account column and filter for *Left* (date and reason).
    *All* marks inactive rows with an *Inactive* badge and "Left {date}".
14. **Member detail** follows the boards. Active: a *Mark as inactive* danger section. Inactive:
    the *Inactive* pill, a banner with *Reactivate…*, *Past groups* (the periods this
    deactivation ended), the Account card's *Sign-in off*, *Status history*. Invite and link are
    hidden for an inactive member.
15. **Guests are unaffected.** A member who leads or co-leads a guest group follows rules 6 and 7
    like any group.

## Schema (membership-management)

```text
members
  + status            VARCHAR(10) NOT NULL DEFAULT 'active'   CHECK IN ('active','inactive')
  + status_changed_at TIMESTAMPTZ NULL

member_status_changes                         -- append-only (rule 2)
  id                  Identity PK
  member_id           FK members NOT NULL
  status              VARCHAR(10) NOT NULL    -- the status it changed TO
  reason              VARCHAR(20) NULL        -- rule 3; CHECK (status = 'inactive') = (reason IS NOT NULL)
  effective_date      DATE NOT NULL           -- "date they left" (rule 6); today on reactivate
  note                TEXT NULL               -- <= 1000 chars, trimmed, empty -> NULL
  changed_by_user_id  VARCHAR(255) NOT NULL   -- JWT sub; no FK (separate DBs)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  index (member_id, created_at DESC)

small_group_members.left_reason
  + 'member_inactive'                         -- LeftReason; set only by rule 6
```

Every existing member becomes `active`; no history rows are backfilled. Enums are VARCHAR +
CHECK, like the rest of the schema.

## Contracts

All camelCase on the wire.

| Route | Permission | Notes |
|---|---|---|
| `POST /members/{id}/deactivate` | `members: setStatus` | Body `{ reason, effectiveDate, note? }` → `MemberDetail`. 404; 409 `already_inactive`; 409 `leads_group` with `groups: [{ id, name }]`; 409 `self`; 422 future date. |
| `POST /members/{id}/reactivate` | `members: setStatus` | Body `{ note? }` → `MemberDetail`. 404; 409 `already_active`. |
| `GET /members/{id}/status-history` | `members: setStatus` | Newest first: `{ status, reason, effectiveDate, note, changedByUserId, changedByName, createdAt }`. `changedByName` is the name of the member linked to `changedByUserId`, else `null`. |
| `GET /members?status=` | unchanged | `active` (default) / `inactive` / `all`. Rows gain `status`, `inactiveSince`, `inactiveReason` (null without `setStatus`). |
| `GET /members/{id}` | unchanged | Gains `status`, `inactiveSince`, `inactiveReason`, `inactiveNote` (last two null without `setStatus`), and `pastSmallGroups` (periods closed by the latest deactivation; empty when active). |
| `GET /members/options` | unchanged | Active only. |
| `GET /members/search` | unchanged | Rows gain `status`. |
| `POST /small-groups/{id}/members`, role changes | unchanged | 409 `member_inactive`. |
| `PUT /members/{id}/user` | unchanged | 409 `member_inactive`. |
| internal accepted-invite | unchanged | Skips inactive members (no link). |

409 bodies keep the existing `detail` message and add a machine-readable `code` (and `groups` for
`leads_group`), so staff-app can pick the dialog without parsing text.

The ban reason `Member marked inactive` is a constant in staff-app only. auth-server stores it as
any other `banReason`.

## Not in this spec

- Coming back through a membership application. When it's built, approving one for an inactive
  member reactivates that record instead of creating a duplicate.
- Reports by reason, bulk deactivate, scheduled or future-dated deactivation, suggesting inactive
  after N weeks away.
- Bulk email. When it's built, "active member" and "agreed to receive email" are separate checks.
- Cancelling a pending invite automatically on deactivation (`member-user-linking.md`: only the
  sender can cancel). Rule 11's accepted-invite check makes a leftover invite harmless.
- The group page's *Show N past members* list, if the group detail doesn't already return ended
  periods. The board shows where it goes; build it when the API has the data.
