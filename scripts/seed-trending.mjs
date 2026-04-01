/**
 * Seed trendingBusinesses/current for staging testing.
 *
 * Usage:
 *   node scripts/seed-trending.mjs                    # seed local emulators
 *   node scripts/seed-trending.mjs --target staging   # seed remote staging DB
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', 'functions', 'node_modules', 'x.js'));
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Validate that Application Default Credentials exist before proceeding
const adcPath = resolve(process.env.HOME, '.config/gcloud/application_default_credentials.json');
if (!existsSync(adcPath)) {
  console.error('ERROR: Application Default Credentials no encontradas.');
  console.error('Ejecutar primero: gcloud auth application-default login');
  process.exit(1);
}

const target = process.argv.includes('--target')
  ? process.argv[process.argv.indexOf('--target') + 1]
  : null;

if (!target) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'modo-mapa-app' });
  console.log('Target: local emulators (default database)');
} else {
  admin.initializeApp({ projectId: 'modo-mapa-app' });
  console.log(`Target: remote database "${target}"`);
}

const db = target ? getFirestore(admin.app(), target) : getFirestore();

const now = new Date();
const since = new Date(now);
since.setDate(since.getDate() - 7);

const businesses = [
  { businessId: 'biz_003', name: 'La Esquina del Café', category: 'cafe', score: 27, breakdown: { ratings: 5, comments: 3, userTags: 2, priceLevels: 1, listItems: 4 }, rank: 1 },
  { businessId: 'biz_007', name: 'Pizzería Don Julio', category: 'pizza', score: 23, breakdown: { ratings: 4, comments: 3, userTags: 1, priceLevels: 2, listItems: 2 }, rank: 2 },
  { businessId: 'biz_012', name: 'Bar El Molino', category: 'bar', score: 19, breakdown: { ratings: 3, comments: 2, userTags: 3, priceLevels: 1, listItems: 2 }, rank: 3 },
  { businessId: 'biz_001', name: 'Restaurante Alma', category: 'restaurant', score: 17, breakdown: { ratings: 4, comments: 1, userTags: 1, priceLevels: 2, listItems: 1 }, rank: 4 },
  { businessId: 'biz_015', name: 'Heladería Cremolatti', category: 'icecream', score: 15, breakdown: { ratings: 2, comments: 2, userTags: 2, priceLevels: 1, listItems: 3 }, rank: 5 },
  { businessId: 'biz_005', name: 'Panadería Artesanal', category: 'bakery', score: 13, breakdown: { ratings: 3, comments: 1, userTags: 1, priceLevels: 1, listItems: 2 }, rank: 6 },
  { businessId: 'biz_020', name: 'Burger Lab', category: 'fastfood', score: 11, breakdown: { ratings: 2, comments: 1, userTags: 1, priceLevels: 2, listItems: 1 }, rank: 7 },
  { businessId: 'biz_009', name: 'Café Tortoni', category: 'cafe', score: 9, breakdown: { ratings: 1, comments: 1, userTags: 2, priceLevels: 1, listItems: 1 }, rank: 8 },
  { businessId: 'biz_022', name: 'La Farola', category: 'restaurant', score: 7, breakdown: { ratings: 1, comments: 1, userTags: 1, priceLevels: 0, listItems: 2 }, rank: 9 },
  { businessId: 'biz_030', name: 'Cervecería Antares', category: 'bar', score: 5, breakdown: { ratings: 1, comments: 0, userTags: 1, priceLevels: 1, listItems: 0 }, rank: 10 },
];

await db.doc('trendingBusinesses/current').set({
  businesses,
  computedAt: Timestamp.fromDate(now),
  periodStart: Timestamp.fromDate(since),
  periodEnd: Timestamp.fromDate(now),
});

console.log(`Seeded trendingBusinesses/current with ${businesses.length} businesses`);
process.exit(0);
