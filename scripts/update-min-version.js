#!/usr/bin/env node

/**
 * Writes config/appVersion.minVersion to Firestore after a production deploy.
 * Reads the version from package.json. Uses Application Default Credentials
 * (already authenticated by google-github-actions/auth in CI).
 *
 * Usage: node scripts/update-min-version.js
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

await db.doc('config/appVersion').set({
  minVersion: version,
  updatedAt: FieldValue.serverTimestamp(),
});

console.log(`✓ config/appVersion.minVersion updated to ${version}`);
