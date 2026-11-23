import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = JSON.parse(readFileSync(0, 'utf8'));
const workspace = process.env.CLAUDE_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '../..');

if (!existsSync(workspace)) {
  process.stderr.write(`Session status failed: workspace not found: ${workspace}\n`);
  process.exit(1);
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function repoStatus(name) {
  const cwd = name === '.' ? workspace : join(workspace, name);
  if (!existsSync(join(cwd, '.git'))) return null;

  const branch = git(['branch', '--show-current'], cwd);
  const changes = git(['status', '--porcelain'], cwd);
  const upstream = git(['rev-list', '--left-right', '--count', '@{u}...HEAD'], cwd);
  const dirty = changes.status === 0 ? changes.stdout.split(/\r?\n/).filter(Boolean).length : 0;
  const aheadBehind =
    upstream.status === 0
      ? upstream.stdout.trim().split(/\s+/).map((count, i) => `${i === 0 ? 'behind' : 'ahead'} ${count}`).join(', ')
      : '';

  return `${(name === '.' ? 'workspace' : name).padEnd(22)} ${(branch.status === 0 ? branch.stdout.trim() : '').padEnd(28)} dirty ${dirty}${aheadBehind ? ` (${aheadBehind})` : ''}`;
}

const status = ['.', 'staff-app', 'auth-server', 'membership-management', 'management-infra']
  .map(repoStatus)
  .filter(line => line !== null)
  .join('\n');

// Claude Code SessionStart uses transcript_path; Copilot CLI consumes additionalContext.
if (typeof input.transcript_path === 'string') {
  process.stdout.write(status);
} else {
  process.stdout.write(JSON.stringify({ additionalContext: status }));
}
