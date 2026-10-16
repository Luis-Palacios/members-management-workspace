# Member sex (cross-repo spec)

Members get an optional **sex** field, **Male** or **Female** only. Staff set it on the member
form (add and edit); it shows on the member detail page and on My profile. Nothing else uses it
yet: no list column, no filter, no reports.

- **Repo handoffs (the work, stage by stage):**
  - `membership-management/docs/MEMBER-SEX-API-HANDOFF.md`
  - `staff-app/docs/design/MEMBER-SEX.md`
- **auth-server: no change.** Users have no sex; it lives only on the member.
- **Design:** Staff App canvas (https://claude.ai/artifact/PLs9gdHVcigkRSAWJrsKs1), page
  "Members": boards `MemberForm` (and its `-Edit`, `-Errors`, `-Dark` wrappers), `MemberDetail`,
  `MyProfile`.
- **Branch name in every repo:** `member-sex`.

## Implementation order

1. `membership-management`: column, migration, seed, API fields.
2. `staff-app`: types, form, detail/My profile. It can start once step 1 runs locally.
   One repo per Claude Code session.

## Rules (decided, don't reopen)

1. **Values:** `male` | `female`, or no value. No "other", no "prefer not to say".
2. **Optional** everywhere: on create, on edit, in the database (nullable). Existing members stay
   empty (no backfill); the UI shows *Not provided*.
3. **Stored as an enum**: a `VARCHAR` + `CHECK` column `members.sex`, the same pattern as
   `small_group_members.role` (no native Postgres `ENUM` type). The API and the staff app use the
   lowercase values; only the UI translates them (Male/Female, Masculino/Femenino).
4. **API:** `sex` is on `MemberDetail` (GET/POST/PATCH responses) and accepted by POST and PATCH
   (`null` on PATCH clears it). It is **not** added to the members list (`MemberSummary`) or to
   `GET /me`.
5. **Who can see and edit it:** the same as every other member field today. No new permission.
6. **Not used by reports, groups or the dashboard.** Leaders don't record attendance by sex.

## Not in this spec

- A Sex column or filter on the Members list.
- Importing sex from the legacy assimilation DB (`Persona`).
- Any report or dashboard breakdown by sex.
