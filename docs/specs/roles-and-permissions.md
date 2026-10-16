# Roles and permissions (cross-repo spec)

Replaces roadmap Phase 9 (`staff-app/docs/infrastructure/AUTH-INTEGRATION-ROADMAP.md`). The last
piece before going live: every role sees and can call only what it should, nav included.

Today the role → permission map in `auth-server/src/permissions/statements.ts` is mostly
decorative. Only `invites` and better-auth's own `user` statements are ever checked. Everything
else is checked by **role name**, hard-coded in three repos. This spec makes `statements.ts` the
only definition of what a role can do. auth-server ships the computed permissions in the session
and the JWT, and staff-app and membership-management check **permissions**, never role names.

- **Repos and order:** auth-server → membership-management → staff-app (see *Stages*).
- **Branch name in every repo:** `roles-permissions`.
- **Handoffs:** each repo's session writes its own from this spec, following that repo's convention
  (`auth-server/docs/ROLES-PERMISSIONS-HANDOFF.md`,
  `membership-management/docs/ROLES-PERMISSIONS-API-HANDOFF.md`,
  `staff-app/docs/design/ROLES-PERMISSIONS.md`).
- **Builds on:** `small-group-leader-access.md`, `small-group-reports.md`, `groups-dashboard.md`,
  `member-user-linking.md`. Their rules stay. Where they say "admin and elder" or "scoped roles",
  read the permission that replaces it (table in *Rules*, rule 6).

## Review: what's wrong today (October 2026)

**auth-server: `statements.ts` doesn't describe the app.**

- Resources that nothing checks: `dashboard`, `persons`, `membershipApplications`, `smallGroups`,
  `smallGroupsReport`.
- Actions for features that don't exist: `membershipApplications` create/update/delete,
  `smallGroups: delete` (groups are closed, not deleted), `persons` create/delete.
- Features with no permission at all: close a group, set the leader, manage a group's roster, link
  a member to a user, see report observations, the groups week view.
- **Bug:** `elder` has `user: list` but not `user: get`, so `/users/[id]` fails for elders
  (`/admin/get-user` requires `user: ["get"]`).

**membership-management: most routes accept any valid JWT.**

- `members` (list, detail, **create, update**), `applications` (list, detail, **approve,
  reject**) and `people` only check that a token is valid. A `smallGroupLeader` or a `user` can
  create and edit any member and approve applications through server actions, even though the UI
  hides the buttons.
- `GET /members` returns every member's email and phone. Leaders call it for the add-member picker.
- The role sets in `api/access.py` (`FULL_ACCESS_ROLES`, `SCOPED_ROLES`) and the 5
  `require_roles("admin", "elder")` calls are the third hand-made copy of the role model.

**staff-app: role checks are scattered and the nav is only partly gated.**

- Four helpers built from role names: `STAFF_ADMIN_ROLES`, `getSmallGroupAccess`,
  `canManageLinks`, `reportAccess`. The staff dashboard and the users pages still carry the
  "TEMPORARY … Phase 9" comment.
- The nav hides Groups and the dashboard group by small group access. **Members, Applications
  and Access show for every role.** The Access pages redirect, but the Members and Applications
  pages render for leaders and `user`.
- `requireStaffSession` lets a `null` role through.
- `lib/auth-client.ts` declares fake roles (names only) for typing. This is fine and stays.

## Rules (decided, don't reopen)

1. **`statements.ts` is the only role → permission map.** No other repo lists which role can do
   what. Role names appear outside auth-server only for display (labels, badges) and when you
   assign a role (users page, invites).
