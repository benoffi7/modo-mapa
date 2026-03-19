import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getStorage } from 'firebase-admin/storage';
import { captureException } from '../utils/sentry';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK } from '../helpers/env';

interface StorageStatsResponse {
  totalBytes: number;
  fileCount: number;
  updatedAt: string;
}

export const getStorageStats = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 60, memory: '256MiB' },
  async (request: CallableRequest): Promise<StorageStatsResponse> => {
    assertAdmin(request.auth);

    try {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix: 'menuPhotos/' });

      const totalBytes = files.reduce(
        (sum, file) => sum + Number(file.metadata.size ?? 0),
        0,
      );

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
