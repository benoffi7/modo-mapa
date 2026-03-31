import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import type { ConfigDocument, ActivityFeedDiagResponse } from '../../types/admin';

/** Known config document IDs */
export const CONFIG_DOC_IDS = [
  'counters',
  'moderation',
  'appVersion',
  'perfCounters',
  'aggregates',
  'analyticsCache',
] as const;

/** Fetch all known config documents */
export async function fetchConfigDocs(): Promise<ConfigDocument[]> {
  const results: ConfigDocument[] = [];

  for (const docId of CONFIG_DOC_IDS) {
    const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, docId));
    if (snap.exists()) {
      results.push({ id: docId, data: snap.data() as Record<string, unknown> });
    }
  }

  return results;
}

/** Fetch a single config document */
export async function fetchConfigDoc(docId: string): Promise<ConfigDocument | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, docId));
  if (!snap.exists()) return null;
  return { id: docId, data: snap.data() as Record<string, unknown> };
}

/** Update moderation banned words via callable */
export async function updateModerationBannedWords(words: string[]): Promise<void> {
  const func = httpsCallable<{ bannedWords: string[] }>(functions, 'updateModerationConfig');
  await func({ bannedWords: words });
}

/** Fetch activity feed diagnostic via callable */
export async function fetchActivityFeedDiag(userId: string): Promise<ActivityFeedDiagResponse> {
  const func = httpsCallable<{ userId: string }, ActivityFeedDiagResponse>(
    functions,
    'getActivityFeedDiag',
  );
  const result = await func({ userId });
  return result.data;
}
