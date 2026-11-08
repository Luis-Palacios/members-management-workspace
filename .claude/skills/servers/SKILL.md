---
name: servers
description: Check, start or stop the local dev stack (Postgres container my-postgres :5432, auth-server :5000, membership-management :8000, staff-app :3001). Use before browser checks, when asked to run the app, or when a request to localhost fails.
argument-hint: "[status | start | stop] [auth | api | app]"
---

`$ARGUMENTS`: an action (default `status`), then optionally which servers (default all).

| Server | Port | Start (from its repo) |
|---|---|---|
| Postgres | 5432 | `docker start my-postgres` |
| auth-server | 5000 | `pnpm dev` |
| membership-management | 8000 | `uv run --package membership-management-api fastapi dev src/membership_management/api/main.py` |
| staff-app | 3001 | `pnpm dev` |

**status:** macOS `lsof -nP -iTCP:5000,8000,3001 -sTCP:LISTEN`; Windows PowerShell
`Get-NetTCPConnection -LocalPort 5000,8000,3001 -State Listen`, each `OwningProcess` mapped to its name.
`docker ps --filter name=my-postgres`. Health: `curl -s localhost:8000/health/live`. Report up/down per server.

**start:** status first; leave running servers alone, whoever started them (usually the user, in their own
terminal). Start a missing one with Bash `run_in_background`, wait for its port with Monitor and an
until-loop (not `sleep`), give up after ~90 s and show the last log lines. Start auth-server before
membership-management (it verifies JWTs against auth-server's JWKS).

**stop:** TaskStop for what this session started. For anything else on those ports, name the process and PID
and ask before killing it.

Don't start servers on other ports or create scratch databases to test a change unless the user agrees: the
user runs the real ones and expects checks against them.
