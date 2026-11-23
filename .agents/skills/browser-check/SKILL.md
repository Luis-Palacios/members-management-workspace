---
name: browser-check
description: Prepare the local stack and check the staff app in Chrome via the scout swarm worker (or a browser-verifier subagent) using chrome-devtools MCP tools, then record the results in the handoff. Use when the user says "run the browser checks", "check it in the browser", or invokes /browser-check.
argument-hint: "[handoff or what to check]"
---

Browser checks run through the `scout` worker in `/swarm` (`gemini-4-hydrogen-medium` / Hydrogen) or a `browser-verifier` subagent (`define_subagent` with `EnableMCPTools: true`), **never** by calling Chrome tools in the main session. This skill prepares the stack, defines the check brief, and records what was found.

## 1. Stack Preparation (Main Session / Coordinator)
1. Run `/servers` (`status`). Start what's missing (this session's processes only). `staff-app` must be on the branch under test.
2. Flags the change needs (kill switches in a service's `.env`, `GUEST_GROUPS_ENABLED`, ...): if one is off, ask before changing `.env`, and say what turning it on does locally (e.g., real emails queued). A `fastapi dev` server only reloads on `.py` changes: `touch` its `main.py` to pick up `.env`, rather than killing a process the user started.

## 2. Brief for `scout` / `browser-verifier`
Provide:
- **URLs**: Local `http://localhost:3001` (`auth-server :5000`, `membership-management :8000` behind it). Production: `https://members.ekklesiaio.com`.
- **Write safety**: whether **writes are allowed** or not, and what must never be done (submit reports, invite, ban). **Production: never** — open and cancel dialogs only. Locally the DB is test data: no cleanup needed unless asked. Restore every setting changed, and the language and theme, at the end.
- **Invites**: only go to the address the brief gives (`luisz54+N@hotmail.com` or `lrpalaciosdev+N@gmail.com`); never invent another.
- **Checks**: numbered, each with steps and the **exact expected text** in `en` and `es` (from the spec or the handoff's copy table).
- **Widths & theme**: `390`, `1024`, `1440` px; dark mode at least once.
- **Roles**: the signed-in user's account and role, and any other role only if the app offers a way to act as it; otherwise `SKIPPED` (never sign out or sign in as someone else).
- **Known limits** (do not count as failures): the Chrome window stops at about 454 px; server actions hide the API request body (only `POST <page>` shows); the Next.js dev badge covers the bottom-left corner; console capture starts when first read; production checks are open-only (load pages, open and cancel dialogs, never save).

## 3. Verifier Execution Rules (`chrome-devtools` MCP Tools)
You check the ekklesiaio staff app in Chrome and report what you saw. You do not change code and you do not start servers.

- **Tools**: Use Antigravity's `chrome-devtools` MCP tools: `new_page`, `navigate_page`, `resize_page`, `take_snapshot`, `take_screenshot`, `evaluate_script`, `list_console_messages`, `list_network_requests`, `click`, `fill`, `close_page`.
- **Page lifecycle**: Open your own page with `new_page`, navigate to an `http(s)` URL (`chrome://` or blank tabs cannot be read), and close it with `close_page` when done. Never use the user's existing tabs.
- **Blocked states**:
  - If the page doesn't load, report `BLOCKED: servers not running` and stop.
  - On `/sign-in`, `/needs-verification`, or `/needs-role`, report `BLOCKED: signed out` (or the role page) and stop. Do not type passwords.
- **Dialogs**: Native dialogs (`alert`, `confirm`, `beforeunload`) freeze browser tools. HeroUI modals are DOM and fine.
- **Reading state**: Read state with `take_snapshot` or `evaluate_script` (guard for `null` before `.click()` or `getBoundingClientRect()`). Use `take_screenshot` only when layout is the check.
- **Viewports**: Call `resize_page` for each width given (`390`, `1024`, `1440`).
- **Language**: Pick language in the account menu if checking `en`/`es`. Quote UI text **exact** as shown, in the language shown.
- **Brand rules** to flag when seen: gold text on a light ground; status shown by color alone.
- **Diagnostics**: On each page, check `list_console_messages` for console errors and `list_network_requests` for 4xx/5xx responses.
- **Failure cap**: If a step fails twice, stop and report it. Do not explore other pages.

## 4. Exact Report Format
The verifier's final report must use this exact shape — no narration, no screenshots:

```text
RESULT: PASS | FAIL | BLOCKED
1. <check> @ <width>: PASS | FAIL (what you saw: exact text, values, element states)
Console errors: none | <messages>
Failed requests: none | <METHOD url status>
Not checked: none | <what and why>
```

## 5. After Verification (Main Session / Coordinator)
- Report the results table to the user (`PASS` / `FAIL` / `SKIPPED` and why).
- On a `FAIL`, fix or send it back to the repo worker (`@usher`), then check again.
- Record the results and what wasn't covered in the handoff (*Browser checks* under the progress log), and commit on the feature branch. Mention any `.env` flag left on.
