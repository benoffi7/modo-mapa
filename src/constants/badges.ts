import type { UserRankingEntry } from '../types';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Evaluates whether the badge is earned given a breakdown */
  check: (breakdown: UserRankingEntry['breakdown'], meta?: BadgeMeta) => boolean;
}

interface BadgeMeta {
  position?: number | undefined;
  streak?: number | undefined;
}

export const BADGES: BadgeDefinition[] = [
  // Comment milestones
  {
    id: 'first_comment',
    name: 'Primera reseña',
    description: 'Dejaste tu primer comentario',
    icon: '💬',
    check: (b) => b.comments >= 1,
  },
  {
    id: 'comments_10',
    name: 'Comentarista',
    description: '10 comentarios',
    icon: '🗣️',
    check: (b) => b.comments >= 10,
  },
  {
    id: 'comments_50',
    name: 'Influencer',
    description: '50 comentarios',
    icon: '📢',
    check: (b) => b.comments >= 50,
  },

  // Photo milestones
  {
    id: 'first_photo',
    name: 'Primera foto',
    description: 'Subiste tu primera foto del menú',
    icon: '📸',
    check: (b) => b.photos >= 1,
  },
  {
    id: 'photos_10',
    name: 'Fotógrafo',
    description: '10 fotos aprobadas',
    icon: '🖼️',
    check: (b) => b.photos >= 10,
  },

  // Rating milestones
  {
    id: 'first_rating',
    name: 'Primera calificación',
    description: 'Calificaste tu primer comercio',
    icon: '⭐',
    check: (b) => b.ratings >= 1,
  },
  {
    id: 'ratings_20',
    name: 'Crítico',
    description: '20 calificaciones',
    icon: '🌟',
    check: (b) => b.ratings >= 20,
  },

  // Like milestones
  {
    id: 'likes_10',
    name: 'Popular',
    description: '10 likes recibidos',
    icon: '❤️',
    check: (b) => b.likes >= 10,
  },

  // Diversity
  {
    id: 'all_rounder',
    name: 'Todoterreno',
    description: 'Actividad en todas las categorías',
    icon: '🏅',
    check: (b) =>
      b.comments > 0 && b.ratings > 0 && b.likes > 0 && b.tags > 0 && b.favorites > 0 && b.photos > 0,
  },

  // Position-based (need meta)
  {
    id: 'top3',
    name: 'Podio',
    description: 'Top 3 en un ranking',
    icon: '🏆',
    check: (_b, meta) => meta?.position != null && meta.position <= 3,
  },

  // Streak (need meta)
  {
    id: 'streak_7',
    name: 'Racha de 7 días',
    description: '7 días consecutivos con actividad',
    icon: '🔥',
    check: (_b, meta) => meta?.streak != null && meta.streak >= 7,
  },
];

export function evaluateBadges(
  breakdown: UserRankingEntry['breakdown'],
  meta?: BadgeMeta,
): BadgeDefinition[] {
  return BADGES.filter((badge) => badge.check(breakdown, meta));
}
