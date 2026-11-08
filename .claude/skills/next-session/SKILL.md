---
name: next-session
description: Write the prompt that starts the next stage in a new Claude session in another repo. Use when the user asks "give me a prompt to start the next session" or "a prompt for staff-app".
argument-hint: "<repo> [spec]"
---

Write a self-contained prompt for a new session started in `<repo>` (`$ARGUMENTS`). That session starts cold.

The prompt, in this order, as one fenced block the user can paste:
1. What to implement: the handoff (`docs/<FEATURE>-API-HANDOFF.md`, `docs/design/<FEATURE>.md` or
   `docs/<FEATURE>-HANDOFF.md`), and "Read ../docs/specs/<feature>.md first", with the rule numbers that matter.
2. The branch (`feature/<spec-slug>`, the same name as in the other repos), and whether it exists yet. Stage by stage, one commit per stage, progress log updated with
   each commit. Where to stop and wait for the user (e.g. after each stage, or before the PR).
3. What the other repos already did that this one depends on: merged or on which branch, the endpoint or
   permission names and shapes, and anything that differs from the spec (from their "Decisions and
   deviations").
4. Local state: which servers are running and on which ports, that the dev DB is local test data
   (writes OK, no cleanup), and which test sign-ins to use (`luisz54+N@hotmail.com` /
   `lrpalaciosdev+N@gmail.com`: say the next unused N, or ask the user).
5. Browser checks go through the `browser-verifier` agent.
6. What to report back for this workspace (new permission names, API type regeneration, token re-sync).

Under 25 lines. No restating the spec, only pointing at it. Don't commit anything in this skill.
