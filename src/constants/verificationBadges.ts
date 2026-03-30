import type { VerificationBadgeId } from '../types';

export const VERIFICATION_BADGES: Record<VerificationBadgeId, {
  name: string;
  description: string;
  icon: string;
  target: number;
}> = {
  local_guide: {
    name: 'Local Guide',
    description: '50+ calificaciones en tu ciudad',
    icon: '\u{1F6E1}\u{FE0F}',
    target: 50,
  },
  verified_visitor: {
    name: 'Visitante Verificado',
    description: '5+ check-ins desde el negocio',
    icon: '\u{1F4CD}',
    target: 5,
  },
  trusted_reviewer: {
    name: 'Opini\u00F3n Confiable',
    description: 'Ratings consistentes con la comunidad',
    icon: '\u2705',
    target: 80, // 80% de ratings dentro de +-0.5 del promedio
  },
};

export const VERIFICATION_CACHE_KEY = 'mm_verification_badges';
export const VERIFICATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
