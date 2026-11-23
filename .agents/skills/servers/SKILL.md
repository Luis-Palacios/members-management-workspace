---
name: servers
description: Check, start, or stop the local dev stack (Postgres container my-postgres :5432, auth-server :5000, membership-management :8000, staff-app :3001). Use before browser checks, when asked to run the app, or when a request to localhost fails.
argument-hint: "[status | start | stop] [auth | api | app]"
---

`$ARGUMENTS`: an action (default `status`), then optionally which servers (default all).

| Server | Port | Start (from its repo) |
|---|---|---|
| Postgres | 5432 | `docker start my-postgres` |
| auth-server | 5000 | `pnpm dev` |
| membership-management | 8000 | `uv run --package membership-management-api fastapi dev src/membership_management/api/main.py` |
| staff-app | 3001 | `pnpm dev` |

**status:**
- macOS: `lsof -nP -iTCP:5000,8000,3001 -sTCP:LISTEN`
- Windows PowerShell: `Get-NetTCPConnection -LocalPort 5000,8000,3001 -State Listen`, each `OwningProcess` mapped to its name.
- Postgres: `docker ps --filter name=my-postgres`
- Health: `curl -s localhost:8000/health/live`
Report up/down per server.

**start:**
Check status first; leave running servers alone, whoever started them (usually the user, in their own terminal). Start `auth-server` before `membership-management` (it verifies JWTs against `auth-server`'s JWKS).

Start each missing server using `run_command` with `IsDaemon: true` and `WaitMsBeforeAsync: 500`. Then wait for its port to listen using a separate `run_command` with an `until` loop (not bare `sleep`), giving up after ~90 s; if it fails or times out, inspect the daemon's logs via `manage_task` (`Action: "status"`, `TaskId: "<id>"`) and report the last log lines.

**stop:**
Use `manage_task` with `Action: "kill"` (`TaskId: "<id>"`) for daemon tasks started by this session (`manage_task` with `Action: "list"` shows active tasks). For anything else listening on those ports, name the process and PID and ask before killing it.

Don't start servers on other ports or create scratch databases to test a change unless the user agrees: the user runs the real ones and expects checks against them.
