# Roles and permissions (cross-repo spec)

`auth-server/src/permissions/statements.ts` is the only definition of what a role can do.
auth-server ships each user's computed permissions in the session and the JWT; staff-app and
membership-management check **permissions**, never role names. Replaces roadmap Phase 9
(`staff-app/docs/infrastructure/AUTH-INTEGRATION-ROADMAP.md`).

**Status: implemented** (October 2026). The details live in code; this file keeps the decisions.

- **Handoffs (stage logs):** `auth-server/docs/ROLES-PERMISSIONS-HANDOFF.md`,
  `membership-management/docs/ROLES-PERMISSIONS-API-HANDOFF.md`,
  `staff-app/docs/design/ROLES-PERMISSIONS.md`.
- **Where it lives:** auth-server `src/permissions/statements.ts` (`permissionsFor`) and
  `src/lib/auth.ts` (`customSession`, `definePayload`); membership-management `api/jwt_auth.py`
  (`require_permission`, `has_permission`) and `api/access.py` (scopes), with the role × route
  table in `docs/ARCHITECTURE.md`, *Permissions*; staff-app `lib/auth/permissions.ts` (`can`),
  `lib/auth/get-permissions.ts`, `config/site.ts` (`getVisibleNavItems`).
- **Builds on:** `small-group-leader-access.md`, `small-group-reports.md`, `groups-dashboard.md`,
  `member-user-linking.md`. Their rules stay; where they say "admin and elder" or "scoped roles",
  read `smallGroups: all` and `smallGroups: view` without `all`.

## Changing what a role can do

Edit `statements.ts` only. Adding a **resource or action** also means: the typed unions in
staff-app `lib/auth/permissions.ts`, the checks that use it, and the route table in
membership-management's `ARCHITECTURE.md`. Adding a **role** also means its name in staff-app
`lib/auth/roles.ts` (labels and assigning only).

## Rules (decided, don't reopen)

1. **`statements.ts` is the only role → permission map.** Role names appear outside auth-server
   only for display and when assigning a role. `pending` is a state (blocked at `/needs-role`),
   and a missing role counts as `pending`.
2. **auth-server computes the permissions and ships them**, the same shape in both,
   `Record<resource, action[]>`, built by `permissionsFor(role)`:
   - session: `permissions` (better-auth `customSession`), read by staff-app;
   - JWT: `perms` next to `role`, read by membership-management. `role` is display only.
   - No extra calls: staff-app already reads the session once per request (`cache()`d) and mints
     a JWT per API call; the API verifies the JWT locally against cached JWKS.
   - Freshness: `cookieCache` is off, so a role change shows on the next request in staff-app and
     on the next minted JWT in the API (bounded by the token expiry once Phase 10 caches tokens).
3. **Permissions say what; scope says on which records.** `members` and `smallGroups` have an
   **`all`** action. With it, the other actions apply to every record. Without it:
   - `smallGroups`: the groups the caller's linked member leads or co-leads (leader-access rules
     2, 3, 11). `smallGroupReports` follows the `smallGroups` scope; it has no `all`.
   - `members`: members active (`left_at IS NULL`) in an **open** group of that scope.
   - Out of scope is an empty list or **404**; a missing permission is **403**.
4. **You always need the role.** Leading a group grants nothing without `smallGroups: view`.
5. **Roles:**

   | Role | Grants |
   |---|---|
   | `admin` | Every app statement + better-auth `adminAc` |
   | `elder` | Every app statement + `user: create, list, get, ban, set-role` |
   | `smallGroupLeader` | `members: view, search, update` · `smallGroups: view, update, manageMembers` · `smallGroupReports: view, create, update, delete` |
   | `deacon` | Same as `smallGroupLeader` for now; its own role so it can grow |
   | `user` | Nothing: a greeting dashboard and My profile. Baseline for regular members later |
   | `pending` | Nothing; blocked at `/needs-role` |

   App statements: `members` (all, view, search, create, update, link), `membershipApplications`
   (view, approve, reject), `smallGroups` (all, view, create, update, close, setLeader,
   manageMembers), `smallGroupReports` (view, create, update, delete, viewObservations),
   `invites` (create, cancel). A dashboard is not a permission: each section shows when its data's
   permission is there.
6. **Leadership changes** (leader-access rule 9): assigning, changing or removing a `leader` needs
   `smallGroups: setLeader`; without `smallGroups: all` you can't change your own row.
   Observations need `smallGroupReports: viewObservations` or leading the report's group. The week view
   needs `smallGroups: all` + `viewObservations`.
7. **A nav item and its page make the same check**; the page is `notFound()` when it fails, so a
   hidden page is unreachable by URL. Every server action checks before calling the API, and the
   API stays the guard.
8. **Leaders and members:**
   - The add-member picker uses `GET /members/options` (`[{ id, name }]`, `members: search`) for
     everyone. `GET /members` (full rows, email and phone) needs `members: view` + `all`.
   - Leaders view and edit the profiles of members in scope (rule 3), reached from the group
     detail. No Members menu, no creating members.
   - **Only `members: all` changes `email`**: it's what an accepted invite matches to link a member
     to a user. A `PATCH` containing `email` is 403 without it, even unchanged, so staff-app leaves
     the key out.
   - The member Account card (link, unlink, invite) needs `members: link`.
9. **Fail closed.** A JWT without `perms` or a session without `permissions` has no permissions;
   an unknown role gets `{}`.
10. **Your own member is always readable.** `GET /members/{id}` returns the caller's own member
    whatever their permissions, because My profile loads it. Editing it still needs `members:
    update` and the scope.
11. **Invites are gated with functions**, `permissionsFor(inviterUser.role).invites`, not
    better-invite's `{ statement, permissions }` option, which always passes in 0.5.7 (any
    signed-in user could invite an admin).

## Multi-tenant later

Every tenant has the same roles, so `statements.ts` doesn't change. A user's role becomes per
tenant (likely better-auth's `organization` plugin); only `permissionsFor`'s input changes (the
active tenant's role), plus a `tenant` claim in the JWT. Checks in the other two repos stay the
same, which is the main reason for rule 2.

## Not in this spec

- Changing an assigned user's role (promotion/demotion) on the users page.
- A Members list for leaders scoped to their groups.
- Letting leaders create members.
- Former leaders seeing past reports.
- JWT caching (roadmap Phase 10).
- Multi-tenant scoping (see above).
