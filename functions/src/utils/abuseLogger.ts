import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers';
  collection: string;
  detail: string;
}

export async function logAbuse(
  db: Firestore,
  entry: AbuseLogEntry,
): Promise<void> {
  await db.collection('abuseLogs').add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
}
