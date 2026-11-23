import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = JSON.parse(readFileSync(0, 'utf8'));
const workspace = process.env.CLAUDE_PROJECT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const result = spawnSync('bash', [resolve(workspace, '.claude/hooks/session-status.sh')], {
  cwd: workspace,
  env: { ...process.env, CLAUDE_PROJECT_DIR: workspace },
  encoding: 'utf8',
});

if (result.error || result.status !== 0) {
  process.stderr.write(`Session status failed: ${result.error?.message || result.stderr || `exit ${result.status}`}\n`);
  process.exit(1);
}

const status = result.stdout.trimEnd();
if (typeof input.transcript_path === 'string') {
  process.stdout.write(status);
} else {
  process.stdout.write(JSON.stringify({ additionalContext: status }));
}
