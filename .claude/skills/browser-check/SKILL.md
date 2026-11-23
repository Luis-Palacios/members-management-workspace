---
name: browser-check
description: Prepare the local stack and run the browser-verifier agent for a staff-app change, then record the results in the handoff. Use when the user says "run the browser checks", "check it in the browser", or invokes /browser-check.
argument-hint: "[handoff or what to check]"
---

Browser checks go through the `browser-verifier` agent (it runs on Sonnet), never Chrome tools in the
main session. This skill gets the stack ready, writes the agent's prompt and records what it found.

**Stack**
1. `/servers status`. Start what's missing (this session's processes only). staff-app must be on the
   branch under test.
2. Flags the change needs (kill switches in a service's `.env`, `GUEST_GROUPS_ENABLED`, …): if one is
   off, ask before changing `.env`, and say what turning it on does locally (e.g. real emails queued).
   A `fastapi dev` server only reloads on `.py` changes: `touch` its `main.py` to pick up `.env`,
   rather than killing a process the user started.

**Prompt for `browser-verifier`** (`run_in_background: true`): local URL; **writes allowed** or not, and
what must never be done (submit reports, invite, ban); restore every setting changed, and the language
and theme, at the end; the checks, numbered, each with steps and the **exact expected text** in en and
es (from the spec or the handoff's copy table); widths 390/1024/1440, dark mode at least once; roles:
the signed-in user's role, and any other role only if the app offers a way to act as it, otherwise
SKIPPED (never sign out or sign in as someone else); console errors and failed requests; a results
table and a "Not checked" list.

**Known limits** (tell the agent, and don't count them as failures): the Chrome window stops at about
454 px; server actions hide the API request body (only `POST <page>` shows); the Next.js dev badge
covers the bottom-left corner; console capture starts when the agent first reads it. Production checks
are open-only: load pages, open and cancel dialogs, never save.

**After**: report the table to the user (PASS / FAIL / SKIPPED and why). On a FAIL, fix or send it back
to the repo's subagent, then check again. Record the results and what wasn't covered in the handoff
(*Browser checks* under the progress log), commit on the feature branch. Mention any `.env` flag left
on.
