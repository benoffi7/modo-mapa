/**
 * Seed script for admin dashboard testing.
 * Run with: node scripts/seed-admin-data.mjs
 * Requires emulators running: npm run emulators
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

const app = initializeApp({ projectId: 'modo-mapa-app', apiKey: 'fake' });
const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

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

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randomInt(8, 22), randomInt(0, 59), 0, 0);
  return Timestamp.fromDate(d);
}

async function seed() {
  console.log('Seeding admin data...\n');

  // 1. Config/counters (write directly, no rules check on emulator for admin writes)
  console.log('Setting up counters...');
  await setDoc(doc(db, 'config', 'counters'), {
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

  // 2. Config/moderation
  console.log('Setting up moderation words...');
  await setDoc(doc(db, 'config', 'moderation'), {
    bannedWords: ['spam', 'estafa', 'basura', 'asco', 'porquería'],
  });

  // 3. Daily metrics (last 15 days)
  console.log('Creating daily metrics...');
  for (let day = 0; day < 15; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().slice(0, 10);

    await setDoc(doc(db, 'dailyMetrics', dateStr), {
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

  // 4. Abuse logs
  console.log('Creating abuse logs...');
  const abuseEntries = [
    { type: 'rate_limit', collection: 'comments', detail: 'Exceeded 20 comments/day' },
    { type: 'rate_limit', collection: 'feedback', detail: 'Exceeded 5 feedback/day' },
    { type: 'flagged', collection: 'comments', detail: 'Flagged text: "esto es spam total"' },
    { type: 'flagged', collection: 'comments', detail: 'Flagged text: "lugar de porquería"' },
    { type: 'flagged', collection: 'customTags', detail: 'Flagged label: "estafa"' },
    { type: 'top_writers', collection: 'all', detail: '15 writes today' },
    { type: 'top_writers', collection: 'all', detail: '12 writes today' },
    { type: 'rate_limit', collection: 'customTags', detail: 'Exceeded 10 customTags for business biz_003' },
    { type: 'flagged', collection: 'feedback', detail: 'Flagged message: "esto es basura"' },
    { type: 'top_writers', collection: 'all', detail: '8 writes today' },
    { type: 'rate_limit', collection: 'comments', detail: 'Exceeded 20 comments/day' },
    { type: 'flagged', collection: 'comments', detail: 'Flagged text: "que asco de comida"' },
  ];

  for (const entry of abuseEntries) {
    await addDoc(collection(db, 'abuseLogs'), {
      userId: randomFrom(USER_IDS),
      type: entry.type,
      collection: entry.collection,
      detail: entry.detail,
      timestamp: daysAgo(randomInt(0, 10)),
    });
  }

  // 5. Comments (using admin email auth bypass won't work on emulator without auth)
  // For collections with auth rules, we write directly to emulator
  console.log('Creating comments...');
  for (let i = 0; i < 60; i++) {
    const userId = randomFrom(USER_IDS);
    const idx = USER_IDS.indexOf(userId);
    await addDoc(collection(db, 'comments'), {
      userId,
      userName: USER_NAMES[idx],
      businessId: randomFrom(BUSINESS_IDS),
      text: randomFrom(COMMENT_TEXTS),
      createdAt: daysAgo(randomInt(0, 25)),
      ...(i % 15 === 0 ? { flagged: true } : {}),
    });
  }

  // 6. Ratings
  console.log('Creating ratings...');
  const ratingPairs = new Set();
  for (let i = 0; i < 40; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const key = `${userId}__${businessId}`;
    if (ratingPairs.has(key)) continue;
    ratingPairs.add(key);
    const now = daysAgo(randomInt(0, 25));
    await setDoc(doc(db, 'ratings', key), {
      userId,
      businessId,
      score: randomInt(1, 5),
      createdAt: now,
      updatedAt: now,
    });
  }

  // 7. Favorites
  console.log('Creating favorites...');
  const favPairs = new Set();
  for (let i = 0; i < 30; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const key = `${userId}__${businessId}`;
    if (favPairs.has(key)) continue;
    favPairs.add(key);
    await setDoc(doc(db, 'favorites', key), {
      userId,
      businessId,
      createdAt: daysAgo(randomInt(0, 25)),
    });
  }

  // 8. UserTags
  console.log('Creating user tags...');
  const tagTriples = new Set();
  for (let i = 0; i < 50; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const tagId = randomFrom(TAGS);
    const key = `${userId}__${businessId}__${tagId}`;
    if (tagTriples.has(key)) continue;
    tagTriples.add(key);
    await setDoc(doc(db, 'userTags', key), {
      userId,
      businessId,
      tagId,
      createdAt: daysAgo(randomInt(0, 25)),
    });
  }

  // 9. CustomTags
  console.log('Creating custom tags...');
  const customLabels = ['WiFi gratis', 'Pet friendly', 'Estacionamiento', 'Terraza', 'Música en vivo'];
  for (let i = 0; i < 15; i++) {
    await addDoc(collection(db, 'customTags'), {
      userId: randomFrom(USER_IDS),
      businessId: randomFrom(BUSINESS_IDS),
      label: randomFrom(customLabels),
      createdAt: daysAgo(randomInt(0, 25)),
    });
  }

  // 10. Feedback
  console.log('Creating feedback...');
  for (let i = 0; i < 8; i++) {
    await addDoc(collection(db, 'feedback'), {
      userId: randomFrom(USER_IDS),
      message: randomFrom(FEEDBACK_MESSAGES),
      category: randomFrom(['bug', 'sugerencia', 'otro']),
      createdAt: daysAgo(randomInt(0, 10)),
      ...(i === 3 ? { flagged: true } : {}),
    });
  }

  // 11. Users
  console.log('Creating users...');
  for (let i = 0; i < USER_IDS.length; i++) {
    await setDoc(doc(db, 'users', USER_IDS[i]), {
      displayName: USER_NAMES[i],
      createdAt: daysAgo(randomInt(1, 30)),
    });
  }

  console.log('\n✅ Seed complete!');
  console.log('- 10 users');
  console.log('- ~60 comments (4 flagged)');
  console.log('- ~40 ratings');
  console.log('- ~30 favorites');
  console.log('- ~50 user tags');
  console.log('- 15 custom tags');
  console.log('- 8 feedback (1 flagged)');
  console.log('- 15 days of daily metrics');
  console.log('- 12 abuse logs');
  console.log('- Counters and moderation config');
  console.log('\nOpen http://localhost:4000 to see data in Emulator UI');
  console.log('Open http://localhost:5173/admin to see the dashboard');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
