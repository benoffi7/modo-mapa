import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers';
  collection: string;
  detail: string;
}

const SEVERITY_MAP: Record<AbuseLogEntry['type'], 'low' | 'medium' | 'high'> = {
  rate_limit: 'low',
  top_writers: 'medium',
  flagged: 'high',
};

export async function logAbuse(
  db: Firestore,
  entry: AbuseLogEntry,
): Promise<void> {
  await db.collection('abuseLogs').add({
    ...entry,
    severity: SEVERITY_MAP[entry.type] ?? 'low',
    timestamp: FieldValue.serverTimestamp(),
  });
}
