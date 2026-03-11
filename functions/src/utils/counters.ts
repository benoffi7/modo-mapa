import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

const COUNTERS_DOC = 'config/counters';

export async function incrementCounter(
  db: Firestore,
  field: string,
  delta: number,
): Promise<void> {
  await db.doc(COUNTERS_DOC).set(
    { [field]: FieldValue.increment(delta) },
    { merge: true },
  );
}

export async function trackWrite(
  db: Firestore,
  collectionName: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  await db.doc(COUNTERS_DOC).set(
    { dailyWrites: FieldValue.increment(1) },
    { merge: true },
  );

  await db.doc(`dailyMetrics/${today}`).set(
    { [`writesByCollection.${collectionName}`]: FieldValue.increment(1) },
    { merge: true },
  );
}

export async function trackDelete(
  db: Firestore,
  collectionName: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  await db.doc(COUNTERS_DOC).set(
    { dailyDeletes: FieldValue.increment(1) },
    { merge: true },
  );

  await db.doc(`dailyMetrics/${today}`).set(
    { [`deletesByCollection.${collectionName}`]: FieldValue.increment(1) },
    { merge: true },
  );
}