2. **auth-server computes the permissions and ships them:**
   - **Session:** better-auth's `customSession` plugin adds `permissions` to `GET
     /api/auth/get-session`, next to `user` and `session`.
   - **JWT:** `definePayload` adds `perms` next to `role`, so the payload is `{ sub, role, perms,
     iat, exp, iss, aud }`.
   - **Same shape in both:** `Record<resource, action[]>`, the role's statements as declared. One
     helper in `statements.ts`, `permissionsFor(role)`, builds both. An unknown or missing role
     gets `{}`.
   - **Freshness:** a role change applies on the next session read in staff-app, and in the API
     on the next minted JWT. staff-app mints one per call today; with Phase 10 caching, it's
     bounded by the token expiry.
3. **Permissions answer "what"; scope answers "on which records".** A resource whose permissions
   are limited to the caller's own groups gets an **`all`** action. With `all`, the other
   actions apply to every record. Without it, they apply only within the caller's scope:
   - `smallGroups` without `all`: groups the caller's linked member leads or co-leads (the
     existing scope, leader-access rules 2, 3 and 11, unchanged). `smallGroupReports` always
     follows the `smallGroups` scope; it has no `all` of its own.
   - `members` without `all`: members with an **active** membership (`left_at IS NULL`) in an
     **open** group in the caller's `smallGroups` scope. Members of a closed group they led, and
     former members, are out of scope.
   - Out of scope means empty lists and **404** for a single record (leader-access rule 4).
     Missing the permission itself means **403**.
4. **You always need the role.** Leading a group grants nothing by itself (leader-access rule 1):
   no `smallGroups: view`, no access, whatever the member leads.
5. **Statements:**

   ```ts
   const statement = {
     ...defaultStatements,  // better-auth's user / session
     members: ['all', 'view', 'search', 'create', 'update', 'link'],
     membershipApplications: ['view', 'approve', 'reject'],
     smallGroups: ['all', 'view', 'create', 'update', 'close', 'setLeader', 'manageMembers'],
     smallGroupReports: ['view', 'create', 'update', 'delete', 'viewObservations'],
     invites: ['create', 'cancel'],
   };
   ```

   Removed: `dashboard`, `persons`, `smallGroupsReport` (renamed `smallGroupReports`), unused
   actions. A dashboard isn't a permission: each section shows when its data's permission is
   there (rule 7).

   | Role | Grants |
   |---|---|
   | `admin` | Every app statement + better-auth `adminAc` (as today) |
   | `elder` | Every app statement + `user: create, list, get, ban, set-role` (**adds `get`**) |
   | `smallGroupLeader` | `members: view, search, update` · `smallGroups: view, update, manageMembers` · `smallGroupReports: view, create, update, delete` |
   | `deacon` | Same as `smallGroupLeader` for now (separate role so it can grow on its own) |
   | `user` | Nothing. Signed in, sees the dashboard greeting and My profile. Baseline for regular members later |
   | `pending` | Nothing. Blocked at `/needs-role` (as today) |

6. **What each old check becomes** (in membership-management and staff-app):

   | Today | Becomes |
   |---|---|
   | `FULL_ACCESS_ROLES` / `access === "full"` | `smallGroups: all` |
   | `SCOPED_ROLES` / `access === "scoped"` | `smallGroups: view` without `all` |
   | `require_roles("admin","elder")` on create group / close / set leader | `smallGroups: create` / `close` / `setLeader` |
   | Roster add / change role / remove | `smallGroups: manageMembers` + scope |
   | Leader-access rule 9 (no leadership changes) | Assigning, changing or removing a `leader` needs `smallGroups: setLeader`. Without `smallGroups: all` you can't change your own row (unchanged) |
   | Week view (`/small-group-reports/week`) | `smallGroups: all` + `smallGroupReports: viewObservations` |
   | Report observations "admins, elders and the submitter" | `smallGroupReports: viewObservations`, or the submitter |
   | `canManageLinks` / member link routes | `members: link` (+ `invites: create` to invite from a member) |
   | `STAFF_ADMIN_ROLES` on users / invites pages | `user: list` / `invites: create` |
   | Members, applications, people routes (unchecked) | `members: view/create/update`, `membershipApplications: view/approve/reject`. `people` uses `membershipApplications: view` |

7. **Nav and pages, by permission:**

   | Nav item | Shows when |
   |---|---|
   | Dashboard ▸ Groups (`/`) | `smallGroups: all` |
   | Dashboard ▸ Staff (`/dashboard/staff`) | `smallGroups: all` (unchanged; its sections gate themselves) |
   | Dashboard (`/`, leaf) | Everyone without `smallGroups: all`. With `smallGroups: view` it's the leader dashboard; with neither, a greeting and a link to My profile |
   | Members | `members: view` + `all` |
   | Groups ▸ List, Reports | `smallGroups: view` |
   | Applications | `membershipApplications: view` |
   | Access ▸ Users | `user: list` |
   | Access ▸ Invites | `invites: create` |

   A nav item's check matches its page's check, and the page returns `notFound()` when it fails,
   so a hidden page is also unreachable by URL. Staff dashboard sections: applications needs
   `membershipApplications: view`, pending users `user: list`, open invites `invites: create`.

8. **Leaders and members (new):**
   - **Add-member picker:** new `GET /members/options` → `[{ id, name }]` with `members: search`,
     for every caller (admins too). `GET /members` (full rows) needs `members: view` + `all`.
     The dialog stops showing email to disambiguate; same-name members are rare enough to accept.
   - **Member detail and edit for leaders:** `GET /members/{id}` and `PATCH /members/{id}` with
     `members: view` / `update`, within the members scope (rule 3). In the group detail, a
     member's name links to their profile when they're in scope.
   - **Leaders can't change `email`.** It's the key the invite → member link matches on
     (member-user-linking). A `PATCH` with `email` from a caller without `members: all` is 403,
     and the form hides the field. *Recommended default; reversible later if you want it.*
   - **Leaders can't create members** (no `members: create`). Someone not yet in the system is
     added by an admin or elder.
   - The account card on member detail (link, invite) stays behind `members: link`.
9. **The API is the guard; staff-app mirrors it to hide things.** Server actions check the same
   permission before calling the API, so a hidden button can't be reached by posting directly.
10. **Fail closed.** A JWT without `perms` (minted before auth-server stage 2) has no
    permissions. A session without `permissions` has none.

11. **Your own member is always readable.** `GET /members/{id}` returns the caller's own member
    (the one linked to their user) whatever their role or permissions, because My profile loads it.
    Read only: editing it still needs `members: update` and the members scope. *(Added after the
    membership-management review: without it a linked `user` got 403 on My profile.)*

## Multi-tenant later

Every tenant has the same roles, so `statements.ts` doesn't change. When tenants arrive, a user's
role becomes per tenant (likely better-auth's `organization` plugin, where membership carries the
role). Only `permissionsFor(...)`'s input changes (the active tenant's role instead of
`user.role`), plus a `tenant` claim in the JWT. Checks in the other two repos stay the same. This
is the main reason for rule 2: computing permissions in one place keeps that change in one repo.

## Stages

One repo per Claude Code session, in this order. One commit per stage, progress log in the
handoff.

### auth-server

1. **Statements.** Rewrite `statements.ts` to rule 5, including the elder `user: get` fix. Add
   `permissionsFor(role)`. Keep the `invites` gating in `auth.ts` and
   `routes/custom-auth/invites.ts` working (statement names unchanged). Update `set-role.ts` if
   it reads anything removed.
2. **Ship permissions.** `customSession` adds `permissions` to the session. Check the plugin's
   interaction with the admin plugin and `cookieCache`, and that `auth.api.getSession` callers
   still see `user`. `definePayload` adds `perms`. Verify by decoding a token for each role and
   reading `get-session` for each role.
3. **Docs.** Handoff log, `CLAUDE.md` note on where permissions come from.

### membership-management (needs auth-server stage 2 running locally)

1. **Claims and guard.** `AuthClaims.perms: dict[str, list[str]] = {}`, a `has_permission(claims,
   resource, action)` helper and a `require_permission(resource, *actions)` dependency, next to
   `require_roles`.
2. **Replace role checks.** `require_roles(...)` → `require_permission(...)` (rule 6 table). The
   small group scope is computed from `smallGroups: all` / `view`, and `FULL_ACCESS_ROLES` /
   `SCOPED_ROLES` are deleted. `sees_all_observations` comes from `viewObservations`. Then delete
   `require_roles`.
3. **Gate the open routers.** Members, applications and people per rule 6. Every route now names
   its permission.
4. **Members scope and picker.** `get_member_scope` (rule 3), scoped `GET`/`PATCH
   /members/{id}`, the email rule, and `GET /members/options` (rule 8).
5. **Docs.** Handoff log, `ARCHITECTURE.md` permissions section, a role × route table, and every
   role tried against every route.

### staff-app (needs both of the above running locally)

1. **Permissions in the session.** `AuthSession.permissions` type, `lib/auth/permissions.ts` with
   typed `Resource` / `Action` unions and `can(permissions, { resource: [actions] })` (all-of,
   the same shape better-auth uses), plus server and client helpers (`getPermissions()`,
   `usePermissions()` from `UserProvider`). Re-implement `getSmallGroupAccess`, `reportAccess`
   and `canManageLinks` on permissions so callers keep working, then inline or delete them where
   it reads better. `lib/auth/roles.ts` keeps only names and labels.
2. **Nav.** `NavItem.access` → `NavItem.requires` (a permission check). Matrix per rule 7.
3. **Pages and actions.** `notFound()` on every page per rule 7, staff dashboard sections per
   rule 7, a permission check in every server action. Remove the "TEMPORARY" comments.
   `requireStaffSession` treats a `null` role as `pending`.
4. **Leader member access.** Picker uses `/members/options`. Member names in group detail link
   to the profile when in scope. Member detail and edit for leaders, with no email field and no
   account card.
5. **Docs.** Handoff log. Mark roadmap Phase 9 done, pointing here. Regenerate API types.

### Workspace (after all three)

Update `CLAUDE.md`'s "How the services talk" (JWT carries `perms`, no role mirrors), then trim this
spec to decisions.

## Keep working (regression check, every role)

Sign-in, `/needs-verification`, `/needs-role`. Invites: create, cancel, list, accept, invite from a
member. Assign a pending role. Member link and unlink. Groups: list, detail, create, edit, close,
set leader, add / change role / remove members, including leader-access rule 9's own-row and
leader limits. Reports: list, create, edit, delete, observations visibility, the week view. Leader
dashboard, groups dashboard, staff dashboard. My profile.

## Starter prompts (copy into a fresh Claude Code session per repo)

**auth-server** (run from `members-management/auth-server`, `--add-dir ../docs`)

> Implement `../docs/specs/roles-and-permissions.md`, auth-server stages. Write
> `docs/ROLES-PERMISSIONS-HANDOFF.md` from it first, then go stage by stage on branch
> `roles-permissions`, one commit per stage, progress log filled in. Run `pnpm typecheck` and
> `biome check` each stage, and verify the session and the JWT for every role.

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `../docs/specs/roles-and-permissions.md`, membership-management stages. Write
> `docs/ROLES-PERMISSIONS-API-HANDOFF.md` from it first, then go stage by stage on branch
> `roles-permissions`, one commit per stage, progress log filled in. Run `ruff` and `ty` each
> stage and try every role against every route. auth-server's stage 2 must be running locally; if
> it isn't, tell me instead of stubbing.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `../docs/specs/roles-and-permissions.md`, staff-app stages. Write
> `docs/design/ROLES-PERMISSIONS.md` from `HANDOFF-TEMPLATE.md` first, then go stage by stage on
> branch `roles-permissions`, one commit per stage, progress log filled in. Sign in as each role
> (admin, elder, smallGroupLeader, deacon, user) and check the nav, every page by URL, and the
> *Keep working* list. Light and dark, 1440 / 1024 / 390, English and Spanish. The auth-server and
> membership-management changes must be running locally; if they aren't, tell me instead of
> stubbing.

## Not in this spec

- Changing an assigned user's role (promotion/demotion) on the users page.
- A Members list for leaders scoped to their groups (they reach profiles from the group).
- Letting leaders create members.
- Former leaders seeing past reports.
- JWT caching (roadmap Phase 10).
- Multi-tenant scoping (see *Multi-tenant later*).
