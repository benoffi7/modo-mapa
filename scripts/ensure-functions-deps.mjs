#!/usr/bin/env node
// Idempotent guard for the functions/ dependency tree.
//
// Why: vitest.config.ts aliases `firebase-admin/*` into
// `functions/node_modules/firebase-admin/...`. If functions deps are not
// installed, the root `test`/`test:coverage` gates fail to RESOLVE those
// imports (7 functions test files + 2 scripts), and `test:coverage` exits 1 —
// masking any real coverage-threshold failure. See docs and /health-check.
//
// This runs as root `postinstall`. It is a cheap stat check when already
// installed, and only shells out to `npm ci` when firebase-admin is missing.
// It NEVER fails the root install (warn-only) so it can't block unrelated work.
//
// Opt out with SKIP_FUNCTIONS_INSTALL=1 (e.g. the guards-only CI job, which
// needs root deps for the react-router version check but not functions/).

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const functionsDir = resolve(repoRoot, 'functions');
const marker = resolve(functionsDir, 'node_modules/firebase-admin/package.json');

if (process.env.SKIP_FUNCTIONS_INSTALL === '1') {
  console.log('[ensure-functions-deps] SKIP_FUNCTIONS_INSTALL=1 — skipping.');
  process.exit(0);
}

if (!existsSync(resolve(functionsDir, 'package.json'))) {
  // No functions/ workspace — nothing to do.
  process.exit(0);
}

if (existsSync(marker)) {
  // Already installed — fast path, no work.
  process.exit(0);
}

console.log('[ensure-functions-deps] functions/ deps missing — installing (firebase-admin not found)...');
try {
  // Prefer `npm ci` (lockfile-exact); fall back to `npm install` if no lockfile.
  const hasLock = existsSync(resolve(functionsDir, 'package-lock.json'));
  const cmd = hasLock
    ? 'npm ci --prefix functions --prefer-offline --no-audit --no-fund'
    : 'npm install --prefix functions --no-audit --no-fund';
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
  console.log('[ensure-functions-deps] functions/ deps installed.');
} catch (err) {
  // Warn-only: never block the root install. The dev can run it manually.
  console.warn(
    '[ensure-functions-deps] WARNING: could not install functions/ deps automatically.\n' +
      '  Run `npm ci --prefix functions` manually so the test/coverage gates can\n' +
      '  resolve firebase-admin (see vitest.config.ts aliases).\n' +
      `  Cause: ${err?.message ?? err}`,
  );
}