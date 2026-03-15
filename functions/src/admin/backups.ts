import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { v1 } from '@google-cloud/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { captureException } from '../utils/sentry';
import { assertAdmin } from '../helpers/assertAdmin';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

// ── Constants ──────────────────────────────────────────────────────────

const PROJECT_DB = 'projects/modo-mapa-app/databases/(default)';
const BACKUP_BUCKET_NAME = 'modo-mapa-app-backups';
const BACKUP_PREFIX = `gs://${BACKUP_BUCKET_NAME}/backups/`;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ── Interfaces ─────────────────────────────────────────────────────────

interface BackupEntry {
  id: string;
  createdAt: string;
}

interface CreateBackupResponse {
  id: string;
  createdAt: string;
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
  backupId: string;
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

function maskEmail(email: string | undefined): string {
  if (!email) return '<no-email>';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const prefix = local.substring(0, Math.min(3, local.length));
  return `${prefix}***@${domain}`;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 5;
const RATE_LIMIT_COLLECTION = '_rateLimits';

async function checkRateLimit(uid: string): Promise<void> {
  const db = getFirestore();
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(`backup_${uid}`);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data() as { count: number; resetAt: number } | undefined;

    if (!data || now >= data.resetAt) {
      tx.set(docRef, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return;
    }

    const newCount = data.count + 1;
    if (newCount > RATE_LIMIT_MAX_CALLS) {
      throw new HttpsError('resource-exhausted', 'Demasiadas solicitudes. Intenta de nuevo en un minuto.');
    }

    tx.update(docRef, { count: newCount });
  });
}

function getBackupBucket() {
  return getStorage().bucket(BACKUP_BUCKET_NAME);
}

function handleError(err: unknown, message: string, context: Record<string, unknown> = {}): never {
  captureException(err);
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
  if (!/^[\w.-]+$/.test(backupId)) {
    throw new HttpsError('invalid-argument', 'backupId contiene caracteres invalidos');
  }
  return backupId;
}

function parseBackupPrefix(prefix: string): BackupEntry {
  const id = prefix.replace('backups/', '').replace(/\/$/, '');
  return {
    id,
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
  enforceAppCheck: !IS_EMULATOR,
}, async (request) => {
  assertAdmin(request.auth);
  await checkRateLimit(request.auth!.uid);

  const client = getFirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputUri = `${BACKUP_PREFIX}${timestamp}`;

  logger.info('Creating backup', { backupId: timestamp, user: maskEmail(request.auth?.token.email) });

  try {
    const [operation] = await client.exportDocuments({
      name: PROJECT_DB,
      outputUriPrefix: outputUri,
    });

    await operation.promise();

    logger.info('Backup created successfully', { backupId: timestamp });

    return {
      id: timestamp,
      createdAt: timestamp.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z'),
    };
  } catch (err) {
    handleError(err, 'Error al crear el backup', { backupId: timestamp });
  }
});

export const listBackups = onCall<ListBackupsRequest, Promise<ListBackupsResponse>>({
  timeoutSeconds: 60,
  memory: '256MiB',
  enforceAppCheck: !IS_EMULATOR,
}, async (request) => {
  assertAdmin(request.auth);
  await checkRateLimit(request.auth!.uid);

  const pageSize = clampPageSize(request.data?.pageSize);
  const pageToken = request.data?.pageToken;

  logger.info('Listing backups', {
    user: maskEmail(request.auth?.token.email),
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

    const allBackups = prefixes
      .map(parseBackupPrefix)
      .sort((a, b) => b.id.localeCompare(a.id));

    const totalCount = allBackups.length;

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

export const restoreBackup = onCall<RestoreBackupRequest, Promise<{ success: true; safetyBackupId: string }>>({
  timeoutSeconds: 300,
  memory: '256MiB',
  enforceAppCheck: !IS_EMULATOR,
}, async (request) => {
  assertAdmin(request.auth);
  await checkRateLimit(request.auth!.uid);

  const backupId = validateBackupId(request.data?.backupId);
  const backupUri = `${BACKUP_PREFIX}${backupId}`;

  logger.warn('Restoring backup', { backupId, user: maskEmail(request.auth?.token.email) });

  try {
    const client = getFirestoreAdminClient();

    // Pre-restore safety backup
    const safetyTimestamp = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const safetyUri = `${BACKUP_PREFIX}${safetyTimestamp}`;
    logger.info('Creating pre-restore safety backup', { safetyBackupId: safetyTimestamp });

    const [safetyOp] = await client.exportDocuments({
      name: PROJECT_DB,
      outputUriPrefix: safetyUri,
    });
    await safetyOp.promise();
    logger.info('Pre-restore safety backup created', { safetyBackupId: safetyTimestamp });

    // Proceed with restore
    const [operation] = await client.importDocuments({
      name: PROJECT_DB,
      inputUriPrefix: backupUri,
    });

    await operation.promise();

    logger.info('Backup restored successfully', { backupId });

    return { success: true as const, safetyBackupId: safetyTimestamp };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    handleError(err, 'Error al restaurar el backup', { backupId });
  }
});

export const deleteBackup = onCall<DeleteBackupRequest, Promise<{ success: true }>>({
  timeoutSeconds: 120,
  memory: '256MiB',
  enforceAppCheck: !IS_EMULATOR,
}, async (request) => {
  assertAdmin(request.auth);
  await checkRateLimit(request.auth!.uid);

  const backupId = validateBackupId(request.data?.backupId);

  logger.warn('Deleting backup', { backupId, user: maskEmail(request.auth?.token.email) });

  try {
    const bucket = getBackupBucket();
    const prefix = `backups/${backupId}/`;

    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      throw new HttpsError('not-found', 'Backup no encontrado');
    }

    await Promise.all(files.map((file) => file.delete()));

    logger.info('Backup deleted successfully', { backupId, filesDeleted: files.length });

    return { success: true as const };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    handleError(err, 'Error al eliminar el backup', { backupId });
  }
});
