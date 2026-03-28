/**
 * Seed script: genera abuse logs de prueba para testing de filtros y reincidentes.
 *
 * Uso:
 *   cd functions && node -e "$(cat ../scripts/seed-abuse-logs.js)"
 *
 * O con sa-key.json (recomendado):
 *   GOOGLE_APPLICATION_CREDENTIALS=sa-key.json node -e "
 *     const admin = require('firebase-admin');
 *     admin.initializeApp({ credential: admin.credential.cert(require('./sa-key.json')) });
 *     ..."
 *
 * Prerequisito:
 *   1. Descargar service account key desde Firebase Console > Project Settings > Service accounts
 *   2. Guardar como sa-key.json en el root del proyecto (ya está en .gitignore)
 *
 * Nota: Este script usa require() (CJS) porque se ejecuta desde functions/ que tiene firebase-admin.
 * La versión TSX no funciona porque firebase-admin no está en el root node_modules.
 */

const admin = require('firebase-admin');
const sa = require('../sa-key.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const { Timestamp } = require('firebase-admin/firestore');

const TYPES = ['rate_limit', 'flagged', 'top_writers'];
const SEVERITY_MAP = { rate_limit: 'low', flagged: 'high', top_writers: 'medium' };
const COLLECTIONS = ['comments', 'ratings', 'favorites', 'feedback', 'menuPhotos'];

// Usuarios reincidentes (>3, >5, >10 alertas para probar filtros)
const USERS = [
  { id: 'user_reincidente_12', n: 12 },
  { id: 'user_reincidente_08', n: 8 },
  { id: 'user_reincidente_06', n: 6 },
  { id: 'user_reincidente_04', n: 4 },
  { id: 'user_normal_02', n: 2 },
  { id: 'user_normal_01', n: 1 },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randDate = (days) => new Date(Date.now() - Math.random() * days * 86400000);

async function seed() {
  const batch = db.batch();
  let total = 0;

  for (const u of USERS) {
    for (let i = 0; i < u.n; i++) {
      const type = pick(TYPES);
      const ref = db.collection('abuseLogs').doc();
      batch.set(ref, {
        userId: u.id,
        type,
        severity: SEVERITY_MAP[type],
        collection: pick(COLLECTIONS),
        detail: `Seed alert #${i + 1} for ${u.id} — ${type}`,
        timestamp: Timestamp.fromDate(randDate(30)),
        reviewed: false,
        dismissed: false,
      });
      total++;
    }
  }

  await batch.commit();
  console.log(`${total} abuse logs creados`);
}

seed().catch(console.error);
