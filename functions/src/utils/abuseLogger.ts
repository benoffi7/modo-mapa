import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export interface AbuseLogEntry {
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood';
  collection?: string;
  detail: string;
  severity?: 'low' | 'medium' | 'high';
}

const SEVERITY_MAP: Record<AbuseLogEntry['type'], 'low' | 'medium' | 'high'> = {
  rate_limit: 'low',
  top_writers: 'medium',
  flagged: 'high',
  recipient_flood: 'medium',
};

export async function logAbuse(
  db: Firestore,
  entry: AbuseLogEntry,
): Promise<void> {
  await db.collection('abuseLogs').add({
    ...entry,
    severity: entry.severity ?? SEVERITY_MAP[entry.type] ?? 'low',
    timestamp: FieldValue.serverTimestamp(),
  });
}
