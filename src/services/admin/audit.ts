import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { DeletionAuditLogEntry } from '../../types/admin';

export interface FetchAuditLogsParams {
  pageSize?: number;
  startAfter?: string; // ISO timestamp
  type?: 'account_delete' | 'anonymous_clean';
  status?: 'success' | 'partial_failure' | 'failure';
}

export interface FetchAuditLogsResponse {
  logs: DeletionAuditLogEntry[];
  hasMore: boolean;
}

interface RawAuditLog {
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

interface RawResponse {
  logs: RawAuditLog[];
  hasMore: boolean;
}

export async function fetchDeletionAuditLogs(
  params?: FetchAuditLogsParams,
): Promise<FetchAuditLogsResponse> {
  const fn = httpsCallable<FetchAuditLogsParams | undefined, RawResponse>(
    functions,
    'fetchDeletionAuditLogs',
  );
  const { data } = await fn(params);

  return {
    logs: data.logs.map((log) => ({
      ...log,
      timestamp: new Date(log.timestamp),
    })),
    hasMore: data.hasMore,
  };
}
