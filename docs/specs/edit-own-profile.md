# Edit own profile (cross-repo spec)

A signed-in user whose account is linked to a member can edit their own member data from
`/users/me` (My profile). Until now that page was read-only.

- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/EDIT-OWN-PROFILE-HANDOFF.md`
  - `membership-management/docs/EDIT-OWN-PROFILE-API-HANDOFF.md`
  - `staff-app/docs/design/EDIT-OWN-PROFILE.md`
- **Branch name in every repo:** `edit-own-profile`.

## Implementation order

1. `auth-server`: the `ownProfile` resource and which roles get it.
2. `membership-management`: `PATCH /me/member`.
3. `staff-app`: permission type, edit form on My profile, server action.
   One repo per Claude Code session.

## Rules (decided, don't reopen)

1. **Who:** every role except `pending` (and a missing role). Expressed as a permission,
   `ownProfile: ['update']`, in `statements.ts`: part of `appStatement` (so admin and elder get
   it) and added to `user`, `smallGroupLeader` and `deacon`. `pending` has nothing. No role name is
   checked anywhere else (roles-and-permissions rule 1).
2. **Linked only.** The member is the one whose `members.user_id` equals the JWT `sub`. Never a
   member id from the URL or the body. Not linked: 404 from the API, and the page shows no edit.
3. **Fields:** `name`, `phone`, `address`, `birthDate`, `sex`. Same validation as the member form.
   `name` cannot be null; the others can be cleared with `null`.
4. **Not editable by the user:** `email` (it is what an accepted invite matches on, so changing it
   could break the user–member link; see members rule 8, still `members: all` only), the link
   itself, small groups and roles, and the sign-in details (auth-server).
5. **API:** `PATCH /me/member`, partial update, returns the same `MemberDetail` as
   `GET /members/{id}`. It checks `ownProfile: update`, not `members: update`, and ignores the
   members scope (it can only ever touch the caller's own row). Unknown fields, `email` included,
   are rejected with 422.
6. **Freshness:** the permission arrives in the session and JWT like any other, so existing users
   get it on their next request; nothing to migrate.
7. **Unchanged:** `PATCH /members/{id}` and its permissions.

## Not in this spec

- Profile photo, language saved to the profile, change password or email (auth-server).
- An audit trail of who changed what.
