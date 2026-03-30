export interface UserProfile {
  displayName: string;
  avatarId?: string | undefined;
  createdAt: Date;
}

export type DigestFrequency = 'realtime' | 'daily' | 'weekly';

export interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  notifyFeedback: boolean;
  notifyReplies: boolean;
  notifyFollowers: boolean;
  notifyRecommendations: boolean;
  notificationDigest?: DigestFrequency;
  analyticsEnabled: boolean;
  locality?: string;
  localityLat?: number;
  localityLng?: number;
  followedTags?: string[];
  followedTagsUpdatedAt?: Date;
  followedTagsLastSeenAt?: Date;
  updatedAt: Date;
}

export interface CheckIn {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  createdAt: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

// Verification badges (#201)
export type VerificationBadgeId = 'local_guide' | 'verified_visitor' | 'trusted_reviewer';

export interface VerificationBadge {
  id: VerificationBadgeId;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: number;     // 0-100
  current: number;
  target: number;
}
