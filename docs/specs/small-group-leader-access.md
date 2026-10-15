# Small group leader access (cross-repo spec)

Small group leaders and deacons see and work on **only the small groups they currently lead or
co-lead**, and only those groups' reports. Admins and elders keep seeing everything. Until now
membership-management only checked roles on the member-link endpoints (`require_roles`); every
other route is open to any authenticated request.

**Split:** this spec covers the existing small group routes and screens. Small group **reports**
(endpoints and screens) don't exist yet; they come in `docs/specs/small-group-reports.md` (next,
after a design pass), which applies rules 3, 4, 10 and 11 below from the start.

**Status: implemented** (October 2026). The details live in code; this file keeps the decisions.

- **Depends on:** `docs/specs/member-user-linking.md` (the link, `get_current_member`, `GET /me`).
- **Handoffs (stage logs):** `membership-management/docs/SMALL-GROUP-LEADER-ACCESS-API-HANDOFF.md`,
  `staff-app/docs/design/SMALL-GROUP-LEADER-ACCESS.md`.
- **auth-server: no change.** `smallGroupLeader` and `deacon` already had the right statements.
- **Where it lives:** membership-management `api/access.py` (role sets and the small group scope),
  staff-app `lib/auth/roles.ts` (`getSmallGroupAccess`). Roles are mirrored in three places; change
  them together.

## Rules (decided, don't reopen)

1. **You always need a role.** Leading a group gives no access by itself. Access comes from the
   role, and for scoped roles the group must also be one your member leads.
2. **Role groups:**
   - **Full:** `admin`, `elder`. Every group and report, as today.
   - **Scoped:** `smallGroupLeader`, `deacon`. Only groups where their linked member has a
     `leader` or `co_leader` period that is **active** (`left_at IS NULL`) or **ended by the
     group closing** (rule 11).
   - **None:** `user`, `pending`. No small group or report access (403).
3. **Former leaders see nothing** of a group they no longer lead, reports included. Report
   history is not "theirs" once they leave.
4. **Not linked, or leads nothing:** a scoped user gets empty lists, not an error. A single group
   or report outside their scope is **404**, not 403, so ids of other groups don't leak.
5. **What a scoped user can do in their own groups:**
   - See the group detail (`GET /small-groups/{id}`).
   - Update the group's details (`PATCH /small-groups/{id}`).
   - Add members, change a member's role, remove members (`POST`/`PATCH`/`DELETE
     /small-groups/{id}/members...`), within the limits of rule 9.
   - Create, view, update and delete reports (`smallGroupsReport` statements).
6. **Full roles only:** create a group (`POST /small-groups`), close a group
   (`POST /small-groups/{id}/close`), set the leader (`PUT /small-groups/{id}/leader`).
7. **Searching members stays open to scoped roles** (`persons: search`), since adding a member
   needs `GET /members`. Locking down the members and applications routes for other roles is a
   separate piece of work (see *Not in this spec*).
8. **Roles are mirrored a third time**, in membership-management (one module with the two role
   sets above). The workspace `CLAUDE.md` says to change all three together.

9. **Scoped users don't change leadership.** On the member routes they can add, remove and
   change roles only between `member` and `co_leader`. Assigning `leader`, or changing or
   removing the current leader, is full-role only (like rule 6). They also can't remove or
   change **their own** membership, so they can't lock themselves out: 403 "Ask an admin or
   elder to change your own role in this group."
10. **Submitting a report needs a member.** `small_group_reports.submitted_by_member_id` is
    required and comes from `get_current_member`. Scoped users always have one (otherwise they
    see no group). An admin or elder with no linked member can view, edit and delete reports,
    but creating one returns 409 "Link your account to a member to submit reports." The column
    stays required; no `submitted_by_user_id`.
11. **Closed groups stay visible to their leaders, read-only.** Closed groups are already
    read-only (`SmallGroupClosedError`). Closing a group ends every active period on the close
    date, so "their leaders" means the leaders and co-leaders **when it closed**: a period whose
    `left_at` is on or after the group's `closed_at`. They see the closed group and its reports,
    as an admin would. Someone who stopped leading before the close sees nothing (rule 3).

## Contract notes (not obvious from the code)

- The scope check is done in the query (filter by the scope's ids), not by loading and comparing, so
  lists and single reads use the same rule.
- Report routes (`small-group-reports` spec) reuse the same scope by the report's `small_group_id`;
  create sets `submitted_by_member_id` from `get_current_member` (rule 10).
- The staff-app hides what the API would refuse; the API stays the guard.

## Not in this spec

- Small group report endpoints and screens: `docs/specs/small-group-reports.md` (next).
- Role checks on members, applications and people routes for non-admin roles.
- Letting former leaders see past reports.
- Per-group permissions finer than leader/co-leader.
- Multi-tenant (ministry/church) scoping.
