import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { logger } from 'firebase-functions/v2';

const SYSTEM_OWNER = 'system';
const MIN_RATINGS_FOR_TOP = 3;
const TOP_N = 10;

interface FeaturedListDef {
  key: string;
  name: string;
  desc: string;
  items: string[];
}

function topNByValue(map: Record<string, number>, n: number): string[] {
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([id]) => id);
}

export function buildFeaturedLists(agg: Record<string, unknown>): FeaturedListDef[] {
  const ratingCounts = (agg.businessRatingCount ?? {}) as Record<string, number>;
  const ratingSums = (agg.businessRatingSum ?? {}) as Record<string, number>;
  const bizComments = (agg.businessComments ?? {}) as Record<string, number>;
  const bizFavorites = (agg.businessFavorites ?? {}) as Record<string, number>;

  // Top rated: minimum 3 ratings, sorted by average
  const topRated = Object.keys(ratingCounts)
    .filter((id) => ratingCounts[id] >= MIN_RATINGS_FOR_TOP)
    .map((id) => ({ id, avg: ratingSums[id] / ratingCounts[id] }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, TOP_N)
    .map((b) => b.id);

  const topCommented = topNByValue(bizComments, TOP_N);
  const topFavorited = topNByValue(bizFavorites, TOP_N);

  return [
    { key: 'featured_top_rated', name: 'Top 10 más calificados', desc: 'Los comercios con mejor promedio de rating', items: topRated },
    { key: 'featured_most_commented', name: 'Más comentados', desc: 'Los comercios con más opiniones de la comunidad', items: topCommented },
    { key: 'featured_most_favorited', name: 'Favoritos de la comunidad', desc: 'Los comercios que más usuarios guardaron', items: topFavorited },
  ];
}

export const generateFeaturedLists = onSchedule(
  { schedule: '0 5 * * 1', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const db = getDb();

    const aggSnap = await db.doc('config/aggregates').get();
    const agg = (aggSnap.data() ?? {}) as Record<string, unknown>;

    const lists = buildFeaturedLists(agg);

    for (const list of lists) {
      const listRef = db.doc(`sharedLists/${list.key}`);
      await listRef.set({
        ownerId: SYSTEM_OWNER,
        name: list.name,
        description: list.desc,
        isPublic: true,
        featured: true,
        itemCount: list.items.length,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Replace items: delete old, create new
      const oldItems = await db.collection('listItems')
        .where('listId', '==', list.key).get();
      const batch = db.batch();
      oldItems.docs.forEach((d) => batch.delete(d.ref));
      for (const bizId of list.items) {
        batch.set(db.doc(`listItems/${list.key}__${bizId}`), {
          listId: list.key,
          businessId: bizId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    logger.info(`Featured lists regenerated: ${lists.map((l) => `${l.key}(${l.items.length})`).join(', ')}`);
  },
);
