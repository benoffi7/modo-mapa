import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getDb } from '../helpers/env';
import sharp from 'sharp';
import { incrementCounter, trackWrite } from '../utils/counters';
import { checkRateLimit } from '../utils/rateLimiter';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

// Regex for valid storagePath: menus/{userId}/{bizId}/{fileName}
const STORAGE_PATH_REGEX = /^menus\/[a-zA-Z0-9]+\/biz_\d{1,6}\/[a-zA-Z0-9_-]+$/;

export const onMenuPhotoCreated = onDocumentCreated(
  'menuPhotos/{photoId}',
  async (event) => {
    const startMs = performance.now();
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const photoId = event.params.photoId;
    const db = getDb();
    const userId = data.userId as string;
    const storagePath = data.storagePath as string;
    const businessId = data.businessId as string;

    // Validate storagePath format (defense in depth — rules also validate)
    if (!storagePath || !STORAGE_PATH_REGEX.test(storagePath)) {
      await snap.ref.update({ status: 'rejected', rejectionReason: 'invalid_storage_path' });
      await logAbuse(db, { userId, type: 'invalid_input', collection: 'menuPhotos', detail: `Invalid storagePath: ${storagePath}` });
      return;
    }

    // Validate userId in path matches document userId
    const pathSegments = storagePath.split('/');
    if (pathSegments[1] !== userId) {
      await snap.ref.update({ status: 'rejected', rejectionReason: 'storage_path_user_mismatch' });
      await logAbuse(db, { userId, type: 'invalid_input', collection: 'menuPhotos', detail: `storagePath userId mismatch: path=${pathSegments[1]}, doc=${userId}` });
      return;
    }

    // Validate businessId in path matches document businessId
    if (pathSegments[2] !== businessId) {
      await snap.ref.update({ status: 'rejected', rejectionReason: 'storage_path_business_mismatch' });
      await logAbuse(db, { userId, type: 'invalid_input', collection: 'menuPhotos', detail: `storagePath businessId mismatch: path=${pathSegments[2]}, doc=${businessId}` });
      return;
    }

    // Rate limit: 10 menuPhotos per day per user
    // Trigger runs as admin SDK — delete bypasses client-facing rules
    const exceeded = await checkRateLimit(
      db,
      { collection: 'menuPhotos', limit: 10, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'menuPhotos',
        detail: 'Exceeded 10 menuPhotos/day',
      });
      return;
    }

    // Generate thumbnail
    try {
      const bucket = getStorage().bucket();
      const originalFile = bucket.file(data.storagePath);
      const [buffer] = await originalFile.download();

      const thumbBuffer = await sharp(buffer)
        .resize(400)
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbPath = `menus/${data.userId}/${data.businessId}/${photoId}_thumb.jpg`;
      const thumbFile = bucket.file(thumbPath);
      await thumbFile.save(thumbBuffer, {
        metadata: { contentType: 'image/jpeg' },
      });

      // Update doc with thumbnail path
      await snap.ref.update({ thumbnailPath: thumbPath });
    } catch (err) {
      console.error('Failed to generate thumbnail:', err);
    }

    // Counters
    await incrementCounter(db, 'menuPhotos', 1);
    await trackWrite(db, 'menuPhotos');
    await trackFunctionTiming('onMenuPhotoCreated', startMs);
  },
);
