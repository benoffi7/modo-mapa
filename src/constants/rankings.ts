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

export interface TierDefinition {
  name: string;
  minScore: number;
  /** [light, dark] color pair */
  color: [string, string];
  icon: string;
}

export const TIERS: TierDefinition[] = [
  { name: 'Diamante', minScore: 500, color: ['#4dd0e1', '#80deea'], icon: '💎' },
  { name: 'Oro', minScore: 150, color: ['#ffc107', '#ffd54f'], icon: '🥇' },
  { name: 'Plata', minScore: 50, color: ['#90a4ae', '#b0bec5'], icon: '🥈' },
  { name: 'Bronce', minScore: 0, color: ['#cd7f32', '#dea064'], icon: '🥉' },
];

export function getUserTier(score: number): TierDefinition {
  return TIERS.find((t) => score >= t.minScore) ?? TIERS[TIERS.length - 1];
}

export const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Esta semana' },
  { value: 'monthly', label: 'Este mes' },
  { value: 'yearly', label: 'Este año' },
  { value: 'alltime', label: 'Histórico' },
] as const;
