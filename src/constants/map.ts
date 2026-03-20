import type { BusinessCategory } from '../types';

export const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };
export const OFFICE_LOCATION = { lat: -34.5591511, lng: -58.4473681 };

export const CATEGORY_COLORS: Record<BusinessCategory, string> = {
  restaurant: '#ea4335',
  cafe: '#795548',
  bakery: '#ff9800',
  bar: '#9c27b0',
  fastfood: '#f44336',
  icecream: '#e91e63',
  pizza: '#ff5722',
};
