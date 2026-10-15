# members-management (workspace)

Umbrella repo for the EkklesiaIO / members-management workspace. It tracks only the files shared
across services (`CLAUDE.md`, `docs/`); every service below is its own git repo, cloned inside this
folder and ignored by this repo's `.gitignore`.

| Folder | What it is | Repo |
| --- | --- | --- |
| `staff-app/` | Next.js 16 + HeroUI v3 staff app (the only front-end) | `git@github.com:Luis-Palacios/staff-app.git` |
| `membership-management/` | FastAPI microservice: members, small groups, applications | `git@github.com:Luis-Palacios/membership-management.git` |
| `auth-server/` | Node better-auth service: users, sessions, roles, invites | `git@github.com:Luis-Palacios/auth-server.git` |
| `management-infra/` | Deployment roadmap and infra | `git@github.com:Luis-Palacios/management-infra.git` |
| `ekklesiaio-landing/` | Public landing page and waitlist | `git@github.com:Luis-Palacios/ekklesiaio-landing.git` |

## Setting up a new computer

```bash
git clone <this-repo-url> members-management
cd members-management
git clone git@github.com:Luis-Palacios/staff-app.git
git clone git@github.com:Luis-Palacios/membership-management.git
git clone git@github.com:Luis-Palacios/auth-server.git
git clone git@github.com:Luis-Palacios/management-infra.git
git clone git@github.com:Luis-Palacios/ekklesiaio-landing.git
```

Then follow each repo's own README / `CLAUDE.md` for installing and running it.

## Cross-repo specs

Features that span services live in `docs/specs/`. Each one has a cross-repo overview plus a
handoff doc inside every repo it touches (see `CLAUDE.md`).

| Spec | Status |
| --- | --- |
| [Member ↔ user linking](docs/specs/member-user-linking.md) | Implemented; branches `member-user-linking` await review and merge |
