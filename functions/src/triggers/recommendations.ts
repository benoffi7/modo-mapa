import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite } from '../utils/counters';
import { createNotification } from '../utils/notifications';
import { logAbuse } from '../utils/abuseLogger';

export const onRecommendationCreated = onDocumentCreated(
  'recommendations/{docId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const senderId = data.senderId as string;
    const recipientId = data.recipientId as string;
    const businessName = data.businessName as string;
    const senderName = data.senderName as string;
    const message = (data.message as string) || '';

    // Self-recommend guard
    if (senderId === recipientId) {
      await snap.ref.delete();
      return;
    }

    // Rate limit: 20 recommendations per day per sender
    const exceeded = await checkRateLimit(
      db,
      { collection: 'recommendations', limit: 20, windowType: 'daily' },
      senderId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId: senderId,
        type: 'rate_limit',
        collection: 'recommendations',
        detail: 'Exceeded 20 recommendations/day',
      });
      return;
    }

    // Moderate message content
    if (message) {
      const flagged = await checkModeration(db, message);
      if (flagged) {
        await snap.ref.delete();
        await logAbuse(db, {
          userId: senderId,
          type: 'flagged',
          collection: 'recommendations',
          detail: `Flagged recommendation message: "${message.slice(0, 100)}"`,
        });
        return;
      }
    }

    // Create notification for recipient
    await createNotification(db, {
      userId: recipientId,
      type: 'recommendation',
      message: `${senderName} te recomienda ${businessName}`,
      actorId: senderId,
      actorName: senderName,
      businessId: data.businessId as string,
      businessName,
      referenceId: event.params.docId,
    });

    await incrementCounter(db, 'recommendations', 1);
    await trackWrite(db, 'recommendations');
  },
);
