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
handoff doc inside every repo it touches (see `CLAUDE.md`). Each spec's **Status** line at the top
is the one place its status is kept, so it isn't repeated here.

| Spec | What it covers |
| --- | --- |
| [Roles and permissions](docs/specs/roles-and-permissions.md) | Permissions computed in auth-server, checked everywhere else |
| [Member ↔ user linking](docs/specs/member-user-linking.md) | Linking a user to their member record |
| [User admin actions](docs/specs/user-admin-actions.md) | Change role, ban, unban |
| [Edit own profile](docs/specs/edit-own-profile.md) | My profile edits of one's own member |
| [Member sex](docs/specs/member-sex.md) | The `sex` field on members |
| [Inactive members](docs/specs/inactive-members.md) | Marking members inactive and reactivating them |
| [Small group leader access](docs/specs/small-group-leader-access.md) | What leaders see of their own groups |
| [Small group reports](docs/specs/small-group-reports.md) | Weekly reports: attendance, no meeting |
| [Report items, person tags and the person timeline](docs/specs/report-tags.md) | Report sections as items, `@` tags, timelines |
| [Report auto-save](docs/specs/report-autosave.md) | Drafts on the server, Draft / Submitted |
| [Church-wide no meeting](docs/specs/church-wide-no-meeting.md) | One no meeting for every group in a week |
| [Groups dashboard](docs/specs/groups-dashboard.md) | The groups overview |
| [Guest small groups](docs/specs/guest-small-groups.md) | Groups for guests who aren't members |
| [Inactive guests](docs/specs/inactive-guests.md) | Guest status and the timeline |
| [Report conversations](docs/specs/report-conversations.md) | Elder–leader threads on reports, inbox, conversation emails |
| [Prayer & follow-up](docs/specs/prayer-follow-up.md) | Threads on report sections, prayer pages |
| [Report submitted emails](docs/specs/report-submitted-emails.md) | Emails to watchers when a report is submitted |
| [Care and the care log](docs/specs/care.md) | Care follow-up and its log |

New specs start with `/new-spec`. `/build-spec` then builds one from this workspace, with a
subagent per repo that writes its own handoff, and UI checks run with `/browser-check`.
