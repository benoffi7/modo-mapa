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

export interface Rating {
  userId: string;
  businessId: string;
  score: number;
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

export type FeedbackCategory = 'bug' | 'sugerencia' | 'otro';

export interface Feedback {
  id: string;
  userId: string;
  message: string;
  category: FeedbackCategory;
  createdAt: Date;
  flagged?: boolean;
}

export const PREDEFINED_TAGS = [
  { id: 'barato', label: 'Barato', icon: 'AttachMoney' },
  { id: 'apto_celiacos', label: 'Apto celíacos', icon: 'NoFood' },
  { id: 'apto_veganos', label: 'Apto veganos', icon: 'Eco' },
  { id: 'rapido', label: 'Rápido', icon: 'Speed' },
  { id: 'delivery', label: 'Delivery', icon: 'DeliveryDining' },
  { id: 'buena_atencion', label: 'Buena atención', icon: 'ThumbUp' },
] as const;

export type PredefinedTagId = (typeof PREDEFINED_TAGS)[number]['id'];

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  restaurant: 'Restaurante',
  cafe: 'Café',
  bakery: 'Panadería',
  bar: 'Bar',
  fastfood: 'Comida rápida',
  icecream: 'Heladería',
  pizza: 'Pizzería',
};
