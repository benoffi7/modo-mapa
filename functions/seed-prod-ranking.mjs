/**
 * Compute and save monthly ranking to production Firestore.
 * Uses firebase-admin from functions/node_modules with ADC from gcloud.
 * Run: node functions/seed-prod-ranking.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, 'node_modules', 'x.js'));
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');

// NO FIRESTORE_EMULATOR_HOST → connects to production
delete process.env.FIRESTORE_EMULATOR_HOST;
admin.initializeApp({ projectId: 'modo-mapa-app' });
const db = admin.firestore();

const SCORING = { comments: 3, ratings: 2, likes: 1, tags: 1, favorites: 1, photos: 5 };

async function countDocs(col, userId, start, end) {
  const snap = await db.collection(col)
    .where('userId', '==', userId)
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end))
    .count().get();
  return snap.data().count;
}

async function main() {
  const now = new Date();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const periodKey = `monthly_${now.getFullYear()}-${monthStr}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  console.log(`Computing ranking for ${periodKey}...`);

  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${users.length} users`);

  const rankings = [];
  for (const user of users) {
    const [comments, ratings, likes, tags, favorites, photosSnap] = await Promise.all([
      countDocs('comments', user.id, monthStart, monthEnd),
      countDocs('ratings', user.id, monthStart, monthEnd),
      countDocs('commentLikes', user.id, monthStart, monthEnd),
      countDocs('customTags', user.id, monthStart, monthEnd),
      countDocs('favorites', user.id, monthStart, monthEnd),
      db.collection('menuPhotos')
        .where('userId', '==', user.id)
        .where('status', '==', 'approved')
        .where('createdAt', '>=', Timestamp.fromDate(monthStart))
        .where('createdAt', '<', Timestamp.fromDate(monthEnd))
        .count().get(),
    ]);
    const photos = photosSnap.data().count;

    const score =
      comments * SCORING.comments +
      ratings * SCORING.ratings +
      likes * SCORING.likes +
      tags * SCORING.tags +
      favorites * SCORING.favorites +
      photos * SCORING.photos;

    if (score > 0) {
      rankings.push({
        userId: user.id,
        displayName: user.displayName || 'Anónimo',
        score,
        breakdown: { comments, ratings, likes, tags, favorites, photos },
      });
    }
  }

  rankings.sort((a, b) => b.score - a.score);
  const top50 = rankings.slice(0, 50);

  console.log(`\nActive users: ${rankings.length}, saving top ${top50.length}`);
  if (top50.length > 0) {
    console.log('Top 3:');
    top50.slice(0, 3).forEach((r, i) =>
      console.log(`  #${i + 1} ${r.displayName} — ${r.score}pts (comments:${r.breakdown.comments} ratings:${r.breakdown.ratings} likes:${r.breakdown.likes})`),
    );
  }

  await db.collection('userRankings').doc(periodKey).set({
    period: periodKey,
    startDate: Timestamp.fromDate(monthStart),
    endDate: Timestamp.fromDate(monthEnd),
    rankings: top50,
    totalParticipants: rankings.length,
  });

  console.log(`\nSaved ranking ${periodKey} to production.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
