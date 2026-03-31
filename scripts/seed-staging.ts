/**
 * Seed script for staging database.
 * Run with: cp scripts/seed-staging.ts functions/seed.ts && cd functions && npx tsx seed.ts && rm seed.ts
 * Uses firebase-admin with application default credentials to write to the 'staging' database.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

// Create ADC file from firebase-tools refresh token
const firebaseConfig = JSON.parse(readFileSync(resolve(process.env.HOME!, '.config/configstore/firebase-tools.json'), 'utf-8'));
const adcPath = resolve(process.env.HOME!, '.config/gcloud/application_default_credentials.json');

// Ensure directory exists
import { mkdirSync } from 'fs';
mkdirSync(resolve(process.env.HOME!, '.config/gcloud'), { recursive: true });

// Write ADC file
const adcContent = {
  type: 'authorized_user',
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  refresh_token: firebaseConfig.tokens.refresh_token,
};
writeFileSync(adcPath, JSON.stringify(adcContent));
process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;

initializeApp({ projectId: 'modo-mapa-app' });
const db = getFirestore('staging');

// Cleanup ADC on exit
process.on('exit', () => { try { unlinkSync(adcPath); } catch {} });

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
  'Juan', 'Maria', 'Carlos', 'Ana', 'Pedro',
  'Laura', 'Diego', 'Lucia', 'Martin', 'Sofia',
];

const TAGS = ['barato', 'apto_celiacos', 'apto_veganos', 'rapido', 'delivery', 'buena_atencion'];

const COMMENT_TEXTS = [
  'Excelente lugar, muy recomendable!',
  'La comida es buena pero el servicio podria mejorar',
  'Precios accesibles y buena calidad',
  'Fui con amigos y la pasamos genial',
  'El mejor cafe de la zona',
  'Pedido por delivery, llego rapido y caliente',
  'Muy buena atencion al cliente',
  'Las porciones son generosas',
  'Buen lugar para ir a almorzar rapido',
  'Lo recomiendo para una cena tranquila',
  'Las hamburguesas son increibles',
  'El postre es lo mejor del menu',
  'Ambiente muy agradable',
  'Relacion precio-calidad perfecta',
  'Volveria sin dudarlo',
];

const FEEDBACK_MESSAGES = [
  'La app funciona genial, muy util para encontrar lugares!',
  'Estaria bueno poder filtrar por distancia',
  'A veces tarda en cargar los comentarios',
  'Me encanta poder marcar favoritos',
  'Seria util agregar fotos de los comercios',
  'El mapa deberia mostrar mas info sin hacer click',
  'Bug: a veces no carga los tags',
  'Me gustaria poder compartir listas con amigos',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randomInt(8, 22), randomInt(0, 59), 0, 0);
  return d;
}

async function seed() {
  console.log('Seeding staging database...\n');

  // 1. Users
  console.log('Creating users...');
  for (let i = 0; i < USER_IDS.length; i++) {
    await db.doc(`users/${USER_IDS[i]}`).set({
      displayName: USER_NAMES[i],
      displayNameLower: USER_NAMES[i].toLowerCase(),
      createdAt: daysAgo(randomInt(30, 90)),
      isAdmin: i === 0,
    });
  }

  // 2. Comments
  console.log('Creating comments...');
  for (let i = 0; i < 60; i++) {
    const userId = USER_IDS[i % USER_IDS.length];
    await db.collection('comments').add({
      userId,
      userName: USER_NAMES[USER_IDS.indexOf(userId)],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      text: COMMENT_TEXTS[i % COMMENT_TEXTS.length],
      likeCount: randomInt(0, 5),
      replyCount: 0,
      flagged: i % 15 === 0,
      createdAt: daysAgo(randomInt(0, 30)),
      ...(i % 8 === 0 ? { updatedAt: daysAgo(randomInt(0, 5)) } : {}),
    });
  }

  // 3. Ratings
  console.log('Creating ratings...');
  for (let i = 0; i < 40; i++) {
    await db.collection('ratings').add({
      userId: USER_IDS[i % USER_IDS.length],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      score: randomInt(1, 5),
      createdAt: daysAgo(randomInt(0, 30)),
    });
  }

  // 4. Favorites
  console.log('Creating favorites...');
  for (let i = 0; i < 30; i++) {
    await db.collection('favorites').add({
      userId: USER_IDS[i % USER_IDS.length],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      createdAt: daysAgo(randomInt(0, 30)),
    });
  }

  // 5. Tags
  console.log('Creating user tags...');
  for (let i = 0; i < 50; i++) {
    await db.collection('userTags').add({
      userId: USER_IDS[i % USER_IDS.length],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      tagId: randomFrom(TAGS),
      createdAt: daysAgo(randomInt(0, 30)),
    });
  }

  // 6. Custom tags
  console.log('Creating custom tags...');
  const customLabels = ['Terraza linda', 'Buena musica', 'Para laburar', 'Pet friendly', 'Brunch', 'Buenas pastas'];
  for (let i = 0; i < 15; i++) {
    await db.collection('customTags').add({
      userId: USER_IDS[i % USER_IDS.length],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      label: randomFrom(customLabels),
      createdAt: daysAgo(randomInt(0, 20)),
    });
  }

  // 7. Feedback
  console.log('Creating feedback...');
  const categories = ['bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro'] as const;
  for (let i = 0; i < 8; i++) {
    await db.collection('feedback').add({
      userId: USER_IDS[i % USER_IDS.length],
      category: categories[i % categories.length],
      message: FEEDBACK_MESSAGES[i],
      status: i < 3 ? 'pending' : i < 5 ? 'viewed' : 'responded',
      flagged: i === 6,
      createdAt: daysAgo(randomInt(0, 14)),
      ...(i >= 5 ? { adminResponse: 'Gracias por tu feedback, lo estamos evaluando.' } : {}),
    });
  }

  // 8. Counters
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

  // 9. Moderation
  await db.doc('config/moderation').set({
    bannedWords: ['spam', 'estafa', 'basura'],
  });

  // 10. Daily metrics (last 15 days)
  console.log('Creating daily metrics...');
  const now = new Date();
  for (let day = 0; day < 15; day++) {
    const d = new Date(now);
    d.setDate(d.getDate() - day);
    const dateKey = d.toISOString().slice(0, 10);
    const activeUsers = randomInt(3, 10);
    const comments = randomInt(1, 8);
    const ratings = randomInt(1, 5);
    const favorites = randomInt(0, 4);
    const feedback = randomInt(0, 2);
    const tags = randomInt(0, 6);
    const likes = randomInt(0, 4);
    const checkins = randomInt(0, 3);
    const follows = randomInt(0, 2);
    const recs = randomInt(0, 2);
    const totalWrites = comments + ratings + favorites + feedback + tags + likes + checkins + follows + recs;
    await db.doc(`dailyMetrics/${dateKey}`).set({
      ratingDistribution: { '1': randomInt(0, 3), '2': randomInt(0, 3), '3': randomInt(1, 5), '4': randomInt(2, 6), '5': randomInt(1, 4) },
      topFavorited: BUSINESS_IDS.slice(0, 5).map((id) => ({ businessId: id, count: randomInt(1, 5) })),
      topCommented: BUSINESS_IDS.slice(5, 10).map((id) => ({ businessId: id, count: randomInt(1, 5) })),
      topRated: BUSINESS_IDS.slice(10, 15).map((id) => ({ businessId: id, count: randomInt(1, 5), avgScore: randomInt(30, 50) / 10 })),
      topTags: TAGS.slice(0, 4).map((tagId) => ({ tagId, count: randomInt(1, 5) })),
      dailyReads: randomInt(100, 500),
      dailyWrites: totalWrites,
      dailyDeletes: randomInt(0, 5),
      writesByCollection: { comments, ratings, favorites, feedback, userTags: tags, customTags: randomInt(0, 2), commentLikes: likes, checkins, follows, recommendations: recs },
      readsByCollection: { comments: randomInt(20, 80), ratings: randomInt(10, 40), favorites: randomInt(5, 20) },
      deletesByCollection: { comments: randomInt(0, 2), favorites: randomInt(0, 1) },
      activeUsers,
      newAccounts: day < 5 ? randomInt(0, 2) : 0,
    });
  }

  // 11. Comment likes
  console.log('Creating comment likes...');
  for (let i = 0; i < 25; i++) {
    await db.collection('commentLikes').add({
      userId: USER_IDS[i % USER_IDS.length],
      commentId: `seed_comment_${randomInt(0, 59)}`,
      createdAt: daysAgo(randomInt(0, 14)),
    });
  }

  // 12. Price levels
  console.log('Creating price levels...');
  for (let i = 0; i < 30; i++) {
    await db.collection('priceLevels').add({
      userId: USER_IDS[i % USER_IDS.length],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      level: randomInt(1, 3),
      createdAt: daysAgo(randomInt(0, 20)),
    });
  }

  // 13. Rankings
  console.log('Creating rankings...');
  const weeklyKey = `weekly_${now.toISOString().slice(0, 10)}`;
  const weekStart = new Date(now);
  const weekDay = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - weekDay + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rankingEntries = USER_IDS.map((userId, idx) => {
    const breakdown = {
      comments: randomInt(0, 8), ratings: randomInt(0, 5), likes: randomInt(0, 10),
      tags: randomInt(0, 6), favorites: randomInt(0, 4), photos: randomInt(0, 2),
    };
    const score = breakdown.comments * 3 + breakdown.ratings * 2 + breakdown.likes + breakdown.tags + breakdown.favorites + breakdown.photos * 5;
    return { userId, displayName: USER_NAMES[idx], score, breakdown };
  }).filter((e) => e.score > 0).sort((a, b) => b.score - a.score);

  await db.doc(`userRankings/${weeklyKey}`).set({
    period: weeklyKey, startDate: weekStart, endDate: weekEnd,
    rankings: rankingEntries, totalParticipants: rankingEntries.length,
  });

  // 14. Notifications (all 8 types)
  console.log('Creating notifications...');
  const notifTypes = ['like', 'photo_approved', 'photo_rejected', 'ranking', 'feedback_response', 'comment_reply', 'new_follower', 'recommendation'] as const;
  for (let i = 0; i < 24; i++) {
    const userId = USER_IDS[i % USER_IDS.length];
    const type = notifTypes[i % notifTypes.length];
    const actorIdx = (USER_IDS.indexOf(userId) + 1) % USER_IDS.length;
    await db.collection('notifications').add({
      userId, type,
      message: type === 'like' ? `${USER_NAMES[actorIdx]} le dio like a tu comentario`
        : type === 'comment_reply' ? `${USER_NAMES[actorIdx]} respondio tu comentario`
        : type === 'new_follower' ? `${USER_NAMES[actorIdx]} empezo a seguirte`
        : type === 'recommendation' ? `${USER_NAMES[actorIdx]} te recomendo un comercio`
        : type === 'photo_approved' ? 'Tu foto de menu fue aprobada'
        : type === 'photo_rejected' ? 'Tu foto de menu fue rechazada'
        : type === 'feedback_response' ? 'Tu feedback recibio una respuesta'
        : 'Se publico el ranking semanal',
      read: i % 3 === 0,
      createdAt: daysAgo(randomInt(0, 7)),
      ...((['like', 'comment_reply', 'new_follower', 'recommendation'].includes(type)) ? { actorId: USER_IDS[actorIdx], actorName: USER_NAMES[actorIdx] } : {}),
      ...(!['ranking', 'feedback_response', 'new_follower'].includes(type) ? { businessId: randomFrom(BUSINESS_IDS) } : {}),
    });
  }

  // 15. Check-ins
  console.log('Creating check-ins...');
  for (let i = 0; i < 20; i++) {
    await db.collection('checkins').add({
      userId: USER_IDS[i % USER_IDS.length],
      businessId: BUSINESS_IDS[i % BUSINESS_IDS.length],
      businessName: `Comercio ${(i % BUSINESS_IDS.length) + 1}`,
      createdAt: daysAgo(randomInt(0, 14)),
      ...(i % 3 === 0 ? { location: { lat: -34.5591 + Math.random() * 0.02, lng: -58.4473 + Math.random() * 0.02 } } : {}),
    });
  }

  // 16. Follows
  console.log('Creating follows...');
  for (let i = 0; i < USER_IDS.length; i++) {
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

  // 17. Recommendations
  console.log('Creating recommendations...');
  for (let i = 0; i < 12; i++) {
    const senderIdx = i % USER_IDS.length;
    const recipientIdx = (senderIdx + 1 + randomInt(0, 4)) % USER_IDS.length;
    const businessId = BUSINESS_IDS[randomInt(0, BUSINESS_IDS.length - 1)];
    await db.collection('recommendations').add({
      senderId: USER_IDS[senderIdx], senderName: USER_NAMES[senderIdx],
      recipientId: USER_IDS[recipientIdx],
      businessId, businessName: `Comercio ${BUSINESS_IDS.indexOf(businessId) + 1}`,
      message: randomFrom(['Probalo, te va a gustar!', 'Muy bueno este lugar', 'Te lo recomiendo para almorzar', 'Excelente relacion precio-calidad']),
      read: i % 3 === 0,
      createdAt: daysAgo(randomInt(0, 14)),
    });
  }

  // 18. Shared Lists + Items
  console.log('Creating shared lists...');
  const listNames = ['Mis favoritos de pizza', 'Cafeterias top', 'Para ir con amigos', 'Almuerzo rapido', 'Cena romantica', 'Opciones veganas'];
  for (let i = 0; i < listNames.length; i++) {
    const ownerId = USER_IDS[i % USER_IDS.length];
    const isPublic = i < 4;
    const itemCount = randomInt(2, 8);
    const editorIds = i === 0 ? [USER_IDS[1], USER_IDS[2]] : i === 2 ? [USER_IDS[0]] : [];
    const listRef = await db.collection('sharedLists').add({
      ownerId, name: listNames[i], description: `Lista de ${listNames[i].toLowerCase()}`,
      isPublic, featured: i < 2, editorIds, itemCount,
      createdAt: daysAgo(randomInt(5, 30)), updatedAt: daysAgo(randomInt(0, 5)),
    });
    for (let j = 0; j < itemCount; j++) {
      await db.collection('listItems').add({
        listId: listRef.id,
        businessId: BUSINESS_IDS[(i * 5 + j) % BUSINESS_IDS.length],
        addedBy: j < 2 && editorIds.length > 0 ? editorIds[0] : ownerId,
        createdAt: daysAgo(randomInt(0, 10)),
      });
    }
  }

  // 19. Trending Businesses
  console.log('Creating trending businesses...');
  await db.doc('trendingBusinesses/current').set({
    businesses: BUSINESS_IDS.slice(0, 10).map((businessId, idx) => ({
      businessId, name: `Comercio ${idx + 1}`,
      category: randomFrom(['restaurant', 'cafe', 'bar', 'bakery']),
      score: 50 - idx * 4 + randomInt(0, 5),
      breakdown: { ratings: randomInt(2, 8), comments: randomInt(1, 6), userTags: randomInt(0, 4), priceLevels: randomInt(1, 3), listItems: randomInt(0, 2) },
      rank: idx + 1,
    })),
    computedAt: new Date(),
    periodStart: daysAgo(7),
    periodEnd: new Date(),
  });

  // 20. User Settings
  console.log('Creating user settings...');
  for (let i = 0; i < USER_IDS.length; i++) {
    await db.doc(`userSettings/${USER_IDS[i]}`).set({
      profilePublic: true,
      notificationsEnabled: i % 3 === 0,
      notifyLikes: i % 3 === 0,
      notifyPhotos: i % 3 === 0,
      notifyRankings: i % 3 === 0,
      notifyFeedback: true,
      analyticsEnabled: false,
      updatedAt: new Date(),
    });
  }

  console.log('\nStaging seed complete!');
  console.log('Collections seeded: users, comments, ratings, favorites, userTags, customTags,');
  console.log('feedback, commentLikes, priceLevels, rankings, notifications (8 types),');
  console.log('checkins, follows, recommendations, sharedLists, listItems, trendingBusinesses,');
  console.log('userSettings, dailyMetrics, config/counters');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
