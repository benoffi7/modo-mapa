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
  'biz_016', 'biz_017', 'biz_018', 'biz_019', 'biz_020',
  'biz_021', 'biz_022', 'biz_023', 'biz_024', 'biz_025',
  'biz_026', 'biz_027', 'biz_028', 'biz_029', 'biz_030',
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
    commentLikes: 25,
    dailyReads: 342,
    dailyWrites: 87,
    dailyDeletes: 12,
    checkins: 20,
    follows: 25,
    recommendations: 12,
    priceLevels: 30,
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

  // 12. User Rankings (weekly + monthly)
  console.log('Creating user rankings...');
  const now = new Date();

  // Current weekly ranking
  const weekD = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = weekD.getUTCDay() || 7;
  weekD.setUTCDate(weekD.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(weekD.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((weekD.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weeklyKey = `weekly_${weekD.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  const weekStart = new Date(now);
  const weekDay = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - weekDay + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Current monthly ranking
  const monthKey = `monthly_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Generate ranking entries from seeded users
  const rankingEntries = USER_IDS.map((userId, idx) => {
    const breakdown = {
      comments: randomInt(0, 8),
      ratings: randomInt(0, 5),
      likes: randomInt(0, 10),
      tags: randomInt(0, 6),
      favorites: randomInt(0, 4),
      photos: randomInt(0, 2),
    };
    const score =
      breakdown.comments * 3 +
      breakdown.ratings * 2 +
      breakdown.likes * 1 +
      breakdown.tags * 1 +
      breakdown.favorites * 1 +
      breakdown.photos * 5;
    return { userId, displayName: USER_NAMES[idx], score, breakdown };
  })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);

  await db.doc(`userRankings/${weeklyKey}`).set({
    period: weeklyKey,
    startDate: weekStart,
    endDate: weekEnd,
    rankings: rankingEntries,
    totalParticipants: rankingEntries.length,
  });

  await db.doc(`userRankings/${monthKey}`).set({
    period: monthKey,
    startDate: monthStart,
    endDate: monthEnd,
    rankings: rankingEntries.map((e) => ({
      ...e,
      score: e.score + randomInt(5, 20),
    })),
    totalParticipants: rankingEntries.length,
  });

  // 13. Notifications
  console.log('Creating notifications...');
  const notifTypes = ['like', 'photo_approved', 'photo_rejected', 'ranking', 'feedback_response', 'comment_reply', 'new_follower', 'recommendation'] as const;
  for (let i = 0; i < 15; i++) {
    const userId = USER_IDS[i % USER_IDS.length];
    const type = notifTypes[i % notifTypes.length];
    const actorIdx = (USER_IDS.indexOf(userId) + 1) % USER_IDS.length;
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);
    await db.collection('notifications').add({
      userId,
      type,
      message:
        type === 'like'
          ? `${USER_NAMES[actorIdx]} le dio like a tu comentario`
          : type === 'photo_approved'
            ? 'Tu foto de menú fue aprobada'
            : type === 'photo_rejected'
              ? 'Tu foto de menú fue rechazada'
              : type === 'feedback_response'
                ? 'Tu feedback recibió una respuesta del equipo'
                : type === 'comment_reply'
                  ? `${USER_NAMES[actorIdx]} respondió tu comentario`
                  : type === 'new_follower'
                    ? `${USER_NAMES[actorIdx]} empezó a seguirte`
                    : type === 'recommendation'
                      ? `${USER_NAMES[actorIdx]} te recomendó un comercio`
                      : 'Se publicó el ranking semanal',
      read: i % 3 === 0,
      createdAt: daysAgo(randomInt(0, 7)),
      expiresAt,
      ...(type === 'like' ? { actorId: USER_IDS[actorIdx], actorName: USER_NAMES[actorIdx] } : {}),
      ...(type !== 'ranking' && type !== 'feedback_response' ? { businessId: randomFrom(BUSINESS_IDS), businessName: `Comercio ${randomInt(1, 15)}` } : {}),
      ...(type === 'feedback_response' ? { referenceId: `seed_feedback_${i}` } : {}),
    });
  }

  // 14. Check-ins
  console.log('Creating check-ins...');
  for (let i = 0; i < 20; i++) {
    const userId = USER_IDS[i % USER_IDS.length];
    const businessId = BUSINESS_IDS[i % BUSINESS_IDS.length];
    await db.collection('checkins').add({
      userId,
      businessId,
      businessName: `Comercio ${(i % BUSINESS_IDS.length) + 1}`,
      createdAt: daysAgo(randomInt(0, 14)),
      ...(i % 3 === 0 ? { location: { lat: -34.5591 + Math.random() * 0.02, lng: -58.4473 + Math.random() * 0.02 } } : {}),
    });
  }

  // 15. Follows
  console.log('Creating follows...');
  for (let i = 0; i < USER_IDS.length; i++) {
    // Each user follows 2-3 others
    const followCount = randomInt(2, 3);
    for (let j = 1; j <= followCount; j++) {
      const followedIdx = (i + j) % USER_IDS.length;
      if (followedIdx === i) continue;
      await db.collection('follows').add({
        followerId: USER_IDS[i],
        followedId: USER_IDS[followedIdx],
        createdAt: daysAgo(randomInt(0, 30)),
      });
    }
  }

  // 16. Recommendations
  console.log('Creating recommendations...');
  for (let i = 0; i < 12; i++) {
    const senderIdx = i % USER_IDS.length;
    const recipientIdx = (senderIdx + 1 + randomInt(0, 4)) % USER_IDS.length;
    const businessId = BUSINESS_IDS[randomInt(0, BUSINESS_IDS.length - 1)];
    await db.collection('recommendations').add({
      senderId: USER_IDS[senderIdx],
      senderName: USER_NAMES[senderIdx],
      recipientId: USER_IDS[recipientIdx],
      businessId,
      businessName: `Comercio ${BUSINESS_IDS.indexOf(businessId) + 1}`,
      message: randomFrom(['Probalo, te va a gustar!', 'Muy bueno este lugar', 'Te lo recomiendo para ir a almorzar', 'Excelente relación precio-calidad']),
      read: i % 3 === 0,
      createdAt: daysAgo(randomInt(0, 14)),
    });
  }

  // 17. Shared Lists + List Items
  console.log('Creating shared lists...');
  const listNames = ['Mis favoritos de pizza', 'Cafeterías top', 'Para ir con amigos', 'Almuerzo rápido', 'Cena romántica', 'Opciones veganas'];
  for (let i = 0; i < listNames.length; i++) {
    const ownerId = USER_IDS[i % USER_IDS.length];
    const isPublic = i < 4; // First 4 public
    const itemCount = randomInt(2, 8);
    const editorIds = i === 0 ? [USER_IDS[1], USER_IDS[2]] : i === 2 ? [USER_IDS[0]] : [];
    const listRef = await db.collection('sharedLists').add({
      ownerId,
      name: listNames[i],
      description: `Lista de ${listNames[i].toLowerCase()}`,
      isPublic,
      featured: i < 2, // First 2 featured
      editorIds,
      itemCount,
      createdAt: daysAgo(randomInt(5, 30)),
      updatedAt: daysAgo(randomInt(0, 5)),
    });
    // Add items
    for (let j = 0; j < itemCount; j++) {
      await db.collection('listItems').add({
        listId: listRef.id,
        businessId: BUSINESS_IDS[(i * 5 + j) % BUSINESS_IDS.length],
        addedBy: j < 2 && editorIds.length > 0 ? editorIds[0] : ownerId,
        createdAt: daysAgo(randomInt(0, 10)),
      });
    }
  }

  // 18. Trending Businesses
  console.log('Creating trending businesses...');
  const trendingBusinesses = BUSINESS_IDS.slice(0, 10).map((businessId, idx) => ({
    businessId,
    name: `Comercio ${idx + 1}`,
    category: randomFrom(['restaurant', 'cafe', 'bar', 'bakery']),
    score: 50 - idx * 4 + randomInt(0, 5),
    breakdown: {
      ratings: randomInt(2, 8),
      comments: randomInt(1, 6),
      userTags: randomInt(0, 4),
      priceLevels: randomInt(1, 3),
      listItems: randomInt(0, 2),
    },
    rank: idx + 1,
  }));

  await db.doc('trendingBusinesses/current').set({
    businesses: trendingBusinesses,
    computedAt: new Date(),
    periodStart: daysAgo(7),
    periodEnd: new Date(),
  });

  // 19. User Settings (some public, some with notifications)
  console.log('Creating user settings...');
  for (let i = 0; i < USER_IDS.length; i++) {
    const isPublic = true; // All public for testing profile sheets
    const notifsOn = i % 3 === 0; // Some with notifications
    await db.doc(`userSettings/${USER_IDS[i]}`).set({
      profilePublic: isPublic,
      notificationsEnabled: notifsOn,
      notifyLikes: notifsOn,
      notifyPhotos: notifsOn,
      notifyRankings: notifsOn,
      notifyFeedback: true,
      analyticsEnabled: false,
      updatedAt: new Date(),
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
  console.log('- 2 user rankings (weekly + monthly)');
  console.log('- 15 notifications (8 types)');
  console.log('- 10 user settings');
  console.log('- 20 check-ins');
  console.log('- ~25 follows');
  console.log('- 12 recommendations');
  console.log('- 6 shared lists + items');
  console.log('- 10 trending businesses');
  console.log('- Counters and moderation config');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
