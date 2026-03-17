/**
 * Seed script: genera abuse logs de prueba para testing de filtros y reincidentes.
 * Ejecutar: npx tsx scripts/seed-abuse-logs.ts
 *
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS o firebase-admin inicializado.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const STAGING_PROJECT = 'modo-mapa-app';

initializeApp({ projectId: STAGING_PROJECT });
const db = getFirestore();

const TYPES = ['rate_limit', 'flagged', 'top_writers'] as const;
const SEVERITY_MAP: Record<string, string> = { rate_limit: 'low', flagged: 'high', top_writers: 'medium' };
const COLLECTIONS = ['comments', 'ratings', 'favorites', 'feedback', 'menuPhotos'];

// Usuarios reincidentes (>3, >5, >10 alertas para probar filtros)
const USERS = [
  { id: 'user_reincidente_12', alertCount: 12 },
  { id: 'user_reincidente_08', alertCount: 8 },
  { id: 'user_reincidente_06', alertCount: 6 },
  { id: 'user_reincidente_04', alertCount: 4 },
  { id: 'user_normal_02', alertCount: 2 },
  { id: 'user_normal_01', alertCount: 1 },
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  return new Date(now - Math.random() * daysBack * 24 * 60 * 60 * 1000);
}

async function seed() {
  const batch = db.batch();
  let total = 0;

  for (const user of USERS) {
    for (let i = 0; i < user.alertCount; i++) {
      const type = randomItem(TYPES);
      const collection = randomItem(COLLECTIONS);
      const ref = db.collection('abuseLogs').doc();
      batch.set(ref, {
        userId: user.id,
        type,
        severity: SEVERITY_MAP[type],
        collection,
        detail: `Seed alert #${i + 1} for ${user.id} — ${type} on ${collection}`,
        timestamp: Timestamp.fromDate(randomDate(30)),
        reviewed: false,
        dismissed: false,
      });
      total++;
    }
  }

  await batch.commit();
  console.log(`✅ ${total} abuse logs creados en ${STAGING_PROJECT}`);
}

seed().catch(console.error);
