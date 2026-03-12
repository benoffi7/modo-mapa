import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { v1 } from '@google-cloud/firestore';
import { getStorage } from 'firebase-admin/storage';

// ── Constants ──────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'benoffi11@gmail.com';
const PROJECT_DB = 'projects/modo-mapa-app/databases/(default)';
const BACKUP_BUCKET_NAME = 'modo-mapa-app-backups';
const BACKUP_PREFIX = `gs://${BACKUP_BUCKET_NAME}/backups/`;

// Maximum backups returned per page
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ── Interfaces ─────────────────────────────────────────────────────────
interface BackupEntry {
  id: string;
  uri: string;
  createdAt: string;
}

interface CreateBackupResponse {
  id: string;
  outputUri: string;
}

interface ListBackupsRequest {
  pageSize?: number;
  pageToken?: string;
}

interface ListBackupsResponse {
  backups: BackupEntry[];
  nextPageToken: string | null;
  totalCount: number;
}

interface RestoreBackupRequest {
  backupUri: string;
}

interface DeleteBackupRequest {
  backupId: string;
}

// ── Singleton for FirestoreAdminClient ─────────────────────────────────
type FirestoreAdminClient = InstanceType<typeof v1.FirestoreAdminClient>;
let firestoreAdminClient: FirestoreAdminClient | null = null;

function getFirestoreAdminClient(): FirestoreAdminClient {
  if (!firestoreAdminClient) {
    firestoreAdminClient = new v1.FirestoreAdminClient();
  }
  return firestoreAdminClient;
}

// ── Helpers ────────────────────────────────────────────────────────────

function verifyAdmin(request: CallableRequest): void {
  const email = request.auth?.token.email;
  if (email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Solo admin puede gestionar backups');
  }
}

function getBackupBucket() {
  return getStorage().bucket(BACKUP_BUCKET_NAME);
}

function handleError(err: unknown, message: string, context: Record<string, unknown> = {}): never {
  logger.error(message, { error: String(err), ...context });

  const errorStr = String(err);
  if (errorStr.includes('PERMISSION_DENIED') || errorStr.includes('permission')) {
    throw new HttpsError('permission-denied', `${message}. Verifica permisos IAM del service account.`);
  }
  if (errorStr.includes('NOT_FOUND') || errorStr.includes('not found')) {
    throw new HttpsError('not-found', `${message}. Recurso no encontrado.`);
  }
  throw new HttpsError('internal', `${message}. Verifica permisos IAM del service account.`);
}

function validateBackupId(backupId: unknown): string {
  if (typeof backupId !== 'string' || backupId.length === 0) {
    throw new HttpsError('invalid-argument', 'backupId es requerido y debe ser un string');
  }
  // Only allow safe characters: digits, letters, dashes, underscores, dots
  if (!/^[\w.-]+$/.test(backupId)) {
    throw new HttpsError('invalid-argument', 'backupId contiene caracteres invalidos');
  }
  return backupId;
}

function parseBackupPrefix(prefix: string): BackupEntry {
  const id = prefix.replace('backups/', '').replace(/\/$/, '');
  return {
    id,
    uri: `${BACKUP_PREFIX}${id}`,
    createdAt: id.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z'),
  };
}

function clampPageSize(requested: unknown): number {
  const n = typeof requested === 'number' ? requested : DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(n, MAX_PAGE_SIZE));
}

// ── Cloud Functions ────────────────────────────────────────────────────

export const createBackup = onCall<unknown, Promise<CreateBackupResponse>>({
  timeoutSeconds: 300,
  memory: '256MiB',
}, async (request) => {
  verifyAdmin(request);

  const client = getFirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputUri = `${BACKUP_PREFIX}${timestamp}`;

  logger.info('Creating backup', { outputUri, user: request.auth?.token.email });

  try {
    const [operation] = await client.exportDocuments({
      name: PROJECT_DB,
      outputUriPrefix: outputUri,
    });

    const [response] = await operation.promise();

    logger.info('Backup created successfully', { outputUri: response.outputUriPrefix });

    return {
      id: timestamp,
      outputUri: response.outputUriPrefix ?? outputUri,
    };
  } catch (err) {
    handleError(err, 'Error al crear el backup', { outputUri });
  }
});

export const listBackups = onCall<ListBackupsRequest, Promise<ListBackupsResponse>>({
  timeoutSeconds: 60,
  memory: '256MiB',
}, async (request) => {
  verifyAdmin(request);

  const pageSize = clampPageSize(request.data?.pageSize);
  const pageToken = request.data?.pageToken;

  logger.info('Listing backups', {
    user: request.auth?.token.email,
    bucket: BACKUP_BUCKET_NAME,
    pageSize,
    pageToken: pageToken ?? null,
  });

  try {
    const bucket = getBackupBucket();
    const [, , apiResponse] = await bucket.getFiles({
      prefix: 'backups/',
      delimiter: '/',
      autoPaginate: false,
    });

    const prefixes: string[] = (apiResponse as { prefixes?: string[] }).prefixes ?? [];

    // Sort descending (newest first)
    const allBackups = prefixes
      .map(parseBackupPrefix)
      .sort((a, b) => b.id.localeCompare(a.id));

    const totalCount = allBackups.length;

    // Apply pagination
    let startIndex = 0;
    if (pageToken) {
      const tokenIndex = allBackups.findIndex((b) => b.id === pageToken);
      if (tokenIndex >= 0) {
        startIndex = tokenIndex;
      }
    }

    const page = allBackups.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < totalCount;
    const nextPageToken = hasMore ? allBackups[startIndex + pageSize].id : null;

    logger.info('Backups listed', { count: page.length, totalCount });

    return { backups: page, nextPageToken, totalCount };
  } catch (err) {
    handleError(err, 'Error al listar backups');
  }
});

export const restoreBackup = onCall<RestoreBackupRequest, Promise<{ success: true }>>({
  timeoutSeconds: 300,
  memory: '256MiB',
}, async (request) => {
  verifyAdmin(request);

  const backupUri = typeof request.data?.backupUri === 'string' ? request.data.backupUri : '';
  if (!backupUri.startsWith(BACKUP_PREFIX)) {
    throw new HttpsError('invalid-argument', 'URI de backup invalido');
  }

  logger.warn('Restoring backup', { backupUri, user: request.auth?.token.email });

  try {
    const client = getFirestoreAdminClient();
    const [operation] = await client.importDocuments({
      name: PROJECT_DB,
      inputUriPrefix: backupUri,
    });

    await operation.promise();

    logger.info('Backup restored successfully', { backupUri });

    return { success: true as const };
  } catch (err) {
    handleError(err, 'Error al restaurar el backup', { backupUri });
  }
});

export const deleteBackup = onCall<DeleteBackupRequest, Promise<{ success: true }>>({
  timeoutSeconds: 120,
  memory: '256MiB',
}, async (request) => {
  verifyAdmin(request);

  const backupId = validateBackupId(request.data?.backupId);

  logger.warn('Deleting backup', { backupId, user: request.auth?.token.email });

  try {
    const bucket = getBackupBucket();
    const prefix = `backups/${backupId}/`;

    // List all files under the backup prefix
    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      throw new HttpsError('not-found', 'Backup no encontrado');
    }

    // Delete all files in parallel
    await Promise.all(files.map((file) => file.delete()));

    logger.info('Backup deleted successfully', { backupId, filesDeleted: files.length });

    return { success: true as const };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    handleError(err, 'Error al eliminar el backup', { backupId });
  }
});
