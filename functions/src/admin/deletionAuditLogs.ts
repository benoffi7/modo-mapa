import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';

// ── Types ─────────────────────────────────────────────────────────────

interface FetchRequest {
  pageSize?: number;
  startAfter?: string; // ISO timestamp
  type?: 'account_delete' | 'anonymous_clean';
  status?: 'success' | 'partial_failure' | 'failure';
  databaseId?: string;
}

interface AuditLogDoc {
  id: string;
  uidHash: string;
  type: 'account_delete' | 'anonymous_clean';
  status: 'success' | 'partial_failure' | 'failure';
  collectionsProcessed: number;
  collectionsFailed: string[];
  storageFilesDeleted: number;
  storageFilesFailed: number;
  aggregatesCorrected: boolean;
  durationMs: number;
  triggeredBy: 'user';
  timestamp: string;
}

interface FetchResponse {
  logs: AuditLogDoc[];
  hasMore: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// ── Cloud Function ────────────────────────────────────────────────────

export const fetchDeletionAuditLogs = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
  async (request: CallableRequest<FetchRequest>): Promise<FetchResponse> => {
    assertAdmin(request.auth);

    const data = request.data ?? {};
    const pageSize = Math.min(Math.max(data.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const db = getDb(data.databaseId);

    let q: FirebaseFirestore.Query = db.collection('deletionAuditLogs');

    if (data.type) {
      q = q.where('type', '==', data.type);
    }
    if (data.status) {
      q = q.where('status', '==', data.status);
    }

    q = q.orderBy('timestamp', 'desc');

    if (data.startAfter) {
      const startDate = new Date(data.startAfter);
      if (isNaN(startDate.getTime())) {
        throw new HttpsError('invalid-argument', 'Invalid startAfter timestamp');
      }
      q = q.startAfter(startDate);
    }

    // Fetch one extra to determine hasMore
    const snap = await q.limit(pageSize + 1).get();

    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const logs: AuditLogDoc[] = docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        uidHash: d.uidHash ?? '',
        type: d.type,
        status: d.status,
        collectionsProcessed: d.collectionsProcessed ?? 0,
        collectionsFailed: d.collectionsFailed ?? [],
        storageFilesDeleted: d.storageFilesDeleted ?? 0,
        storageFilesFailed: d.storageFilesFailed ?? 0,
        aggregatesCorrected: d.aggregatesCorrected ?? true,
        durationMs: d.durationMs ?? 0,
        triggeredBy: d.triggeredBy ?? 'user',
        timestamp: d.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      };
    });

    return { logs, hasMore };
  },
);
