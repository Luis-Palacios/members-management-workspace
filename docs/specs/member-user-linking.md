# Member ↔ user linking (cross-repo spec)

**Status: implemented** on branch `member-user-linking` in `auth-server`, `membership-management` and
`staff-app` (all stages ticked in each repo's progress log). This file keeps the decisions; the work
and its history live in the handoffs and in the code.

Lets an admin or elder connect a **member** (membership-management) to a **user account**
(auth-server), invite a member to sign in, and undo the connection. The link is how the system
knows which member is behind a signed-in user. The first feature that relies on it is
`docs/specs/small-group-leader-access.md`: small group leaders and deacons see and report only on
the groups they lead.

- **Design (source of truth for look):** Claude Design canvas "ekklesiaio Staff App",
  https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1, page **Member ↔ User linking**.
- **Repo handoffs (stages, deviations, what was tried):**
  - `auth-server/docs/MEMBER-LINKING-HANDOFF.md`
  - `membership-management/docs/MEMBER-USER-LINK-API-HANDOFF.md`
  - `staff-app/docs/design/MEMBER-USER-LINKING.md`
- **Contracts:** the FastAPI `/docs` page of membership-management is the reference for the
  endpoints (`userId` on members, `PUT`/`DELETE /members/{id}/user`,
  `POST /internal/member-links/accepted-invite`, `GET /me`).

## Rules (decided, don't reopen)

1. **1:1.** A member has at most one user; a user is linked to at most one member. The link is
   stored on the member: `members.user_id` (String(255), nullable, unique). No FK; the databases
   are separate, so the app keeps it consistent.
2. **A user doesn't have to be a member.** Staff and admins can have no member. A per-church
   setting ("every user must be a member") is **future**, don't build it.
3. **Matching by email is only a suggestion** in the link dialogs. Nothing is linked from an email
   match alone, except the invite-acceptance case in D1 below.
4. **Unlink removes only the relationship.** The user keeps their role; the member keeps their
   profile and small groups. Managing roles happens on the Users pages. For a scoped role
   (`smallGroupLeader`, `deacon`) unlinking means they no longer see any group, because their
   access comes from the groups their member leads. The unlink dialog says so.
5. **Who can do it:** only roles `admin` and `elder` can link, unlink and invite from a member.
   Everyone else doesn't see the controls (and the API refuses with 403). Role names come from
   `staff-app/lib/auth/roles.ts` (`STAFF_ADMIN_ROLES`).
6. **Invites from a member** use the existing better-invite flow with a fixed role
   `smallGroupLeader` ("Small Group Leader"). The user does not exist until the invite is
   accepted, so **"Invited" = a pending invite for the member's email**. The role can be changed
   later from Users.
7. **Account status of a member** is one of: *No account* (no `user_id`, no pending invite),
   *Invited* (no `user_id`, pending invite for their email), *Linked* (`user_id` set).
8. Copy avoids gendered pronouns ("They", "their").
9. **The member id is not copied to auth-server.** The JWT stays `{ sub, role }` and the
   better-auth user table gets no member field. membership-management owns the link and the
   leadership data, so it works out the current member from `sub` itself. Every consumer that
   needs "my member" goes through membership-management's API. A copy in auth-server would be a
   second source of truth: if an unlink half-failed, the user would keep access through their token.

## The current member

- membership-management has a dependency `get_current_member(claims) -> Member | None` that
  looks up `members.user_id == claims.sub` (unique, indexed). Every endpoint that needs "me" uses
  it, or joins on `members.user_id` directly in its query.
- `GET /me` gives staff-app what it needs per request (nav, what to show) without asking
  auth-server: `{ userId, role, member: { id, name } | null, leads: [{ smallGroupId, name, role }] }`.
  `leads` holds only *active* periods (`left_at IS NULL`). staff-app wraps the call in React
  `cache()` so a page calls it once per request.
- A user with no linked member is normal (rule 2): `member` is `null` and `leads` is empty.
- An *orphaned* link (D2) can't be matched by `get_current_member`: no live user has that id.

## Decisions

**D1: how the link gets set when an invite is accepted.** auth-server's `afterAcceptInvite` hook
calls an internal membership-management endpoint with `{ userId, email }`; membership-management
links the **one** member whose email equals that email (case-insensitive) and has no `user_id`.
No match, several matches, or already linked: it does nothing and returns 200; the user then shows
up as a *Suggested match* in the link dialog. The call is best-effort: a failure is logged and
never fails the invite acceptance. Service-to-service auth is a shared secret in the
`X-Internal-Token` header (`INTERNAL_API_TOKEN`, 32+ characters, the same value in both services;
`MEMBERSHIP_API_URL` in auth-server). Both are required in production and optional locally, where
the notifier or the route is then off.

- Safe because member email is unique ignoring case (a unique index on `lower(email)`,
  `DuplicateMemberEmailError`). The link grants access (rule 9, leader-access spec), so a wrong
  auto-link would expose another member's groups.
- If staff change the member's email after inviting, the emails no longer match and nothing is
  linked. That fails safe: staff link by hand from the dialog.
- The invite counts as accepted only once the invited email is **verified**, not at sign-up: until
  then the user is `pending` and the invite stays `pending`. Tested end to end on 2026-10-15.
- Not chosen: recording `(member_id, invite_id)` when staff-app creates the invite. More tables and
  one more endpoint, only worth it if two members could share an email.

**D2: orphaned links.** If a user is deleted in auth-server, `members.user_id` dangles. No cascade;
staff-app shows the member as *Linked* with an "Account not found" state and offers Unlink.
Revisit when user deletion exists.

**API behavior worth keeping in mind:** link is idempotent for the same user (200), unlink is
idempotent (204); `409` if the member already has a different user or the user is already linked
to another member; `403` for roles other than admin/elder; the API does not check that `userId`
exists in auth-server (staff-app only offers real users).

## Not in this spec

- Per-church "every user must be a member" setting.
- User edit options (profile, role, ban) on User detail beyond the read-only account card.
- Linking from the mobile app, bulk linking, and merging duplicate members.
- Multi-tenant (ministry/church) scoping of links.
