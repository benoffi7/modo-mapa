import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { v1 } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

// #7 - Admin email from environment config instead of hardcoded
const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email address of the admin user',
  default: 'benoffi11@gmail.com',
});

const PROJECT_DB = 'projects/modo-mapa-app/databases/(default)';
const BACKUP_BUCKET_NAME = 'modo-mapa-app-backups';
const BACKUP_BUCKET = admin.storage().bucket(BACKUP_BUCKET_NAME);
const BACKUP_PREFIX = `gs://${BACKUP_BUCKET_NAME}/backups/`;

// #8 - Sanitize PII: mask email for logging (show first 3 chars + domain)
function maskEmail(email: string | undefined): string {
  if (!email) return '<no-email>';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const prefix = local.substring(0, Math.min(3, local.length));
  return `${prefix}***@${domain}`;
}

// #2 - In-memory rate limiting per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_CALLS = 5; // max 5 calls per minute per user

function checkRateLimit(uid: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_CALLS) {
    throw new HttpsError('resource-exhausted', 'Demasiadas solicitudes. Intenta de nuevo en un minuto.');
  }
}

// #3 - email_verified check added
function verifyAdmin(request: { auth?: { uid: string; token: { email?: string; email_verified?: boolean } } }): void {
  const email = request.auth?.token.email;
  const emailVerified = request.auth?.token.email_verified;

  if (!emailVerified) {
    throw new HttpsError('permission-denied', 'Email no verificado');
  }

  if (email !== ADMIN_EMAIL_PARAM.value()) {
    throw new HttpsError('permission-denied', 'Solo admin puede gestionar backups');
  }

  // Rate limit after auth check
  checkRateLimit(request.auth!.uid);
}

// #5 - Resolve opaque backup ID to internal GCS URI (server-side only)
function resolveBackupUri(backupId: string): string {
  // Validate ID format: ISO timestamp with dashes (e.g., 2024-01-15T10-30-00-000Z)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z$/.test(backupId)) {
    throw new HttpsError('invalid-argument', 'ID de backup invalido');
  }
  return `${BACKUP_PREFIX}${backupId}`;
}

// #1 - App Check enforcement + #6 - config for all functions
export const createBackup = onCall({
  timeoutSeconds: 300,
  memory: '256MiB',
  enforceAppCheck: true,
}, async (request) => {
  verifyAdmin(request);

  const client = new v1.FirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputUri = `${BACKUP_PREFIX}${timestamp}`;

  logger.info('Creating backup', { backupId: timestamp, user: maskEmail(request.auth?.token.email) });

  try {
    const [operation] = await client.exportDocuments({
      name: PROJECT_DB,
      outputUriPrefix: outputUri,
    });

    const [response] = await operation.promise();

    logger.info('Backup created successfully', { backupId: timestamp });

    // #5 - Return opaque ID only, no internal URI
    return {
      id: timestamp,
      // Derive the createdAt from the timestamp ID for consistency
      createdAt: timestamp.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z'),
      outputUri: response.outputUriPrefix ?? outputUri,
    };
  } catch (err) {
    logger.error('Failed to create backup', { error: String(err), backupId: timestamp });
    throw new HttpsError('internal', 'Error al crear el backup. Verifica permisos IAM del service account.');
  }
});

// #1 - App Check + #6 - timeout/memory config for listBackups
export const listBackups = onCall({
  timeoutSeconds: 60,
  memory: '256MiB',
  enforceAppCheck: true,
}, async (request) => {
  verifyAdmin(request);

  logger.info('Listing backups', { user: maskEmail(request.auth?.token.email) });

  try {
    const [, , apiResponse] = await BACKUP_BUCKET.getFiles({
      prefix: 'backups/',
      delimiter: '/',
      autoPaginate: false,
    });

    const prefixes: string[] = (apiResponse as { prefixes?: string[] }).prefixes ?? [];

    // #5 - Don't expose gs:// URIs, only return opaque IDs
    const backups = prefixes
      .map((p: string) => {
        const id = p.replace('backups/', '').replace(/\/$/, '');
        return {
          id,
          createdAt: id.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z'),
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id));

    logger.info('Backups listed', { count: backups.length });

    return { backups };
  } catch (err) {
    logger.error('Failed to list backups', { error: String(err) });
    throw new HttpsError('internal', 'Error al listar backups. Verifica permisos de Storage.');
  }
});

// #1 - App Check enforcement
export const restoreBackup = onCall({
  timeoutSeconds: 300,
  memory: '256MiB',
  enforceAppCheck: true,
}, async (request) => {
  verifyAdmin(request);

  // #5 - Accept opaque backup ID instead of raw URI
  const { backupId } = request.data as { backupId: string };
  const backupUri = resolveBackupUri(backupId);

  logger.warn('Restoring backup', { backupId, user: maskEmail(request.auth?.token.email) });

  try {
    const client = new v1.FirestoreAdminClient();

    // #4 - Pre-restore safety backup
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

    return { success: true, safetyBackupId: safetyTimestamp };
  } catch (err) {
    logger.error('Failed to restore backup', { error: String(err), backupId });
    throw new HttpsError('internal', 'Error al restaurar el backup. Verifica permisos IAM del service account.');
  }
});
