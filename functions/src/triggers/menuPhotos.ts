import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getDb } from '../helpers/env';
import sharp from 'sharp';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onMenuPhotoCreated = onDocumentCreated(
  'menuPhotos/{photoId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const photoId = event.params.photoId;
    const db = getDb();

    // Generate thumbnail
    try {
      const bucket = getStorage().bucket();
      const originalFile = bucket.file(data.storagePath);
      const [buffer] = await originalFile.download();

      const thumbBuffer = await sharp(buffer)
        .resize(400)
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbPath = `menus/${data.businessId}/${photoId}_thumb.jpg`;
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
  },
);
