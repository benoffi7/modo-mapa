import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createNotification } from '../utils/notifications';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'benoffi11@gmail.com';
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const MAX_RESPONSE_LENGTH = 500;

export const respondToFeedback = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60 },
  async (request) => {
    const { auth } = request;
    if (!auth?.token.email_verified || auth.token.email !== ADMIN_EMAIL) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    const { feedbackId, response } = request.data;
    if (!feedbackId || typeof feedbackId !== 'string') {
      throw new HttpsError('invalid-argument', 'feedbackId required');
    }
    if (!response || typeof response !== 'string' || response.length < 1 || response.length > MAX_RESPONSE_LENGTH) {
      throw new HttpsError('invalid-argument', `response must be 1-${MAX_RESPONSE_LENGTH} chars`);
    }

    const db = getFirestore();
    const feedbackRef = db.collection('feedback').doc(feedbackId);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      throw new HttpsError('not-found', 'Feedback not found');
    }

    const data = feedbackSnap.data()!;

    await feedbackRef.update({
      status: 'responded',
      adminResponse: response,
      respondedAt: FieldValue.serverTimestamp(),
      respondedBy: auth.token.email,
    });

    await createNotification(db, {
      userId: data.userId as string,
      type: 'feedback_response',
      message: 'Tu feedback recibió una respuesta del equipo',
      referenceId: feedbackId,
    });

    return { success: true };
  },
);

export const resolveFeedback = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60 },
  async (request) => {
    const { auth } = request;
    if (!auth?.token.email_verified || auth.token.email !== ADMIN_EMAIL) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    const { feedbackId } = request.data;
    if (!feedbackId || typeof feedbackId !== 'string') {
      throw new HttpsError('invalid-argument', 'feedbackId required');
    }

    const db = getFirestore();
    const feedbackRef = db.collection('feedback').doc(feedbackId);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      throw new HttpsError('not-found', 'Feedback not found');
    }

    await feedbackRef.update({ status: 'resolved' });

    return { success: true };
  },
);
