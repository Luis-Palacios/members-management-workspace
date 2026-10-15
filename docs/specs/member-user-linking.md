# Member ↔ user linking (cross-repo spec)

Lets an admin or elder connect a **member** (membership-management) to a **user account**
(auth-server), invite a member to sign in, and undo the connection. Today `members.user_id`
exists in the DB but nothing reads or writes it.

**Why it matters:** the link is how the system knows which member is behind a signed-in user.
The first feature that relies on it is `docs/specs/small-group-leader-access.md`: small group
leaders and deacons see and report only on the groups they lead. That spec depends on this one.

- **Design (source of truth for look):** Claude Design canvas "ekklesiaio Staff App",
  https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1, page **Member ↔ User linking**, plus the
  Members, Member detail and Add member boards, which already show the account features.
- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/MEMBER-LINKING-HANDOFF.md`
  - `membership-management/docs/MEMBER-USER-LINK-API-HANDOFF.md`
  - `staff-app/docs/design/MEMBER-USER-LINKING.md`
- **Branch name in every repo:** `member-user-linking`.

## Implementation order

1. `auth-server`: tell membership-management when an invite is accepted.
2. `membership-management`: expose `userId`, link/unlink endpoints, the internal accept endpoint,
   `get_current_member` and `GET /me`.
3. `staff-app`: all screens. It can start once step 2's endpoints exist locally.

Steps 1 and 2 are independent of each other until you test the accept flow end to end; do 2
first if you want staff-app unblocked sooner. One repo per Claude Code session.

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
   leadership data, so it works out the current member from `sub` itself (see *The current
   member* below). Every consumer that needs "my member" goes through membership-management's
   API. A copy in auth-server would be a second source of truth: if an unlink half-failed, the
   user would keep access through their token.

## The current member

- membership-management has a dependency `get_current_member(claims) -> Member | None` that
  looks up `members.user_id == claims.sub` (unique, indexed). Every endpoint that needs "me" uses
  it, or joins on `members.user_id` directly in its query.
- `GET /me` gives staff-app what it needs per request (nav, what to show) without asking
  auth-server. staff-app wraps the call in React `cache()` so a page calls it once per request.
- A user with no linked member is normal (rule 2): `member` is `null` and `leads` is empty.
- An *orphaned* link (D2) can't be matched by `get_current_member`: no live user has that id.

## Decisions to confirm before building

**D1: how the link gets set when an invite is accepted.** Recommended (and what the handoffs
assume): auth-server's `afterAcceptInvite` hook calls an internal membership-management endpoint
with `{ userId, email }`; membership-management links the **one** member whose email equals that
email (case-insensitive) and has no `user_id`. No match, several matches, or already linked: it
does nothing and returns 200; the user then simply shows up as a *Suggested match* in the link
dialog. The call is best-effort: a failure is logged and never fails the invite acceptance.
Service-to-service auth is a shared secret in a header (`INTERNAL_API_TOKEN`), as the JWT path only
covers browser sessions.

Alternative if you want a strict member↔invite tie (instead of matching by email): record
`(member_id, invite_id)` in membership-management when staff-app creates the invite and link by
that. More tables and one more endpoint; only worth it if two members could share an email,
which `DuplicateMemberEmailError` already prevents.

Since the link now grants access (rule 9, leader-access spec), a wrong auto-link would expose
another member's groups. Unique member emails keep this safe. If staff change the member's email
after inviting, the emails no longer match and nothing is linked. That fails safe: staff link by
hand from the dialog.

**D2: orphaned links.** If a user is deleted in auth-server, `members.user_id` dangles. Spec: no
cascade; staff-app shows the member as *Linked* with an "Account not found" state and offers
Unlink. Revisit when user deletion exists.

## Contracts between services

### membership-management (FastAPI, camelCase JSON)

| Method and path | Who | Body | Result |
| --- | --- | --- | --- |
| `GET /members`, `GET /members/{id}` | any authenticated | none | now also return `userId: string \| null` |
| `PUT /members/{id}/user` | `admin`, `elder` | `{ "userId": "<auth user id>" }` | 200 `MemberDetail`. Same user again: 200 (idempotent) |
| `DELETE /members/{id}/user` | `admin`, `elder` | none | 204. Already unlinked: 204 |
| `POST /internal/member-links/accepted-invite` | service token | `{ "userId", "email" }` | 200 `{ "linked": bool, "memberId": int \| null }` |
| `GET /me` | any authenticated | none | 200 `{ "userId", "role", "member": { "id", "name" } \| null, "leads": [{ "smallGroupId", "name", "role": "leader" \| "co_leader" }] }` |

`leads` holds only *active* periods (`left_at IS NULL`); a former leader gets nothing for that
group.

Errors: `404` member not found; `409` "This member is already linked to another user." (member has
a different `user_id`); `409` "This user is already linked to another member." (unique violation);
`403` role not allowed; `422` empty `userId`. The API does **not** check that `userId` exists in
auth-server; staff-app only offers real users.

### auth-server (better-auth)

- `afterAcceptInvite` (better-invite option) posts `{ userId: invitedUser.id, email: invitation.email }`
  to the internal endpoint with header `X-Internal-Token`.
- Existing endpoints staff-app already uses and keeps using: `admin/list-users` (session cookie),
  `/api/custom-auth/invites` (all invites, admin/elder), `invite/create` and `invite/cancel`
  (better-invite). staff-app needs one new read: a single user by id for the User detail page.
  Use better-auth's `admin/get-user`; no new auth-server endpoint.

### staff-app (server-side only; the browser never calls the APIs)

- `api/members-api`: `linkMemberUser(id, userId)`, `unlinkMemberUser(id)`, `getMe()` (wrapped in
  React `cache()`); `userId` added to `MemberSummary`/`MemberDetail`.
- Server actions revalidate `/members`, `/members/[id]`, `/users`, `/users/[id]`.
- Suggested match = user whose email equals the member's email (case-insensitive), not already
  linked (a user is "linked" if some member's `userId` equals their id, from `listMembers()`).
- Invited = a `pending` invite whose email equals the member's email, from `listInvites()`.

## Starter prompts (copy into a fresh Claude Code session per repo)

**auth-server** (run from `members-management/auth-server`, add `--add-dir ../docs`)

> Implement `docs/MEMBER-LINKING-HANDOFF.md` in this repo. Read `../docs/specs/member-user-linking.md`
> first for the rules and the contract. Work stage by stage on branch `member-user-linking`, one
> commit per stage, and fill in the progress log as you go. Stop and tell me if a stage needs
> something from another repo.

**membership-management** (run from `members-management/membership-management`, `--add-dir ../docs`)

> Implement `docs/MEMBER-USER-LINK-API-HANDOFF.md` in this repo. Read
> `../docs/specs/member-user-linking.md` first for the rules and the contract. Stage by stage on
> branch `member-user-linking`, one commit per stage, progress log filled in. Run `ruff` and `ty`
> each stage and try the endpoints through `/docs`. Follow the Alembic steps in `CLAUDE.md` if a
> migration is needed.

**staff-app** (run from `members-management/staff-app`, `--add-dir ../docs --add-dir ../membership-management`)

> Implement `docs/design/MEMBER-USER-LINKING.md` in this repo. Read
> `../docs/specs/member-user-linking.md` first. The design is the Staff App canvas page
> "Member ↔ User linking" plus the Members / Member detail / Add member boards, listed in the
> handoff. Stage by stage on branch `member-user-linking`, one commit per stage, progress log
> filled in, light and dark, 1440 / 1024 / 390, English and Spanish. The membership-management
> endpoints must be running locally; if they aren't there yet, tell me instead of stubbing.

## Not in this spec

- Per-church "every user must be a member" setting.
- User edit options (profile, role, ban) on User detail beyond the read-only account card.
- Linking from the mobile app, bulk linking, and merging duplicate members.
- Multi-tenant (ministry/church) scoping of links.
