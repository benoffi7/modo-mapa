#!/usr/bin/env node

/**
 * Writes config/appVersion.minVersion to Firestore after a production deploy.
 * Reads the version from package.json by default, or accepts an explicit version
 * via the --set=X.Y.Z flag (used for manual rollback). Uses Application Default
 * Credentials (already authenticated by google-github-actions/auth in CI).
 *
 * Usage:
 *   node scripts/update-min-version.js
 *   node scripts/update-min-version.js --set=2.36.5
 *
 * The module exports its primitives (readPackageVersion, getDb, resolveVersion,
 * run) to keep them testable in isolation. Direct CLI execution is gated by a
 * ESM entry-point check so imports from a test runner do not trigger the write.
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

/**
 * Reads and returns the `version` field from the given package.json path.
 * Inyectable para tests (default: './package.json' relativo al cwd).
 * @param {string} [packagePath='./package.json']
 * @returns {string}
 */
export function readPackageVersion(packagePath = './package.json') {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  return pkg.version;
}

let _cachedDb;

/**
 * Lazily initializes firebase-admin (Application Default Credentials) and
 * returns a Firestore client. Cached across calls within the same process.
 * @returns {import('firebase-admin/firestore').Firestore}
 */
export function getDb() {
  if (_cachedDb) return _cachedDb;
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  _cachedDb = getFirestore();
  return _cachedDb;
}

/**
 * Resolves the target version from argv. If `--set=X.Y.Z` is present and valid,
 * it overrides the package.json fallback. Throws on invalid format.
 * @param {string[]} argv - arguments to scan (e.g. process.argv.slice(2))
 * @param {string} pkgVersion - fallback version from package.json
 * @returns {string}
 */
export function resolveVersion(argv, pkgVersion) {
  const setArg = Array.isArray(argv) ? argv.find((a) => typeof a === 'string' && a.startsWith('--set=')) : undefined;
  const version = setArg ? setArg.slice('--set='.length) : pkgVersion;
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  return version;
}

/**
 * Writes `{ minVersion, updatedAt: serverTimestamp() }` to `config/appVersion`.
 * Both `db` and `version` are injectable for testing; defaults resolve via
 * getDb() and resolveVersion(process.argv, readPackageVersion()).
 * Returns the resolved version string on success; throws on write failure.
 * @param {{ db?: import('firebase-admin/firestore').Firestore, version?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function run({ db, version } = {}) {
  const resolvedDb = db ?? getDb();
  const resolvedVersion = version ?? resolveVersion(process.argv.slice(2), readPackageVersion());
  await resolvedDb.doc('config/appVersion').set({
    minVersion: resolvedVersion,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return resolvedVersion;
}

// Guard de ejecución directa vía CLI. Cuando el archivo se importa desde un
// test runner (Vitest), `process.argv[1]` apunta al runner, no a este script,
// y el bloque no se ejecuta.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const v = await run();
    console.log(`✓ config/appVersion.minVersion updated to ${v}`);
  } catch (e) {
    console.error(e?.message ?? e);
    process.exit(1);
  }
}
