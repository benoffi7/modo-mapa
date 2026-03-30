export type FeedbackCategory = 'bug' | 'sugerencia' | 'datos_usuario' | 'datos_comercio' | 'otro';

export type FeedbackStatus = 'pending' | 'viewed' | 'responded' | 'resolved';

export interface Feedback {
  id: string;
  userId: string;
  message: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  createdAt: Date;
  flagged?: boolean;
  adminResponse?: string;
  respondedAt?: Date;
  respondedBy?: string;
  viewedByUser?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'pdf';
  githubIssueUrl?: string;
  businessId?: string;
  businessName?: string;
}
