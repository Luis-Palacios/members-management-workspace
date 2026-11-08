#!/usr/bin/env bash
# SessionStart hook: one line per repo (branch, dirty files, ahead/behind) so Claude starts with the state.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
for r in . staff-app auth-server membership-management management-infra; do
  [ -d "$r/.git" ] || continue
  b=$(git -C "$r" branch --show-current 2>/dev/null)
  d=$(git -C "$r" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  ab=$(git -C "$r" rev-list --left-right --count "@{u}...HEAD" 2>/dev/null | awk '{print "behind "$1", ahead "$2}')
  printf '%-22s %-28s dirty %s %s\n' "${r/#./workspace}" "$b" "$d" "${ab:+($ab)}"
done
exit 0
