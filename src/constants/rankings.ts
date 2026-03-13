import type { UserRankingEntry } from '../types';

export const SCORING = {
  comments: 3,
  ratings: 2,
  likes: 1,
  tags: 1,
  favorites: 1,
  photos: 5,
} as const;

export const MEDALS = ['', '🥇', '🥈', '🥉'] as const;

export const ACTION_LABELS: Record<keyof UserRankingEntry['breakdown'], string> = {
  comments: 'Comentarios',
  ratings: 'Calificaciones',
  likes: 'Likes',
  tags: 'Etiquetas',
  favorites: 'Favoritos',
  photos: 'Fotos',
};

export const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Esta semana' },
  { value: 'monthly', label: 'Este mes' },
  { value: 'yearly', label: 'Este año' },
] as const;
