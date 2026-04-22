import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { BackupEntry } from '../../types/admin';

// ── Internal types ─────────────────────────────────────────────────────

interface ListBackupsRequest {
  pageSize?: number;
  pageToken?: string;
}

export interface ListBackupsResponse {
  backups: BackupEntry[];
  nextPageToken: string | null;
  totalCount: number;
}

interface CreateBackupResponse {
  id: string;
  createdAt: string;
}

interface RestoreBackupRequest {
  backupId: string;
}

interface DeleteBackupRequest {
  backupId: string;
}

interface SuccessResponse {
  success: true;
}

// ── Service functions ──────────────────────────────────────────────────

/**
 * List backups with optional pagination.
 */
export async function listBackups(
  pageSize: number,
  pageToken?: string
): Promise<ListBackupsResponse> {
  const func = httpsCallable<ListBackupsRequest, ListBackupsResponse>(functions, 'listBackups');
  const request: ListBackupsRequest = { pageSize };
  if (pageToken != null) request.pageToken = pageToken;
  const result = await func(request);
  return result.data;
}

/**
 * Create a new backup.
 */
export async function createBackup(): Promise<CreateBackupResponse> {
  const func = httpsCallable<unknown, CreateBackupResponse>(functions, 'createBackup');
  const result = await func({});
  return result.data;
}

/**
 * Restore a backup by ID.
 */
export async function restoreBackup(backupId: string): Promise<void> {
  const func = httpsCallable<RestoreBackupRequest, SuccessResponse>(functions, 'restoreBackup');
  await func({ backupId });
}

/**
 * Delete a backup by ID.
 */
export async function deleteBackup(backupId: string): Promise<void> {
  const func = httpsCallable<DeleteBackupRequest, SuccessResponse>(functions, 'deleteBackup');
  await func({ backupId });
}
