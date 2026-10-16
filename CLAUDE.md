# CLAUDE.md (workspace)

Loaded when Claude Code runs from this folder or any service folder under it. Keep it short: it is
a map. Each service's own `CLAUDE.md` has its commands and conventions and wins on detail.

## Layout

`members-management/` is a git repo that tracks only this file, `README.md` and `docs/`. The
services below it are separate repos (see `README.md`):

- `staff-app/`: Next.js 16 staff app, the only front-end. Browser talks only to staff-app.
  Server actions call the two APIs below server-to-server.
- `membership-management/`: FastAPI. Members, small groups, applications. Own Postgres DB
  (`members`) plus a read-only legacy SQL Server DB (`assimilation`).
- `auth-server/`: Node + better-auth (Hono, Drizzle, Postgres). Users, sessions, roles, invites.
  Own DB, separate from membership-management's.
- Planned: Flask and NestJS services; they will be added here as sibling repos.

## How the services talk

- staff-app → auth-server: session cookie (admin/invite endpoints) or a short-lived JWT minted from
  the session (`/api/auth/token`).
- staff-app → membership-management: `Authorization: Bearer <JWT>`. The JWT carries `sub` (user
  id), `role` (display only) and `perms`; membership-management verifies it against auth-server's
  JWKS.
- Databases are separate, so anything that points across services (e.g. `members.user_id`) is a
  string reference with **no foreign key**. The application keeps it consistent.
- What a role can do is defined only in `auth-server/src/permissions/statements.ts`. auth-server
  ships the computed permissions in the session (`permissions`) and the JWT (`perms`); staff-app
  and membership-management check permissions, never role names
  (`docs/specs/roles-and-permissions.md`, which also lists what else to touch when adding a
  resource, action or role).
- The link from a user to their member lives only in membership-management (`members.user_id`).
  The JWT doesn't carry a member id; membership-management resolves it from `sub`.

## Specs and handoffs

- Cross-repo specs: `docs/specs/<feature>.md` (here). They hold the rules, the contracts between
  services and the implementation order.
- Per-repo handoffs follow each repo's existing convention: `staff-app/docs/design/<FEATURE>.md`
  (from `HANDOFF-TEMPLATE.md`), `membership-management/docs/<FEATURE>-API-HANDOFF.md`,
  `auth-server/docs/<FEATURE>-HANDOFF.md`. Stage by stage, one reviewable commit per stage, on a
  feature branch, progress log at the top.
- Design source of truth for the staff app: Claude Design canvas "ekklesiaio Staff App"
  (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1).
- A spec is done when its stages are ticked in each repo's progress log. Then trim the detail that
  now lives in code, and keep only decisions in `docs/specs/`.

## Working across repos

- Implement a feature **one repo per session, in the order the spec lists**, and commit in that
  repo. Do not make one commit that spans repos.
- If a stage needs something from another repo that isn't there yet, say so and stop; don't stub it
  in committed code.
- Mention in your final message anything another repo must change (token re-sync, role mirror,
  API type regeneration).
