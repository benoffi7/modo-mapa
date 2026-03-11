/**
 * Seed script for admin dashboard testing.
 * Run with: cp scripts/seed-admin-data.ts functions/seed.ts && cd functions && npx tsx seed.ts && rm seed.ts
 * Requires emulators running: npm run emulators
 * Uses firebase-admin (bypasses Firestore rules)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

initializeApp({ projectId: 'modo-mapa-app' });
const db = getFirestore();

const BUSINESS_IDS = [
  'biz_001', 'biz_002', 'biz_003', 'biz_004', 'biz_005',
  'biz_006', 'biz_007', 'biz_008', 'biz_009', 'biz_010',
  'biz_011', 'biz_012', 'biz_013', 'biz_014', 'biz_015',
];

const USER_IDS = [
  'user_001', 'user_002', 'user_003', 'user_004', 'user_005',
  'user_006', 'user_007', 'user_008', 'user_009', 'user_010',
];

const USER_NAMES = [
  'Juan', 'María', 'Carlos', 'Ana', 'Pedro',
  'Laura', 'Diego', 'Lucía', 'Martín', 'Sofía',
];

const TAGS = ['barato', 'apto_celiacos', 'apto_veganos', 'rapido', 'delivery', 'buena_atencion'];

const COMMENT_TEXTS = [
  'Excelente lugar, muy recomendable!',
  'La comida es buena pero el servicio podría mejorar',
  'Precios accesibles y buena calidad',
  'Fui con amigos y la pasamos genial',
  'El mejor café de la zona',
  'Pedido por delivery, llegó rápido y caliente',
  'Muy buena atención al cliente',
  'Las porciones son generosas',
  'Buen lugar para ir a almorzar rápido',
  'Lo recomiendo para una cena tranquila',
  'Las hamburguesas son increíbles',
  'El postre es lo mejor del menú',
  'Ambiente muy agradable',
  'Relación precio-calidad perfecta',
  'Volvería sin dudarlo',
];

const FEEDBACK_MESSAGES = [
  'La app funciona genial, muy útil para encontrar lugares!',
  'Estaría bueno poder filtrar por distancia',
  'A veces tarda en cargar los comentarios',
  'Me encanta poder marcar favoritos',
  'Sería útil agregar fotos de los comercios',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randomInt(8, 22), randomInt(0, 59), 0, 0);
  return d;
}

async function seed() {
  console.log('Seeding admin data...\n');

  // 1. Users
  console.log('Creating users...');
  for (let i = 0; i < USER_IDS.length; i++) {
    await db.doc(`users/${USER_IDS[i]}`).set({
      displayName: USER_NAMES[i],
      createdAt: daysAgo(randomInt(1, 30)),
    });
  }

  // 2. Comments (60 total, some flagged)
  console.log('Creating comments...');
  for (let i = 0; i < 60; i++) {
    const userId = randomFrom(USER_IDS);
    const idx = USER_IDS.indexOf(userId);
    await db.collection('comments').add({
      userId,
      userName: USER_NAMES[idx],
      businessId: randomFrom(BUSINESS_IDS),
      text: randomFrom(COMMENT_TEXTS),
      createdAt: daysAgo(randomInt(0, 25)),
      ...(i % 15 === 0 ? { flagged: true } : {}),
    });
  }

  // 3. Ratings (40 total)
  console.log('Creating ratings...');
  for (let i = 0; i < 40; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const now = daysAgo(randomInt(0, 25));
    await db.doc(`ratings/${userId}__${businessId}`).set({
      userId,
      businessId,
      score: randomInt(1, 5),
      createdAt: now,
      updatedAt: now,
    });
  }

  // 4. Favorites (30 total)
  console.log('Creating favorites...');
  for (let i = 0; i < 30; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    await db.doc(`favorites/${userId}__${businessId}`).set({
      userId,
      businessId,
      createdAt: daysAgo(randomInt(0, 25)),
    });
  }

  // 5. UserTags (50 total)
  console.log('Creating user tags...');
  for (let i = 0; i < 50; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const tagId = randomFrom(TAGS);
    await db.doc(`userTags/${userId}__${businessId}__${tagId}`).set({
      userId,
      businessId,
      tagId,
      createdAt: daysAgo(randomInt(0, 25)),
    });
  }

  // 6. CustomTags (15 total)
  console.log('Creating custom tags...');
  const customLabels = ['WiFi gratis', 'Pet friendly', 'Estacionamiento', 'Terraza', 'Música en vivo'];
  for (let i = 0; i < 15; i++) {
    await db.collection('customTags').add({
      userId: randomFrom(USER_IDS),
      businessId: randomFrom(BUSINESS_IDS),
      label: randomFrom(customLabels),
      createdAt: daysAgo(randomInt(0, 25)),
    });
  }

  // 7. Feedback (8 total, some flagged)
  console.log('Creating feedback...');
  for (let i = 0; i < 8; i++) {
    await db.collection('feedback').add({
      userId: randomFrom(USER_IDS),
      message: randomFrom(FEEDBACK_MESSAGES),
      category: randomFrom(['bug', 'sugerencia', 'otro']),
      createdAt: daysAgo(randomInt(0, 10)),
      ...(i === 3 ? { flagged: true } : {}),
    });
  }

  // 8. Config/counters
  console.log('Setting up counters...');
  await db.doc('config/counters').set({
    comments: 60,
    ratings: 40,
    favorites: 30,
    feedback: 8,
    users: 10,
    customTags: 15,
    userTags: 50,
    dailyReads: 342,
    dailyWrites: 87,
    dailyDeletes: 12,
  });

  // 9. Config/moderation
  console.log('Setting up moderation words...');
  await db.doc('config/moderation').set({
    bannedWords: ['spam', 'estafa', 'basura', 'asco', 'porquería'],
  });

  // 10. Daily metrics (last 15 days)
  console.log('Creating daily metrics...');
  for (let day = 0; day < 15; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().slice(0, 10);

    await db.doc(`dailyMetrics/${dateStr}`).set({
      date: dateStr,
      ratingDistribution: {
        '1': randomInt(1, 5),
        '2': randomInt(3, 8),
        '3': randomInt(5, 15),
        '4': randomInt(8, 20),
        '5': randomInt(10, 25),
      },
      topFavorited: BUSINESS_IDS.slice(0, 5).map((id) => ({
        businessId: id,
        count: randomInt(3, 15),
      })),
      topCommented: BUSINESS_IDS.slice(2, 7).map((id) => ({
        businessId: id,
        count: randomInt(2, 12),
      })),
      topRated: BUSINESS_IDS.slice(0, 5).map((id) => ({
        businessId: id,
        avgScore: Math.round((3 + Math.random() * 2) * 10) / 10,
        count: randomInt(3, 10),
      })),
      topTags: TAGS.map((tagId) => ({
        tagId,
        count: randomInt(5, 30),
      })),
      dailyReads: randomInt(100, 500),
      dailyWrites: randomInt(20, 120),
      dailyDeletes: randomInt(2, 20),
      writesByCollection: {
        comments: randomInt(5, 25),
        ratings: randomInt(3, 15),
        favorites: randomInt(2, 10),
        feedback: randomInt(1, 5),
        userTags: randomInt(3, 12),
        customTags: randomInt(1, 8),
      },
      deletesByCollection: {
        comments: randomInt(0, 5),
        favorites: randomInt(0, 3),
        customTags: randomInt(0, 2),
      },
      readsByCollection: {
        comments: randomInt(20, 80),
        ratings: randomInt(15, 60),
        favorites: randomInt(10, 40),
        userTags: randomInt(10, 30),
        customTags: randomInt(5, 20),
      },
      activeUsers: randomInt(3, 10),
    });
  }

  // 11. Abuse logs (12 total)
  console.log('Creating abuse logs...');
  const abuseTypes: Array<{ type: string; detail: string }> = [
    { type: 'rate_limit', detail: 'Exceeded 20 comments/day' },
    { type: 'rate_limit', detail: 'Exceeded 5 feedback/day' },
    { type: 'flagged', detail: 'Flagged text: "esto es spam total"' },
    { type: 'flagged', detail: 'Flagged text: "lugar de porquería"' },
    { type: 'flagged', detail: 'Flagged label: "estafa"' },
    { type: 'top_writers', detail: '15 writes today' },
    { type: 'top_writers', detail: '12 writes today' },
    { type: 'rate_limit', detail: 'Exceeded 10 customTags for business biz_003' },
    { type: 'flagged', detail: 'Flagged message: "esto es basura"' },
    { type: 'top_writers', detail: '8 writes today' },
    { type: 'rate_limit', detail: 'Exceeded 20 comments/day' },
    { type: 'flagged', detail: 'Flagged text: "que asco de comida"' },
  ];

  for (const entry of abuseTypes) {
    await db.collection('abuseLogs').add({
      userId: randomFrom(USER_IDS),
      type: entry.type,
      collection: randomFrom(['comments', 'feedback', 'customTags']),
      detail: entry.detail,
      timestamp: daysAgo(randomInt(0, 10)),
    });
  }

  console.log('\nSeed complete!');
  console.log('- 10 users');
  console.log('- 60 comments (4 flagged)');
  console.log('- 40 ratings');
  console.log('- 30 favorites');
  console.log('- 50 user tags');
  console.log('- 15 custom tags');
  console.log('- 8 feedback (1 flagged)');
  console.log('- 15 days of daily metrics');
  console.log('- 12 abuse logs');
  console.log('- Counters and moderation config');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
