---
name: canvas-push
description: Publish committed design-canvas/ changes to the Staff App design canvas for review. Use when the user says "push to the canvas", "publish the boards", "show it on the canvas", or invokes /canvas-push. With `restore <branch>`, put main's version back after a rejected branch.
argument-hint: "[restore <branch>]"
disable-model-invocation: true
---

Send only what changed since the canvas last matched this repo, so the canvas's own conflict check
can protect edits made there. Never pass `force`.

1. **Look first.** In `design-canvas/`: uncommitted changes → stop and ask to commit them (only
   committed work is pushed). Note the branch.
2. **What to send.** From `design-canvas/`: `node scripts/changed.mjs` (normal), or on `main` with
   `restore <branch>`: `node scripts/changed.mjs <branch>` (what makes the canvas match `main`
   again). It prints `{ base, upload, remove }`. Both empty → "nothing to push", stop.
3. **Check before sending**, as `AGENTS.md` asks: `project/canvas.json` parses; every new or changed
   board has a `boards` entry and an `order` slot (and removed ones have neither); every
   `<dc-import name="X">` and `href="X.dc.html"` in the uploaded boards points at an existing file.
   Read the changed boards: anything that would go to the canvas must be design content, never a
   secret or a local path. Problems → stop and list them.
4. **Publish** with one Artifact call (at most 255 files; more → several calls, `project/canvas.json`
   in the last): `url` from `canvas-sync.json`, `root` = the absolute `design-canvas` path,
   `file_path` = the absolute path of the first file in `upload` (prefer a board over
   `canvas.json`), `files` = the rest of `upload` as `{"project/X": "project/X"}` plus
   `{"project/Y": null}` for each of `remove`, `label` = the branch name (≤ 60 chars).
5. **Refused because the canvas changed** (someone saved there since the last pull): stop. Say
   which files the refusal names, then the fix: `/canvas-pull` (on `main`), back on the branch
   `git merge main`, resolve, commit, `/canvas-push` again. Don't merge anything from the refusal
   yourself.
6. **Record** the version id the publish result gives: set `version` in `canvas-sync.json` (keep
   `url`, set `pulledAt` to now) with Edit, and commit on the current branch:
   `Push to canvas <version>` plus the attribution line. That commit is the next push's base.
7. **Report** the canvas link, what was sent and removed, and which pages to look at
   (`<url>#page-<id>` from each board's `page` in `canvas.json`). Approved → the branch's PR merges
   with `/sync-main merge`; rejected → `git switch main` and `/canvas-push restore <branch>`.
