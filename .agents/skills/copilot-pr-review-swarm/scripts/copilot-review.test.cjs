'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./copilot-review.cjs');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const sha = 'a'.repeat(40);

function fakeGitHub({ app = { id: 5895023, slug: 'lp-copilot-reviewer' },
  installations = [{ id: 12, account: { login: 'Owner' } }],
  permission = 'write', repoStatus = 200, head = sha,
  reviewStatus = 200, reviewData = { id: 77 } } = {}) {
  const calls = [];
  const fetchFn = async (url, options) => {
    const route = new URL(url).pathname;
    calls.push({ route, method: options.method, body: options.body });
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.equal(options.redirect, 'error');
    let data;
    let status = 200;
    if (route === '/app') data = app;
    else if (route === '/app/installations') data = installations;
    else if (route === '/app/installations/12/access_tokens') data = { token: 'test-token', permissions: { pull_requests: permission } };
    else if (route === '/repos/Owner/repo') {
      status = repoStatus;
      data = { full_name: 'Owner/repo' };
    } else if (route === '/repos/Owner/repo/pulls/42') data = { state: 'open', head: { sha: head } };
    else if (route === '/repos/Owner/repo/pulls/42/reviews') {
      status = reviewStatus;
      data = reviewData;
    }
    else throw new Error('Unexpected request');
    return { ok: status === 200, status, json: async () => data };
  };
  return { calls, fetchFn };
}

function withPayload(payload, callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-review-test-'));
  const file = path.join(dir, 'payload.json');
  fs.writeFileSync(file, JSON.stringify(payload));
  return Promise.resolve().then(() => callback(file)).finally(() => {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
  });
}

test('check verifies the app, matching owner, repository and permission', async () => {
  const fake = fakeGitHub();
  const result = await run(['check', 'Owner/repo'], privateKey, fake.fetchFn);
  assert.match(result, /lp-copilot-reviewer\[bot\].*installation 12.*pull request permission: write/);
  assert.deepEqual(fake.calls.map((call) => call.method), ['GET', 'GET', 'POST', 'GET']);
  assert.deepEqual(JSON.parse(fake.calls[2].body), { repositories: ['repo'] });
});

test('fails closed for the wrong app, missing installation or inaccessible repository', async () => {
  for (const [options, expected] of [
    [{ app: { id: 1, slug: 'other' } }, /identity does not match/],
    [{ installations: [{ id: 12, account: { login: 'Other' } }] }, /No unique/],
    [{ repoStatus: 404 }, /HTTP 404/]
  ]) {
    const fake = fakeGitHub(options);
    await assert.rejects(run(['check', 'Owner/repo'], privateKey, fake.fetchFn), expected);
    assert.equal(fake.calls.some((call) => call.route.endsWith('/reviews')), false);
  }
});

test('requires authorization and the reviewed SHA before any review request', async () => {
  const fake = fakeGitHub();
  await assert.rejects(run(['review', 'Owner/repo', '42', sha, 'unused'], privateKey, fake.fetchFn), /Usage/);
  assert.equal(fake.calls.length, 0);
  await withPayload({ event: 'COMMENT', body: 'Review' }, async (file) => {
    const stale = fakeGitHub({ head: 'b'.repeat(40) });
    await assert.rejects(run(['review', 'Owner/repo', '42', sha, file, '--authorize'], privateKey, stale.fetchFn), /head changed/);
    assert.equal(stale.calls.some((call) => call.route.endsWith('/reviews')), false);
    const readOnly = fakeGitHub({ permission: 'read' });
    await assert.rejects(run(['review', 'Owner/repo', '42', sha, file, '--authorize'], privateKey, readOnly.fetchFn), /lacks pull requests write/);
  });
});

test('an authorized review is bound to the verified head', async () => {
  await withPayload({ event: 'COMMENT', body: 'Review' }, async (file) => {
    const fake = fakeGitHub();
    const result = await run(['review', 'Owner/repo', '42', sha, file, '--authorize'], privateKey, fake.fetchFn);
    assert.match(result, /Submitted review 77 as lp-copilot-reviewer\[bot\]/);
    const post = fake.calls.at(-1);
    assert.equal(post.method, 'POST');
    assert.equal(JSON.parse(post.body).commit_id, sha);
  });
});

test('surfaces GitHub error messages without dumping the response', async () => {
  await withPayload({ event: 'COMMENT', body: 'Review' }, async (file) => {
    const fake = fakeGitHub({
      reviewStatus: 422,
      reviewData: { message: 'Invalid review comment line', errors: [{ resource: 'Review', field: 'line' }] }
    });
    await assert.rejects(
      run(['review', 'Owner/repo', '42', sha, file, '--authorize'], privateKey, fake.fetchFn),
      /HTTP 422: Invalid review comment line/
    );
  });
});

test('rejects malformed or mismatched review payloads before authentication', async () => {
  for (const payload of [{ event: 'PENDING' }, { event: 'COMMENT', commit_id: 'b'.repeat(40) },
    { event: 'COMMENT', commit_id: 42 }, { event: 'COMMENT', unexpected: true }]) {
    await withPayload(payload, async (file) => {
      const fake = fakeGitHub();
      await assert.rejects(run(['review', 'Owner/repo', '42', sha, file, '--authorize'], privateKey, fake.fetchFn), /Invalid review payload/);
      assert.equal(fake.calls.length, 0);
    });
  }
});
