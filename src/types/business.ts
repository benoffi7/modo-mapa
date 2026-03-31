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

export interface PriceLevel {
  userId: string;
  businessId: string;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

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
