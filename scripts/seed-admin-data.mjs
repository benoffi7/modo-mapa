/**
 * Seed script for admin dashboard testing.
 *
 * Usage:
 *   node scripts/seed-admin-data.mjs              # seed local emulators (default)
 *   node scripts/seed-admin-data.mjs --target staging  # seed remote staging DB
 *
 * Emulator mode requires emulators running: npm run emulators
 * Staging mode uses Application Default Credentials (gcloud auth).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', 'functions', 'node_modules', 'x.js'));
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const target = process.argv.includes('--target')
  ? process.argv[process.argv.indexOf('--target') + 1]
  : null;

if (!target) {
  // Local emulators
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  admin.initializeApp({ projectId: 'modo-mapa-app' });
  console.log('Target: local emulators (default database)');
} else {
  // Remote named database (e.g. staging)
  admin.initializeApp({ projectId: 'modo-mapa-app' });
  console.log(`Target: remote database "${target}"`);
}

const db = target ? getFirestore(admin.app(), target) : getFirestore();

// Helper wrappers to match client SDK API used below
const doc = (_db, col, id) => db.collection(col).doc(id);
const setDoc = (ref, data) => ref.set(data);
const addDoc = (colRef, data) => colRef.add(data);
const collection = (_db, name) => db.collection(name);

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
    favorites: 60,
    feedback: 8,
    users: 10,
    customTags: 15,
    userTags: 80,
    commentLikes: 80,
    recommendations: 12,
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
      newAccounts: randomInt(0, 3),
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

  // 5. Comments (with likeCount and some with updatedAt for "edited" indicator)
  console.log('Creating comments...');
  const commentIds = [];
  for (let i = 0; i < 60; i++) {
    const userId = randomFrom(USER_IDS);
    const idx = USER_IDS.indexOf(userId);
    const createdAt = daysAgo(randomInt(0, 25));
    const isEdited = i % 10 === 0;
    const ref = await addDoc(collection(db, 'comments'), {
      userId,
      userName: USER_NAMES[idx],
      businessId: randomFrom(BUSINESS_IDS),
      text: randomFrom(COMMENT_TEXTS),
      createdAt,
      likeCount: randomInt(0, 8),
      ...(isEdited ? { updatedAt: daysAgo(randomInt(0, 3)) } : {}),
      ...(i % 15 === 0 ? { flagged: true } : {}),
    });
    commentIds.push({ id: ref.id, userId });
  }

  // 5b. Reply comments (threads)
  console.log('Creating reply comments...');
  const REPLY_TEXTS = [
    'Totalmente de acuerdo!',
    'Yo también lo recomiendo',
    'Probaste la napolitana? Es increíble',
    'La próxima vez pedí el postre, no te vas a arrepentir',
    'Coincido, muy buen lugar',
    'A mí me pareció un poco caro',
    'Gracias por la recomendación!',
    'Voy a ir la semana que viene',
  ];
  const replyCommentIds = [];
  // Add 2-3 replies to first 10 parent comments
  const parentsForReplies = commentIds.slice(0, 10);
  for (const parent of parentsForReplies) {
    const numReplies = randomInt(1, 3);
    for (let r = 0; r < numReplies; r++) {
      const replyUserId = randomFrom(USER_IDS.filter((id) => id !== parent.userId));
      const idx = USER_IDS.indexOf(replyUserId);
      const ref = await addDoc(collection(db, 'comments'), {
        userId: replyUserId,
        userName: USER_NAMES[idx],
        businessId: randomFrom(BUSINESS_IDS),
        text: randomFrom(REPLY_TEXTS),
        createdAt: daysAgo(randomInt(0, 10)),
        likeCount: randomInt(0, 3),
        parentId: parent.id,
      });
      replyCommentIds.push({ id: ref.id, userId: replyUserId });
    }
    // Update parent's replyCount
    await db.collection('comments').doc(parent.id).update({ replyCount: numReplies });
  }

  // 5c. Comment likes
  console.log('Creating comment likes...');
  const likePairs = new Set();
  for (let i = 0; i < 80; i++) {
    const userId = randomFrom(USER_IDS);
    const comment = randomFrom(commentIds);
    // Don't self-like
    if (userId === comment.userId) continue;
    const key = `${userId}__${comment.id}`;
    if (likePairs.has(key)) continue;
    likePairs.add(key);
    await setDoc(doc(db, 'commentLikes', key), {
      userId,
      commentId: comment.id,
      createdAt: daysAgo(randomInt(0, 15)),
    });
  }

  // 6. Ratings (some with multi-criteria)
  console.log('Creating ratings...');
  const CRITERIA_KEYS = ['food', 'service', 'price', 'ambiance', 'speed'];
  const ratingPairs = new Set();
  for (let i = 0; i < 40; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const key = `${userId}__${businessId}`;
    if (ratingPairs.has(key)) continue;
    ratingPairs.add(key);
    const now = daysAgo(randomInt(0, 25));
    // ~50% of ratings have criteria data
    const hasCriteria = i % 2 === 0;
    const criteria = hasCriteria ? {} : undefined;
    if (criteria) {
      // Randomly fill 2-5 criteria
      const numCriteria = randomInt(2, 5);
      const shuffled = [...CRITERIA_KEYS].sort(() => Math.random() - 0.5);
      for (let c = 0; c < numCriteria; c++) {
        criteria[shuffled[c]] = randomInt(1, 5);
      }
    }
    await setDoc(doc(db, 'ratings', key), {
      userId,
      businessId,
      score: randomInt(1, 5),
      createdAt: now,
      updatedAt: now,
      ...(criteria ? { criteria } : {}),
    });
  }

  // 7. Favorites
  console.log('Creating favorites...');
  const favPairs = new Set();
  for (let i = 0; i < 60; i++) {
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
  for (let i = 0; i < 80; i++) {
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

  // 11. Users (with displayNameLower and follow counters, matching onUserCreated trigger)
  console.log('Creating users...');
  for (let i = 0; i < USER_IDS.length; i++) {
    await setDoc(doc(db, 'users', USER_IDS[i]), {
      displayName: USER_NAMES[i],
      displayNameLower: USER_NAMES[i].toLowerCase(),
      followersCount: 0,
      followingCount: 0,
      createdAt: daysAgo(randomInt(1, 30)),
    });
  }

  // 12. PriceLevels
  console.log('Creating price levels...');
  const plPairs = new Set();
  for (let i = 0; i < 35; i++) {
    const userId = randomFrom(USER_IDS);
    const businessId = randomFrom(BUSINESS_IDS);
    const key = `${userId}__${businessId}`;
    if (plPairs.has(key)) continue;
    plPairs.add(key);
    const now = daysAgo(randomInt(0, 20));
    await setDoc(doc(db, 'priceLevels', key), {
      userId,
      businessId,
      level: randomInt(1, 3),
      createdAt: now,
      updatedAt: now,
    });
  }

  // 13. MenuPhotos (pending, approved, rejected)
  console.log('Creating menu photos...');
  const statuses = ['pending', 'pending', 'approved', 'approved', 'rejected'];
  for (let i = 0; i < 5; i++) {
    const status = statuses[i];
    const data = {
      userId: randomFrom(USER_IDS),
      businessId: BUSINESS_IDS[i],
      storagePath: `menus/${BUSINESS_IDS[i]}/seed_${i}_original`,
      thumbnailPath: `menus/${BUSINESS_IDS[i]}/seed_${i}_thumb.jpg`,
      status,
      createdAt: daysAgo(randomInt(1, 15)),
      reportCount: 0,
    };
    if (status === 'approved' || status === 'rejected') {
      data.reviewedBy = 'admin_seed';
      data.reviewedAt = daysAgo(randomInt(0, 5));
    }
    if (status === 'rejected') {
      data.rejectionReason = 'Foto borrosa o de baja calidad';
    }
    await addDoc(collection(db, 'menuPhotos'), data);
  }

  // Monthly ranking (so top 3 users have badges in profiles)
  console.log('Creating monthly ranking...');
  const now = new Date();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const periodKey = `monthly_${now.getFullYear()}-${monthStr}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const rankingEntries = USER_IDS.map((userId, i) => ({
    userId,
    displayName: USER_NAMES[i],
    score: 100 - i * 8 + randomInt(0, 5),
    breakdown: {
      comments: randomInt(5, 20),
      ratings: randomInt(3, 15),
      likes: randomInt(2, 10),
      tags: randomInt(1, 5),
      favorites: randomInt(2, 8),
      photos: randomInt(0, 3),
    },
  })).sort((a, b) => b.score - a.score);

  await setDoc(doc(db, 'userRankings', periodKey), {
    period: periodKey,
    startDate: monthStart,
    endDate: monthEnd,
    rankings: rankingEntries,
    totalParticipants: rankingEntries.length,
  });

  // Weekly ranking (current week)
  console.log('Creating weekly ranking (current week)...');
  const weekD = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const weekDayNum = weekD.getUTCDay() || 7;
  weekD.setUTCDate(weekD.getUTCDate() + 4 - weekDayNum);
  const weekYearStart = new Date(Date.UTC(weekD.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((weekD.getTime() - weekYearStart.getTime()) / 86400000 + 1) / 7);
  const weekKey = `weekly_${weekD.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  const weekStart = new Date(now);
  const weekDay = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - weekDay + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weeklyEntries = USER_IDS.map((userId, i) => ({
    userId,
    displayName: USER_NAMES[i],
    score: 80 - i * 6 + randomInt(0, 5),
    breakdown: {
      comments: randomInt(3, 12),
      ratings: randomInt(2, 8),
      likes: randomInt(1, 6),
      tags: randomInt(0, 3),
      favorites: randomInt(1, 5),
      photos: randomInt(0, 2),
    },
  })).sort((a, b) => b.score - a.score);

  await setDoc(doc(db, 'userRankings', weekKey), {
    period: weekKey,
    startDate: weekStart,
    endDate: weekEnd,
    rankings: weeklyEntries,
    totalParticipants: weeklyEntries.length,
  });

  // Previous week ranking (for trend indicators)
  console.log('Creating weekly ranking (previous week)...');
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekD = new Date(Date.UTC(prevWeekStart.getFullYear(), prevWeekStart.getMonth(), prevWeekStart.getDate()));
  const prevDayNum = prevWeekD.getUTCDay() || 7;
  prevWeekD.setUTCDate(prevWeekD.getUTCDate() + 4 - prevDayNum);
  const prevYearStart = new Date(Date.UTC(prevWeekD.getUTCFullYear(), 0, 1));
  const prevWeekNum = Math.ceil(((prevWeekD.getTime() - prevYearStart.getTime()) / 86400000 + 1) / 7);
  const prevWeekKey = `weekly_${prevWeekD.getUTCFullYear()}-W${String(prevWeekNum).padStart(2, '0')}`;

  // Shuffle positions vs current week to show trend arrows
  const prevWeeklyEntries = [...weeklyEntries]
    .map((e) => ({ ...e, score: e.score + randomInt(-15, 15) }))
    .sort((a, b) => b.score - a.score);

  await setDoc(doc(db, 'userRankings', prevWeekKey), {
    period: prevWeekKey,
    startDate: prevWeekStart,
    endDate: weekStart,
    rankings: prevWeeklyEntries,
    totalParticipants: prevWeeklyEntries.length,
  });

  // All-time ranking
  console.log('Creating all-time ranking...');
  const alltimeEntries = USER_IDS.map((userId, i) => ({
    userId,
    displayName: USER_NAMES[i],
    score: 200 - i * 15 + randomInt(0, 10),
    breakdown: {
      comments: randomInt(10, 40),
      ratings: randomInt(5, 25),
      likes: randomInt(5, 20),
      tags: randomInt(2, 10),
      favorites: randomInt(5, 15),
      photos: randomInt(1, 8),
    },
  })).sort((a, b) => b.score - a.score);

  await setDoc(doc(db, 'userRankings', 'alltime'), {
    period: 'alltime',
    startDate: new Date(2020, 0, 1),
    endDate: now,
    rankings: alltimeEntries,
    totalParticipants: alltimeEntries.length,
  });

  // Ensure every business has a comment from a top-3 user
  console.log('Creating top-user comments for all businesses...');
  const TOP_3_IDS = rankingEntries.slice(0, 3).map((r) => r.userId);
  const TOP_3_NAMES = TOP_3_IDS.map((id) => USER_NAMES[USER_IDS.indexOf(id)]);
  for (const bizId of BUSINESS_IDS) {
    const topIdx = randomInt(0, 2);
    await addDoc(collection(db, 'comments'), {
      userId: TOP_3_IDS[topIdx],
      userName: TOP_3_NAMES[topIdx],
      businessId: bizId,
      text: randomFrom(COMMENT_TEXTS),
      createdAt: daysAgo(randomInt(0, 15)),
      likeCount: randomInt(2, 12),
    });
  }

  // User settings (all public for testing profile sheets)
  console.log('Creating user settings...');
  for (let i = 0; i < USER_IDS.length; i++) {
    await setDoc(doc(db, 'userSettings', USER_IDS[i]), {
      profilePublic: true,
      notificationsEnabled: i % 3 === 0,
      notifyLikes: i % 3 === 0,
      notifyPhotos: i % 3 === 0,
      notifyRankings: i % 3 === 0,
      notifyFeedback: true,
      notifyReplies: true,
      notifyFollowers: true,
      notifyRecommendations: true,
      analyticsEnabled: true,
      updatedAt: new Date(),
    });
  }

  // ── Follows (user_001..user_005 follow each other in varied patterns) ────
  console.log('Creating follows...');
  const followPairs = [
    // user_001 (Juan) follows 3 people
    ['user_001', 'user_002'],
    ['user_001', 'user_003'],
    ['user_001', 'user_005'],
    // user_002 (Maria) follows 2 people
    ['user_002', 'user_001'],
    ['user_002', 'user_004'],
    // user_003 (Carlos) follows 4 people
    ['user_003', 'user_001'],
    ['user_003', 'user_002'],
    ['user_003', 'user_005'],
    ['user_003', 'user_006'],
    // user_004 (Ana) follows 1 person
    ['user_004', 'user_001'],
    // user_005 (Pedro) follows 2 people
    ['user_005', 'user_001'],
    ['user_005', 'user_003'],
    // user_006 (Laura) follows 1 person
    ['user_006', 'user_002'],
  ];

  for (const [followerId, followedId] of followPairs) {
    const key = `${followerId}__${followedId}`;
    await setDoc(doc(db, 'follows', key), {
      followerId,
      followedId,
      createdAt: daysAgo(randomInt(0, 14)),
    });
  }

  // Update follow counters on user docs to match seeded follows
  const followerCounts = {};
  const followingCounts = {};
  for (const [followerId, followedId] of followPairs) {
    followingCounts[followerId] = (followingCounts[followerId] || 0) + 1;
    followerCounts[followedId] = (followerCounts[followedId] || 0) + 1;
  }
  for (const uid of USER_IDS) {
    if (followerCounts[uid] || followingCounts[uid]) {
      await db.collection('users').doc(uid).update({
        followersCount: followerCounts[uid] || 0,
        followingCount: followingCounts[uid] || 0,
      });
    }
  }

  // ── Activity Feed (subcollection: activityFeed/{userId}/items) ────
  // Simulates fan-out items that followers would see from people they follow
  console.log('Creating activity feed items...');
  const ACTIVITY_TYPES = ['rating', 'comment', 'favorite'];
  const BIZ_NAMES = [
    'El Buen Paladar', 'Cafe Libertad', 'Pizzeria Nonna',
    'Heladeria Gelato', 'Panaderia San Jose',
  ];

  // For each user who follows someone, create 2-3 feed items from the people they follow
  const feedItemCount = {};
  for (const [followerId, followedId] of followPairs) {
    const numItems = randomInt(2, 3);
    const followedIdx = USER_IDS.indexOf(followedId);
    for (let fi = 0; fi < numItems; fi++) {
      const bizIdx = randomInt(0, 4);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const feedRef = db.collection('activityFeed').doc(followerId)
        .collection('items').doc();
      await feedRef.set({
        actorId: followedId,
        actorName: USER_NAMES[followedIdx],
        type: ACTIVITY_TYPES[fi % ACTIVITY_TYPES.length],
        businessId: BUSINESS_IDS[bizIdx],
        businessName: BIZ_NAMES[bizIdx],
        referenceId: `seed_ref_${followerId}_${followedId}_${fi}`,
        createdAt: daysAgo(randomInt(0, 10)),
        expiresAt,
      });
      feedItemCount[followerId] = (feedItemCount[followerId] || 0) + 1;
    }
  }
  const totalFeedItems = Object.values(feedItemCount).reduce((a, b) => a + b, 0);

  // ── Recommendations (user_001 recommends businesses to various recipients) ────
  console.log('Creating recommendations...');
  const recommendationMessages = [
    'Te va a encantar este lugar, tienen las mejores medialunas!',
    'Pasé por acá el fin de semana, altamente recomendado',
    'Probá el café, es excelente. La atención también es muy buena',
    'Si te gustan las pizzas, este es tu lugar',
    'Lo mejor de la zona para comer rápido y bien',
    'La comida es buena y los precios muy accesibles',
  ];

  const recommendations = [
    // user_001 recommends to user_002
    { senderId: 'user_001', senderName: 'Juan', recipientId: 'user_002', businessId: 'biz_001', businessName: 'El Buen Paladar', messageIdx: 0, daysAgoVal: 5 },
    // user_002 recommends to user_003
    { senderId: 'user_002', senderName: 'María', recipientId: 'user_003', businessId: 'biz_002', businessName: 'Cafe Libertad', messageIdx: 1, daysAgoVal: 4 },
    // user_003 recommends to user_001
    { senderId: 'user_003', senderName: 'Carlos', recipientId: 'user_001', businessId: 'biz_005', businessName: 'Panaderia San Jose', messageIdx: 2, daysAgoVal: 3 },
    // user_001 recommends to user_004
    { senderId: 'user_001', senderName: 'Juan', recipientId: 'user_004', businessId: 'biz_003', businessName: 'Pizzeria Nonna', messageIdx: 3, daysAgoVal: 2 },
    // user_004 recommends to user_005
    { senderId: 'user_004', senderName: 'Ana', recipientId: 'user_005', businessId: 'biz_010', businessName: 'Heladeria Gelato', messageIdx: 4, daysAgoVal: 1 },
    // user_005 recommends to user_002
    { senderId: 'user_005', senderName: 'Pedro', recipientId: 'user_002', businessId: 'biz_004', businessName: 'Bar Botanico', messageIdx: 5, daysAgoVal: 0 },
    // Additional cross recommendations
    { senderId: 'user_006', senderName: 'Laura', recipientId: 'user_007', businessId: 'biz_006', businessName: 'Cafe Bonanza', messageIdx: 0, daysAgoVal: 6 },
    { senderId: 'user_007', senderName: 'Diego', recipientId: 'user_008', businessId: 'biz_007', businessName: 'Sushi Tokyo', messageIdx: 1, daysAgoVal: 5 },
    { senderId: 'user_008', senderName: 'Lucía', recipientId: 'user_009', businessId: 'biz_008', businessName: 'Burger House', messageIdx: 2, daysAgoVal: 4 },
    { senderId: 'user_009', senderName: 'Martín', recipientId: 'user_010', businessId: 'biz_009', businessName: 'Resto Asia', messageIdx: 3, daysAgoVal: 3 },
    { senderId: 'user_010', senderName: 'Sofía', recipientId: 'user_001', businessId: 'biz_011', businessName: 'Parrilla Gaucho', messageIdx: 4, daysAgoVal: 2 },
    { senderId: 'user_002', senderName: 'María', recipientId: 'user_006', businessId: 'biz_012', businessName: 'Feria Orgánica', messageIdx: 5, daysAgoVal: 1 },
  ];

  for (const rec of recommendations) {
    const docRef = doc(db, 'recommendations', `${rec.senderId}_${rec.recipientId}_${rec.businessId}`);
    await setDoc(docRef, {
      id: `${rec.senderId}_${rec.recipientId}_${rec.businessId}`,
      senderId: rec.senderId,
      senderName: rec.senderName,
      recipientId: rec.recipientId,
      businessId: rec.businessId,
      businessName: rec.businessName,
      message: recommendationMessages[rec.messageIdx],
      read: Math.random() > 0.4, // 60% read, 40% unread
      createdAt: daysAgo(rec.daysAgoVal),
    });
  }

  // Notifications (including feedback_response)
  console.log('Creating notifications...');
  const notifTypes = ['like', 'photo_approved', 'photo_rejected', 'ranking', 'feedback_response', 'comment_reply', 'new_follower'];
  for (let i = 0; i < 15; i++) {
    const userId = USER_IDS[i % USER_IDS.length];
    const type = notifTypes[i % notifTypes.length];
    const actorIdx = (USER_IDS.indexOf(userId) + 1) % USER_IDS.length;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await addDoc(collection(db, 'notifications'), {
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
                  ? `${USER_NAMES[actorIdx]} respondió tu comentario: "Buen dato, gracias!"`
                  : 'Se publicó el ranking semanal',
      read: i % 3 === 0,
      createdAt: daysAgo(randomInt(0, 7)),
      expiresAt,
      ...(type === 'like' || type === 'comment_reply' ? { actorId: USER_IDS[actorIdx], actorName: USER_NAMES[actorIdx] } : {}),
      ...(type !== 'ranking' && type !== 'feedback_response' ? { businessId: randomFrom(BUSINESS_IDS), businessName: `Comercio ${randomInt(1, 15)}` } : {}),
      ...(type === 'feedback_response' ? { referenceId: `seed_feedback_${i}` } : {}),
      ...(type === 'comment_reply' ? { referenceId: `seed_comment_${i}` } : {}),
    });
  }

  // Update counters with new collections
  await db.doc('config/counters').set({
    priceLevels: plPairs.size,
    menuPhotos: 5,
    perfMetrics: 7,
  }, { merge: true });

  // ── Trending Businesses (computed by Cloud Function, but seed sample for testing UI) ────
  console.log('Seeding trending businesses sample...');
  // Note: In production, computeTrendingBusinesses Cloud Function creates this.
  // This seed provides sample data for testing the UI in emulators.
  const nowTrending = new Date();
  const sevenDaysAgo = new Date(nowTrending);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trendingBusinesses = [
    {
      businessId: 'biz_001',
      name: 'El Buen Paladár',
      category: 'restaurant',
      score: 47,
      breakdown: { ratings: 8, comments: 12, userTags: 6, priceLevels: 3, listItems: 5 },
      rank: 1,
    },
    {
      businessId: 'biz_002',
      name: 'Café Libertad',
      category: 'cafe',
      score: 39,
      breakdown: { ratings: 5, comments: 10, userTags: 4, priceLevels: 2, listItems: 4 },
      rank: 2,
    },
    {
      businessId: 'biz_003',
      name: 'Pizzería Nonna',
      category: 'pizza',
      score: 35,
      breakdown: { ratings: 7, comments: 8, userTags: 3, priceLevels: 2, listItems: 3 },
      rank: 3,
    },
    {
      businessId: 'biz_004',
      name: 'Heladería Gelato',
      category: 'icecream',
      score: 28,
      breakdown: { ratings: 4, comments: 6, userTags: 3, priceLevels: 1, listItems: 3 },
      rank: 4,
    },
    {
      businessId: 'biz_005',
      name: 'Panadería San José',
      category: 'bakery',
      score: 24,
      breakdown: { ratings: 3, comments: 5, userTags: 2, priceLevels: 1, listItems: 2 },
      rank: 5,
    },
  ];

  await setDoc(doc(db, 'trendingBusinesses', 'current'), {
    businesses: trendingBusinesses,
    computedAt: Timestamp.fromDate(nowTrending),
    periodStart: Timestamp.fromDate(sevenDaysAgo),
    periodEnd: Timestamp.fromDate(nowTrending),
  });

  // Seed config/aggregates for pre-aggregated dailyMetrics (DT-4)
  // ── Performance Metrics (7 docs, one per day) ─────────────────────────
  const perfDevices = [
    { type: 'mobile', connection: '4g' },
    { type: 'desktop', connection: 'wifi' },
    { type: 'mobile', connection: '3g' },
    { type: 'desktop', connection: 'wifi' },
    { type: 'mobile', connection: '4g' },
    { type: 'desktop', connection: 'wifi' },
    { type: 'mobile', connection: '3g' },
  ];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(12, 0, 0, 0);
    const isMobile = perfDevices[i].type === 'mobile';
    const is3g = perfDevices[i].connection === '3g';
    const lcpBase = isMobile ? (is3g ? 3500 : 2200) : 1500;
    const inpBase = isMobile ? (is3g ? 350 : 180) : 80;
    const clsBase = isMobile ? 0.08 : 0.03;
    const ttfbBase = is3g ? 1200 : isMobile ? 600 : 350;

    await addDoc(collection(db, 'perfMetrics'), {
      sessionId: `seed-session-${i}`,
      userId: USER_IDS[i % USER_IDS.length],
      timestamp: Timestamp.fromDate(d),
      vitals: {
        lcp: lcpBase + Math.random() * 400 - 200,
        inp: inpBase + Math.random() * 60 - 30,
        cls: clsBase + Math.random() * 0.04,
        ttfb: ttfbBase + Math.random() * 200 - 100,
      },
      queries: {
        notifications: { p50: 80 + Math.random() * 40, p95: 200 + Math.random() * 100, count: 5 + Math.floor(Math.random() * 10) },
        userSettings: { p50: 40 + Math.random() * 30, p95: 120 + Math.random() * 60, count: 3 + Math.floor(Math.random() * 5) },
        paginatedQuery: { p50: 150 + Math.random() * 80, p95: 400 + Math.random() * 200, count: 8 + Math.floor(Math.random() * 15) },
      },
      device: perfDevices[i],
      appVersion: '2.8.0',
    });
  }

  // Compute business-level aggregates from seeded data
  const bizFavCounts = {};
  const bizCommentCounts = {};
  const bizRatingCount = {};
  const bizRatingSum = {};
  const ratingDist = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  // We'll approximate from the known seed structure
  // (exact counts computed later by triggers in production)
  await db.doc('config/aggregates').set({
    businessFavorites: bizFavCounts,
    businessComments: bizCommentCounts,
    businessRatingCount: bizRatingCount,
    businessRatingSum: bizRatingSum,
    ratingDistribution: ratingDist,
    tagCounts: {},
  });

  // Create admin user in Auth emulator with custom claims
  console.log('Creating admin user in Auth emulator...');
  const ADMIN_EMAIL = 'benoffi11@gmail.com';
  const AUTH_EMULATOR = 'http://localhost:9099';

  let adminUid = null;
  try {
    const createRes = await fetch(
      `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: 'dev123456',
          returnSecureToken: true,
        }),
      },
    );
    const createData = await createRes.json();
    adminUid = createData.localId;
  } catch {
    // User may already exist — try to look up
    console.log('  Admin user may already exist, attempting lookup...');
  }

  if (!adminUid) {
    // Try signing in to get the UID
    try {
      const signInRes = await fetch(
        `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
          body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: 'dev123456',
            returnSecureToken: true,
          }),
        },
      );
      const signInData = await signInRes.json();
      adminUid = signInData.localId;
    } catch {
      console.log('  Could not find or create admin user');
    }
  }

  if (adminUid) {
    // Set emailVerified + custom claims (admin: true)
    await fetch(
      `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({
          localId: adminUid,
          emailVerified: true,
          customAttributes: JSON.stringify({ admin: true }),
        }),
      },
    );
    console.log(`  Admin user ready: ${ADMIN_EMAIL} (uid: ${adminUid}, claim: admin=true)`);
  }

  console.log('\n✅ Seed complete!');
  console.log('- 10 users');
  console.log('- ~60 comments (4 flagged, ~6 edited, with likeCount) + ~20 replies (threads)');
  console.log('- ~80 comment likes');
  console.log('- ~40 ratings');
  console.log('- ~60 favorites');
  console.log('- ~80 user tags');
  console.log('- 15 custom tags');
  console.log('- 8 feedback (1 flagged)');
  console.log('- 15 days of daily metrics');
  console.log('- 12 abuse logs');
  console.log(`- ${plPairs.size} price levels`);
  console.log('- 5 menu photos (2 pending, 2 approved, 1 rejected)');
  console.log('- 1 monthly ranking (10 users, top 3 with badges)');
  console.log('- 2 weekly rankings (current + previous, for trend arrows)');
  console.log('- 1 all-time ranking');
  console.log('- 30 top-user comments (1 per business from top 3)');
  console.log('- 15 notifications (incl. feedback_response)');
  console.log('- 12 recommendations (varied senders/recipients, 60% read)');
  console.log('- 10 user settings (all public, notifyRecommendations enabled)');
  console.log('- 7 perf metrics (1 per day, mix mobile/desktop, wifi/4g/3g)');
  console.log('- 1 trending businesses document (5 sample trending businesses)');
  console.log('- Counters and moderation config');
  console.log('- 1 admin user with custom claim (admin: true)');
  console.log('\nOpen http://localhost:4000 to see data in Emulator UI');
  console.log('Open http://localhost:5173/admin to see the dashboard');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
