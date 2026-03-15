import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { getStorage } from 'firebase-admin/storage';
import { captureException } from '../utils/sentry';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email address of the admin user',
});

interface StorageStatsResponse {
  totalBytes: number;
  fileCount: number;
  updatedAt: string;
}

function verifyAdmin(request: CallableRequest): void {
  const email = request.auth?.token.email;
  const emailVerified = request.auth?.token.email_verified;

  if (!emailVerified) {
    throw new HttpsError('permission-denied', 'Email no verificado');
  }

  if (email !== ADMIN_EMAIL_PARAM.value()) {
    throw new HttpsError('permission-denied', 'Solo admin puede ver storage stats');
  }
}

export const getStorageStats = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60, memory: '256MiB' },
  async (request: CallableRequest): Promise<StorageStatsResponse> => {
    verifyAdmin(request);

    try {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix: 'menuPhotos/' });

      let totalBytes = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalBytes += Number(metadata.size ?? 0);
      }

      return {
        totalBytes,
        fileCount: files.length,
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      captureException(err);
      logger.error('Error fetching storage stats', { error: String(err) });
      throw new HttpsError('internal', 'Error obteniendo estadísticas de storage');
    }
  },
);
