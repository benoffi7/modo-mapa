import type { BusinessCategory } from '../types';

export const LEVELS = [1, 2, 3] as const;

export const LEVEL_SYMBOLS: Record<number, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
};

export const PRICE_CHIPS = [
  { level: 1, label: '$' },
  { level: 2, label: '$$' },
  { level: 3, label: '$$$' },
] as const;

export const PRICE_LEVEL_LABELS: Record<number, string> = {
  1: 'Económico',
  2: 'Moderado',
  3: 'Caro',
};

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  restaurant: 'Restaurante',
  cafe: 'Café',
  bakery: 'Panadería',
  bar: 'Bar',
  fastfood: 'Comida rápida',
  icecream: 'Heladería',
  pizza: 'Pizzería',
};

export const CATEGORY_COLORS: Record<BusinessCategory, string> = {
  restaurant: '#ea4335',
  cafe: '#795548',
  bakery: '#ff9800',
  bar: '#9c27b0',
  fastfood: '#f44336',
  icecream: '#e91e63',
  pizza: '#ff5722',
};
