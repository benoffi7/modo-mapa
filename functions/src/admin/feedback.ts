import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { createNotification } from '../utils/notifications';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email address of the admin user',
});
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const MAX_RESPONSE_LENGTH = 500;

const GITHUB_OWNER = defineString('GITHUB_OWNER', {
  description: 'GitHub repository owner',
});
const GITHUB_REPO = defineString('GITHUB_REPO', {
  description: 'GitHub repository name',
});

function assertAdmin(auth: { token: { email?: string; email_verified?: boolean } } | undefined): void {
  if (IS_EMULATOR) return; // Skip all auth checks in emulator
  if (!auth?.token.email_verified || auth?.token.email !== ADMIN_EMAIL_PARAM.value()) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
}

export const respondToFeedback = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request.auth);

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
      respondedBy: request.auth?.token.email ?? 'admin',
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
    assertAdmin(request.auth);

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

    const data = feedbackSnap.data()!;

    await feedbackRef.update({ status: 'resolved' });

    await createNotification(db, {
      userId: data.userId as string,
      type: 'feedback_response',
      message: 'Tu feedback fue marcado como resuelto',
      referenceId: feedbackId,
    });

    return { success: true };
  },
);

export const createGithubIssueFromFeedback = onCall(
  { enforceAppCheck: !IS_EMULATOR, timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request.auth);

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

    const data = feedbackSnap.data()!;

    if (data.githubIssueUrl) {
      throw new HttpsError('already-exists', 'GitHub issue already created');
    }

    const category = (data.category as string) ?? 'otro';
    const message = (data.message as string) ?? '';
    const createdAt = data.createdAt?.toDate?.() ?? new Date();
    const mediaUrl = data.mediaUrl as string | undefined;

    const title = `[Feedback/${category}] ${message.substring(0, 80)}`;
    const bodyParts = [
      `**Categoría:** ${category}`,
      `**Fecha:** ${createdAt.toISOString()}`,
      '',
      '**Mensaje:**',
      message,
    ];
    if (mediaUrl) {
      bodyParts.push('', `**Media:** ${mediaUrl}`);
    }
    bodyParts.push('', `---`, `Feedback ID: \`${feedbackId}\``);

    const labelMap: Record<string, string> = {
      bug: 'bug',
      sugerencia: 'enhancement',
    };
    const labels = [labelMap[category] ?? 'feedback'];

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new HttpsError('failed-precondition', 'GITHUB_TOKEN not configured');
    }
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });

    const { data: issue } = await octokit.issues.create({
      owner: GITHUB_OWNER.value(),
      repo: GITHUB_REPO.value(),
      title,
      body: bodyParts.join('\n'),
      labels,
    });

    await feedbackRef.update({ githubIssueUrl: issue.html_url });

    return { success: true, issueUrl: issue.html_url };
  },
);
