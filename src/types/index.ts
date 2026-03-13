export interface Business {
  id: string;
  name: string;
  address: string;
  category: BusinessCategory;
  lat: number;
  lng: number;
  tags: string[];
  phone: string | null;
}

export type BusinessCategory =
  | 'restaurant'
  | 'cafe'
  | 'bakery'
  | 'bar'
  | 'fastfood'
  | 'icecream'
  | 'pizza';

export interface UserProfile {
  displayName: string;
  createdAt: Date;
}

export interface RatingCriteria {
  food?: number;      // 1-5
  service?: number;   // 1-5
  price?: number;     // 1-5
  ambiance?: number;  // 1-5
  speed?: number;     // 1-5
}

export type RatingCriterionId = keyof RatingCriteria;

export interface Rating {
  userId: string;
  businessId: string;
  score: number;
  criteria?: RatingCriteria;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  createdAt: Date;
  updatedAt?: Date;
  likeCount: number;
  flagged?: boolean;
  parentId?: string;
  replyCount?: number;
}

export interface CommentLike {
  userId: string;
  commentId: string;
  createdAt: Date;
}

export interface UserTag {
  userId: string;
  businessId: string;
  tagId: string;
  createdAt: Date;
}

export interface CustomTag {
  id: string;
  userId: string;
  businessId: string;
  label: string;
  createdAt: Date;
}

export interface Favorite {
  userId: string;
  businessId: string;
  createdAt: Date;
}

export type FeedbackCategory = 'bug' | 'sugerencia' | 'datos_usuario' | 'datos_comercio' | 'otro';

export interface Feedback {
  id: string;
  userId: string;
  message: string;
  category: FeedbackCategory;
  createdAt: Date;
  flagged?: boolean;
}

import { PREDEFINED_TAGS } from '../constants/tags';
import { PRICE_LEVEL_LABELS, CATEGORY_LABELS } from '../constants/business';

export { PREDEFINED_TAGS, PRICE_LEVEL_LABELS, CATEGORY_LABELS };

export type PredefinedTagId = (typeof PREDEFINED_TAGS)[number]['id'];

export type MenuPhotoStatus = 'pending' | 'approved' | 'rejected';

export interface MenuPhoto {
  id: string;
  userId: string;
  businessId: string;
  storagePath: string;
  thumbnailPath: string;
  status: MenuPhotoStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  reportCount: number;
}

export interface PriceLevel {
  userId: string;
  businessId: string;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking';

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


export interface UserRankingEntry {
  userId: string;
  displayName: string;
  score: number;
  breakdown: {
    comments: number;
    ratings: number;
    likes: number;
    tags: number;
    favorites: number;
    photos: number;
  };
}

export interface UserRanking {
  period: string;
  startDate: Date;
  endDate: Date;
  rankings: UserRankingEntry[];
  totalParticipants: number;
}

export interface UserSettings {
  profilePublic: boolean;
  notificationsEnabled: boolean;
  notifyLikes: boolean;
  notifyPhotos: boolean;
  notifyRankings: boolean;
  analyticsEnabled: boolean;
  updatedAt: Date;
}
