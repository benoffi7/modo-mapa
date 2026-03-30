import type { AbuseLog } from '../types/admin';
import type { MenuPhotoStatus } from '../types';

export const FREE_TIER_READS = 50_000;
export const FREE_TIER_WRITES = 20_000;

export const ADMIN_PAGE_SIZE = 20;

export const STATUS_CHIP: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'Pendiente', color: 'warning' },
  approved: { label: 'Aprobada', color: 'success' },
  rejected: { label: 'Rechazada', color: 'error' },
};

type StatusFilter = 'all' | MenuPhotoStatus;

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  pending: 'Pendientes',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  like: 'Like',
  photo_approved: 'Foto aprobada',
  photo_rejected: 'Foto rechazada',
  ranking: 'Ranking',
  feedback_response: 'Respuesta feedback',
  comment_reply: 'Respuesta comentario',
  new_follower: 'Nuevo seguidor',
  recommendation: 'Recomendación',
};

export const ABUSE_TYPE_LABELS: Record<AbuseLog['type'], string> = {
  rate_limit: 'Rate Limit',
  flagged: 'Contenido Flaggeado',
  top_writers: 'Top Writer',
};

export const ABUSE_TYPE_COLORS: Record<AbuseLog['type'], 'warning' | 'error' | 'info'> = {
  rate_limit: 'warning',
  flagged: 'error',
  top_writers: 'info',
};
