// SessionStart: run .claude/hooks/session-status.sh and emit Antigravity SessionStart injectSteps JSON.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let input = {};
try {
  const raw = readFileSync(0, 'utf8').trim();
  if (raw) input = JSON.parse(raw);
} catch {
  // ignore empty or non-JSON stdin
}

const workspaceDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = resolve(workspaceDir, '.claude/hooks/session-status.sh');

let output = '';
try {
  output = execFileSync('bash', [scriptPath], {
    cwd: workspaceDir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: workspaceDir },
    encoding: 'utf8',
  }).trimEnd();
} catch {
  output = '';
}

if (!output) {
  process.stdout.write('{}');
} else {
  process.stdout.write(
    JSON.stringify({
      injectSteps: [
        {
          systemMessage: {
            systemMessage: output,
            metadata: {
              user_markdown: '```text\n' + output + '\n```',
            },
          },
        },
      ],
    }),
  );
}
