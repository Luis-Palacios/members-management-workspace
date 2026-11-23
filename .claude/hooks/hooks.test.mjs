import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const hooks = dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'workspace-hooks-'));
after(() => rmSync(temp, { recursive: true, force: true }));
const repo = join(temp, 'repo');
const worktree = join(temp, 'worktree');
const emptyHooks = join(temp, 'empty-hooks');
mkdirSync(repo);
mkdirSync(emptyHooks);
const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
git('init', '-q', repo);
git('-C', repo, '-c', 'user.name=Hook Test', '-c', 'user.email=hooks@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${emptyHooks}`, 'commit', '-q', '--allow-empty', '-m', 'Initial');
git('-C', repo, 'worktree', 'add', '-q', '-b', 'feature/hook-test', worktree);

function run(script, input, env = {}) {
  return spawnSync(process.execPath, [join(hooks, script)], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('branch hook preserves allow, deny, and malformed-input behavior', () => {
  for (const [command, expected] of [
    ['git status', 0],
    ['git switch -c feature/example', 0],
    ['git switch -c BAD_BRANCH', 2],
  ]) {
    const result = run('branch-name.mjs', JSON.stringify({ tool_input: { command } }));
    assert.equal(result.status, expected);
    if (expected === 2) assert.match(result.stderr, /BAD_BRANCH/);
  }
  assert.notEqual(run('branch-name.mjs', '{invalid').status, 0);
});

test('status detects Git worktrees without a shell script and emits Claude and Copilot formats', () => {
  assert.equal(statSync(join(worktree, '.git')).isFile(), true);
  const env = { CLAUDE_PROJECT_DIR: worktree };
  const claude = run('session-status.mjs', JSON.stringify({ transcript_path: 'test' }), env);
  const copilot = run('session-status.mjs', '{}', env);
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(copilot.status, 0, copilot.stderr);
  assert.match(claude.stdout, /workspace\s+feature\/hook-test\s+dirty \d+/);
  assert.equal(JSON.parse(copilot.stdout).additionalContext, claude.stdout);
});

test('status reports malformed input and an unavailable workspace', () => {
  assert.notEqual(run('session-status.mjs', '{invalid').status, 0);
  const result = run('session-status.mjs', '{}', { CLAUDE_PROJECT_DIR: join(temp, 'missing') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Session status failed/);
});
