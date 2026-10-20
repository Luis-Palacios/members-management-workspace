# User admin actions: change role, ban, unban (cross-repo spec)

On `/users/[id]` staff can change a user's role and ban or unban them. Until now the page only
shows the account and lets you link or unlink the member. Built on better-auth's `admin` plugin
(`/admin/set-role`, `/admin/ban-user`, `/admin/unban-user`), which auth-server already installs.

- **Repo handoffs (the work, stage by stage):**
  - `auth-server/docs/USER-ADMIN-ACTIONS-HANDOFF.md`
  - `staff-app/docs/design/USER-ADMIN-ACTIONS.md`
  - membership-management: nothing to do.
- **Branch name in every repo:** `user-admin-actions`.

## Implementation order

1. `auth-server`: the `adminAccounts` resource and the guard hook (rules 5-7).
2. `staff-app`: permission type, Account card actions, i18n. One repo per Claude Code session.

## Rules (decided, don't reopen)

1. **Actions:** change role, ban (optional reason, optional expiry), unban. Nothing else from the
   plugin (sessions, edit user, set password, delete, impersonate) is in this spec.
2. **Who, by permission** (roles-and-permissions rule 1): change role needs `user: set-role`; ban
   and unban both need `user: ban` (better-auth checks `ban` for unban too). `admin` and `elder`
   already have both in `statements.ts`, so no role grants change. Everyone else gets no controls,
   and the server actions check before calling auth-server.
3. **Where it runs:** from staff-app straight to better-auth with the session cookie, like
   `AssignPendingRole` does today (`authClient.admin.setRole`). membership-management is not
   involved: it reads `role` and `perms` from the next JWT (roles-and-permissions rule 2).
4. **Role list:** every role in `lib/auth/roles.ts`, including `pending` (this is also how a user
   is demoted back to no access). Assigning `admin` asks for confirmation, as it does today.
5. **Admin accounts are protected.** New resource `adminAccounts: ['manage']`, given **only** to
   `admin` (not part of `appStatement`, so `elder` does not inherit it). Without it the caller
   cannot: change the role of a user who has `adminAccounts: manage`, assign a role that has it,
   ban or unban such a user. The check compares permissions (`permissionsFor(role)`), not role
   names. An elder can therefore manage everyone else but never touch or create an admin.
6. **Not yourself.** You cannot change your own role (better-auth does not stop this) or ban
   yourself (better-auth already refuses, `YOU_CANNOT_BAN_YOURSELF`). staff-app hides the controls
   on your own row; auth-server enforces it.
7. **The guard lives in auth-server**, as a `hooks.before` on `/admin/set-role`, `/admin/ban-user`
   and `/admin/unban-user`, so it holds for any caller, not just this UI. It returns 403 with a
   clear message. staff-app also hides what the caller can't do, but the server is the guard.
8. **Ban semantics are better-auth's:** banning revokes all the user's sessions and blocks new
   sign-ins until the ban expires or the user is unbanned. The reason is stored in `banReason`.
   Expiry is offered as "no expiry" or a number of days.
9. **The member link is untouched.** Changing a role or banning a user never unlinks their member
   (`members.user_id`); that stays the link card's job.
10. **Freshness:** a role change shows on the target's next request and next minted JWT (rule 2 of
    roles-and-permissions); a ban takes effect at once because the sessions are revoked.
11. **UI:** the existing Account card gets a role control and a Ban / Unban button next to the
    status; the banned state shows reason and expiry. Both use the confirm dialog and the toast
    already used by the member link actions.

## Not in this spec

- Revoke or list sessions, edit name or email, set password, delete user, impersonate.
- An audit trail of who changed what.
- Notifying the user by email.
- Changing roles in bulk, or from the users list.
