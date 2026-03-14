import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export const respondToFeedback = httpsCallable<{ feedbackId: string; response: string }, void>(functions, 'respondToFeedback');
export const resolveFeedback = httpsCallable<{ feedbackId: string }, void>(functions, 'resolveFeedback');
export const createGithubIssueFromFeedback = httpsCallable<{ feedbackId: string }, { issueUrl: string }>(functions, 'createGithubIssueFromFeedback');
