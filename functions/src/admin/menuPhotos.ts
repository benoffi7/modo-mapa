import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createNotification } from '../utils/notifications';
import { assertAdmin } from '../helpers/assertAdmin';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

export const approveMenuPhoto = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request.auth);

    const { photoId } = request.data;
    if (!photoId || typeof photoId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoId required');
    }

    const db = getFirestore();
    const photoRef = db.collection('menuPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) {
      throw new HttpsError('not-found', 'Photo not found');
    }

    const data = photoSnap.data()!;
    if (data.status !== 'pending' && data.status !== 'rejected') {
      throw new HttpsError('failed-precondition', 'Photo must be pending or rejected');
    }

    // Mark any existing approved photo for this business as replaced
    const existingApproved = await db.collection('menuPhotos')
      .where('businessId', '==', data.businessId)
      .where('status', '==', 'approved')
      .get();

    const batch = db.batch();
    for (const doc of existingApproved.docs) {
      batch.update(doc.ref, { status: 'replaced' });
    }

    // Approve the new photo
    batch.update(photoRef, {
      status: 'approved',
      reviewedBy: request.auth!.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Notify photo uploader
    const businessName = data.businessName as string | undefined;
    await createNotification(db, {
      userId: data.userId as string,
      type: 'photo_approved',
      message: businessName
        ? `Tu foto del menú de ${businessName} fue aprobada`
        : 'Tu foto del menú fue aprobada',
      businessId: data.businessId as string,
      referenceId: photoId,
    });

    return { success: true };
  },
);

export const rejectMenuPhoto = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request.auth);

    const { photoId, reason } = request.data;
    if (!photoId || typeof photoId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoId required');
    }

    const db = getFirestore();
    const photoRef = db.collection('menuPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) {
      throw new HttpsError('not-found', 'Photo not found');
    }

    const data = photoSnap.data()!;

    await photoRef.update({
      status: 'rejected',
      rejectionReason: reason || '',
      reviewedBy: request.auth!.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    // Notify photo uploader
    const rejectionMsg = reason
      ? `Tu foto del menú fue rechazada: ${reason}`
      : 'Tu foto del menú fue rechazada';
    await createNotification(db, {
      userId: data.userId as string,
      type: 'photo_rejected',
      message: rejectionMsg,
      businessId: data.businessId as string,
      referenceId: photoId,
    });

    return { success: true };
  },
);

export const deleteMenuPhoto = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request.auth);

    const { photoId } = request.data;
    if (!photoId || typeof photoId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoId required');
    }

    const db = getFirestore();
    const photoRef = db.collection('menuPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) {
      throw new HttpsError('not-found', 'Photo not found');
    }

    const data = photoSnap.data()!;

    // Delete files from Storage
    const bucket = getStorage().bucket();
    const filesToDelete = [data.storagePath, data.thumbnailPath].filter(Boolean);
    await Promise.allSettled(
      filesToDelete.map((path: string) => bucket.file(path).delete().catch(() => {})),
    );

    // Delete Firestore doc
    await photoRef.delete();
    return { success: true };
  },
);

/**
 * Any authenticated user can report an approved photo (once per user).
 * Increments reportCount. Uses a subcollection to prevent duplicate reports.
 */
export const reportMenuPhoto = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 30 },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { photoId } = request.data;
    if (!photoId || typeof photoId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoId required');
    }

    const db = getFirestore();
    const photoRef = db.collection('menuPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists) {
      throw new HttpsError('not-found', 'Photo not found');
    }

    const data = photoSnap.data()!;
    if (data.status !== 'approved') {
      throw new HttpsError('failed-precondition', 'Only approved photos can be reported');
    }

    // Prevent duplicate reports using a subcollection
    const reportRef = photoRef.collection('reports').doc(auth.uid);
    const reportSnap = await reportRef.get();
    if (reportSnap.exists) {
      throw new HttpsError('already-exists', 'Ya reportaste esta foto');
    }

    await reportRef.set({ createdAt: FieldValue.serverTimestamp() });
    await photoRef.update({ reportCount: FieldValue.increment(1) });

    return { success: true };
  },
);
