export type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response' | 'comment_reply' | 'new_follower' | 'recommendation';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId?: string | undefined;
  actorName?: string | undefined;
  businessId?: string | undefined;
  businessName?: string | undefined;
  referenceId?: string | undefined;
  message: string;
  read: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface DigestGroup {
  type: AppNotification['type'];
  count: number;
  label: string;
  icon: string;
  latestAt: Date;
  notifications: AppNotification[];
}
