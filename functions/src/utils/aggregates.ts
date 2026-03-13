import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

const AGGREGATES_DOC = 'config/aggregates';

export async function incrementBusinessCount(
  db: Firestore,
  field: 'businessFavorites' | 'businessComments',
  businessId: string,
  delta: number,
): Promise<void> {
  await db.doc(AGGREGATES_DOC).set(
    { [`${field}.${businessId}`]: FieldValue.increment(delta) },
    { merge: true },
  );
}

export async function updateRatingAggregates(
  db: Firestore,
  businessId: string,
  action: 'add' | 'remove',
  score: number,
  oldScore?: number,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (action === 'add') {
    updates[`ratingDistribution.${score}`] = FieldValue.increment(1);
    updates[`businessRatingCount.${businessId}`] = FieldValue.increment(1);
    updates[`businessRatingSum.${businessId}`] = FieldValue.increment(score);
    if (oldScore !== undefined) {
      updates[`ratingDistribution.${oldScore}`] = FieldValue.increment(-1);
      updates[`businessRatingSum.${businessId}`] = FieldValue.increment(score - oldScore);
      // count stays the same for update
      delete updates[`businessRatingCount.${businessId}`];
    }
  } else {
    updates[`ratingDistribution.${score}`] = FieldValue.increment(-1);
    updates[`businessRatingCount.${businessId}`] = FieldValue.increment(-1);
    updates[`businessRatingSum.${businessId}`] = FieldValue.increment(-score);
  }

  await db.doc(AGGREGATES_DOC).set(updates, { merge: true });
}

export async function incrementTagCount(
  db: Firestore,
  tagId: string,
  delta: number,
): Promise<void> {
  await db.doc(AGGREGATES_DOC).set(
    { [`tagCounts.${tagId}`]: FieldValue.increment(delta) },
    { merge: true },
  );
}
