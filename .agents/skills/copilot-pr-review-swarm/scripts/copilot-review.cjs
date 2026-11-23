#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const APP_ID = 5895023;
const APP_SLUG = 'lp-copilot-reviewer';
const API = 'https://api.github.com';

function appJwt(key) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iat: now - 60, exp: now + 540, iss: String(APP_ID)
  })}`;
  return `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
}

async function request(fetchFn, route, credential, options = {}) {
  let response;
  try {
    response = await fetchFn(`${API}${route}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${credential}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'copilot-pr-review-swarm',
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      redirect: 'error'
    });
  } catch {
    throw new Error('GitHub API request failed; check network connectivity.');
  }
  if (!response.ok) {
    let message;
    try {
      const data = await response.json();
      if (typeof data.message === 'string') message = data.message.replace(/\s+/g, ' ').trim().slice(0, 500);
    } catch {
      // Preserve the HTTP status when GitHub does not return a JSON error.
    }
    throw new Error(`GitHub API ${route.split('?')[0]} returned HTTP ${response.status}${message ? `: ${message}` : '.'}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('GitHub API returned an invalid JSON response.');
  }
}

async function authenticate(repo, key, fetchFn = fetch) {
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]+)$/.exec(repo);
  if (!match || match[2] === '.' || match[2] === '..') throw new Error('Specify a GitHub repository as OWNER/REPO.');
  let jwt;
  try {
    jwt = appJwt(key);
  } catch {
    throw new Error('The configured private key could not sign the app credential.');
  }
  const app = await request(fetchFn, '/app', jwt);
  if (app.id !== APP_ID || app.slug !== APP_SLUG) throw new Error('The authenticated GitHub App identity does not match lp-copilot-reviewer.');
  const installations = [];
  for (let page = 1; ; page++) {
    const batch = await request(fetchFn, `/app/installations?per_page=100&page=${page}`, jwt);
    if (!Array.isArray(batch)) throw new Error('GitHub returned an invalid installation list.');
    installations.push(...batch);
    if (batch.length < 100) break;
  }
  const matches = installations.filter((item) => item.account?.login?.toLowerCase() === match[1].toLowerCase());
  if (matches.length !== 1) {
    throw new Error(`No unique ${APP_SLUG} installation for owner ${match[1]}; install the app for that owner and repository.`);
  }
  const installation = matches[0];
  if (!Number.isSafeInteger(installation.id) || installation.id <= 0) throw new Error('GitHub returned an invalid installation ID.');
  const tokenData = await request(fetchFn, `/app/installations/${installation.id}/access_tokens`, jwt, {
    method: 'POST',
    body: { repositories: [match[2]] }
  });
  if (typeof tokenData.token !== 'string' || !tokenData.token) throw new Error('GitHub returned no installation token.');
  const repository = await request(fetchFn, `/repos/${match[1]}/${match[2]}`, tokenData.token);
  if (repository.full_name?.toLowerCase() !== repo.toLowerCase()) throw new Error('The installation cannot access the specified repository.');
  return { token: tokenData.token, installationId: installation.id, permissions: tokenData.permissions || {} };
}

async function run(args, key, fetchFn = fetch) {
  const [command, repo, number, sha, payloadPath, authorization] = args;
  if (command === 'check' && args.length === 2) {
    const identity = await authenticate(repo, key, fetchFn);
    return `Verified ${APP_SLUG}[bot], installation ${identity.installationId}, repository ${repo}; pull request permission: ${identity.permissions.pull_requests || 'none'}.`;
  }
  if (command !== 'review' || args.length !== 6 || authorization !== '--authorize' ||
      !/^[1-9]\d*$/.test(number || '') || !/^[a-f0-9]{40}$/i.test(sha || '')) {
    throw new Error('Usage: check OWNER/REPO | review OWNER/REPO PR_NUMBER HEAD_SHA PAYLOAD.json --authorize');
  }
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  } catch {
    throw new Error('The review payload file could not be read as JSON.');
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object' ||
      !['COMMENT', 'APPROVE', 'REQUEST_CHANGES'].includes(payload.event) ||
      Object.keys(payload).some((field) => !['event', 'body', 'comments', 'commit_id'].includes(field)) ||
      (payload.commit_id !== undefined &&
        (typeof payload.commit_id !== 'string' || payload.commit_id.toLowerCase() !== sha.toLowerCase()))) {
    throw new Error('Invalid review payload or mismatched commit_id.');
  }
  const identity = await authenticate(repo, key, fetchFn);
  if (identity.permissions.pull_requests !== 'write') throw new Error('The installation lacks pull requests write permission.');
  const route = `/repos/${repo}/pulls/${number}`;
  const pull = await request(fetchFn, route, identity.token);
  if (pull.state !== 'open' || pull.head?.sha?.toLowerCase() !== sha.toLowerCase()) {
    throw new Error('The pull request is closed or its head changed; review it again before posting.');
  }
  const review = await request(fetchFn, `${route}/reviews`, identity.token, {
    method: 'POST', body: { ...payload, commit_id: sha }
  });
  if (!review.id) throw new Error('GitHub did not return a review ID; check the PR before retrying.');
  return `Submitted review ${review.id} as ${APP_SLUG}[bot] for ${repo}#${number}.`;
}

async function main() {
  const keyPath = process.env.COPILOT_REVIEW_APP_KEY_PATH;
  if (!keyPath) throw new Error('Set COPILOT_REVIEW_APP_KEY_PATH to the lp-copilot-reviewer private key.');
  let key;
  try {
    key = fs.readFileSync(keyPath);
  } catch {
    throw new Error('The configured lp-copilot-reviewer private key could not be read.');
  }
  console.log(await run(process.argv.slice(2), key));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { authenticate, run };
