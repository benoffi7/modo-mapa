import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { v1 } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

const ADMIN_EMAIL = 'benoffi11@gmail.com';
const PROJECT_DB = 'projects/modo-mapa-app/databases/(default)';
const BUCKET_NAME = 'modo-mapa-app.firebasestorage.app';
const BACKUP_PREFIX = `gs://${BUCKET_NAME}/backups/`;

function verifyAdmin(email: string | undefined): void {
  if (email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Solo admin puede gestionar backups');
  }
}

export const createBackup = onCall({
  timeoutSeconds: 300,
  memory: '256MiB',
}, async (request) => {
  verifyAdmin(request.auth?.token.email);

  const client = new v1.FirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputUri = `${BACKUP_PREFIX}${timestamp}`;

  const [operation] = await client.exportDocuments({
    name: PROJECT_DB,
    outputUriPrefix: outputUri,
  });

  const [response] = await operation.promise();

  return {
    id: timestamp,
    outputUri: response.outputUriPrefix ?? outputUri,
  };
});

export const listBackups = onCall(async (request) => {
  verifyAdmin(request.auth?.token.email);

  const storage = new Storage();
  const bucket = storage.bucket(BUCKET_NAME);

  const [, , apiResponse] = await bucket.getFiles({
    prefix: 'backups/',
    delimiter: '/',
    autoPaginate: false,
  });

  const prefixes: string[] = (apiResponse as { prefixes?: string[] }).prefixes ?? [];

  const backups = prefixes
    .map((p: string) => {
      const id = p.replace('backups/', '').replace(/\/$/, '');
      return {
        id,
        uri: `${BACKUP_PREFIX}${id}`,
        createdAt: id.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z'),
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));

  return { backups };
});

export const restoreBackup = onCall({
  timeoutSeconds: 300,
  memory: '256MiB',
}, async (request) => {
  verifyAdmin(request.auth?.token.email);

  const { backupUri } = request.data as { backupUri: string };
  if (!backupUri?.startsWith(BACKUP_PREFIX)) {
    throw new HttpsError('invalid-argument', 'URI de backup invalido');
  }

  const client = new v1.FirestoreAdminClient();
  const [operation] = await client.importDocuments({
    name: PROJECT_DB,
    inputUriPrefix: backupUri,
  });

  await operation.promise();

  return { success: true };
});
