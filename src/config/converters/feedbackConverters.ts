import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '../../types';
import { toDate } from '../../utils/formatDate';

export const feedbackConverter: FirestoreDataConverter<Feedback> = {
  toFirestore(fb: Feedback) {
    return {
      userId: fb.userId,
      message: fb.message,
      category: fb.category,
      status: fb.status,
      createdAt: fb.createdAt,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Feedback {
    const d = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: d.userId,
      message: d.message ?? '',
      category: (d.category as FeedbackCategory) ?? 'otro',
      status: (d.status as FeedbackStatus) ?? 'pending',
      createdAt: toDate(d.createdAt),
      ...(d.flagged === true ? { flagged: true } : {}),
      ...(d.adminResponse != null && { adminResponse: d.adminResponse as string }),
      ...(d.respondedAt != null && { respondedAt: toDate(d.respondedAt) }),
      ...(d.respondedBy != null && { respondedBy: d.respondedBy as string }),
      ...(d.viewedByUser === true && { viewedByUser: true }),
      ...(d.mediaUrl != null && { mediaUrl: d.mediaUrl as string }),
      ...(d.mediaType != null && { mediaType: d.mediaType as 'image' | 'pdf' }),
      ...(d.githubIssueUrl != null && { githubIssueUrl: d.githubIssueUrl as string }),
      ...(d.businessId != null && { businessId: d.businessId as string }),
      ...(d.businessName != null && { businessName: d.businessName as string }),
    };
  },
};
