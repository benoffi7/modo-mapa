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
  avatarId?: string | undefined;
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
  type?: 'comment' | 'question';
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

export interface SharedList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  editorIds: string[];
  itemCount: number;
  icon?: string | undefined;
  color?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListItem {
  id: string;
  listId: string;
  businessId: string;
  addedBy: string;
  createdAt: Date;
}

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

import { PREDEFINED_TAGS } from '../constants/tags';

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
  /** Consecutive days with activity (computed by Cloud Function, optional) */
  streak?: number;
}

export interface UserRanking {
  period: string;
  startDate: Date;
  endDate: Date;
  rankings: UserRankingEntry[];
  totalParticipants: number;
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

export interface DigestGroup {
  type: AppNotification['type'];
  count: number;
  label: string;
  icon: string;
  latestAt: Date;
  notifications: AppNotification[];
}

export interface InterestFeedItem {
  business: Business;
  matchingTags: string[];
  isNew: boolean;
}

export interface InterestFeedGroup {
  tag: string;
  businesses: InterestFeedItem[];
  newCount: number;
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

export type SuggestionReason = 'category' | 'tags' | 'nearby';

export interface SuggestedBusiness {
  business: Business;
  score: number;
  reasons: SuggestionReason[];
}

export interface TrendingBusinessBreakdown {
  ratings: number;
  comments: number;
  userTags: number;
  priceLevels: number;
  listItems: number;
}

export interface TrendingBusiness {
  businessId: string;
  name: string;
  category: string;
  score: number;
  breakdown: TrendingBusinessBreakdown;
  rank: number;
}

export interface TrendingData {
  businesses: TrendingBusiness[];
  computedAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

// Tab navigation (#158)
export type TabId = 'inicio' | 'social' | 'buscar' | 'listas' | 'perfil';
export const ALL_TAB_IDS: TabId[] = ['inicio', 'social', 'buscar', 'listas', 'perfil'];
export type SocialSubTab = 'actividad' | 'seguidos' | 'recomendaciones' | 'rankings';
export type ListsSubTab = 'favoritos' | 'listas' | 'recientes' | 'colaborativas';
export type SearchViewMode = 'map' | 'list';

export type LocationSource = 'gps' | 'locality' | 'office';

export interface LocalTrendingResult {
  businesses: TrendingBusiness[];
  source: LocationSource;
  localityName: string | null;
  radiusKm: number;
}

export type {
  OfflineAction,
  OfflineActionType,
  OfflineActionStatus,
  OfflineActionPayload,
  RatingUpsertPayload,
  RatingDeletePayload,
  CommentCreatePayload,
  FavoriteTogglePayload,
  PriceLevelUpsertPayload,
  PriceLevelDeletePayload,
  TagTogglePayload,
  CommentLikePayload,
  FollowPayload,
  RecommendationPayload,
  EmptyPayload,
} from './offline';

export type { Special, AchievementCondition, Achievement } from './admin';

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
