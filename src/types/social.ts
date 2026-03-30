export interface Follow {
  followerId: string;
  followedId: string;
  createdAt: Date;
}

export type ActivityType = 'rating' | 'comment' | 'favorite';

export interface ActivityFeedItem {
  id: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  businessId: string;
  businessName: string;
  referenceId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface Recommendation {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  businessId: string;
  businessName: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Favorite {
  userId: string;
  businessId: string;
  createdAt: Date;
}
