import type {
  AbuseLog,
  ModerationAction,
  ModerationTargetCollection,
} from '../types/admin';
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
  recipient_flood: 'Flood Destinatario',
  anon_flood: 'Flood Anonimo',
  ip_rate_limit: 'Rate Limit IP',
  config_edit: 'Edicion Config',
  deletion_failure: 'Fallo Eliminacion',
};

export const ABUSE_TYPE_COLORS: Record<AbuseLog['type'], 'warning' | 'error' | 'info'> = {
  rate_limit: 'warning',
  flagged: 'error',
  top_writers: 'info',
  recipient_flood: 'warning',
  anon_flood: 'error',
  ip_rate_limit: 'warning',
  config_edit: 'info',
  deletion_failure: 'error',
};

export const MODERATION_ACTION_LABELS: Record<ModerationAction, string> = {
  delete: 'Eliminado',
  hide: 'Ocultado',
};

export const MODERATION_TARGET_LABELS: Record<ModerationTargetCollection, string> = {
  comments: 'Comentario',
  ratings: 'Rating',
  customTags: 'Tag personalizado',
};

export interface CronConfig {
  name: string;
  label: string;
  schedule: string;
  thresholdOkHours: number;
  thresholdWarningHours: number;
}

export const CRON_CONFIGS: CronConfig[] = [
  { name: 'computeWeeklyRanking', label: 'Rankings (semanal)', schedule: 'Lunes 4AM', thresholdOkHours: 7 * 24, thresholdWarningHours: 14 * 24 },
  { name: 'computeMonthlyRanking', label: 'Rankings (mensual)', schedule: '1ro del mes 4AM', thresholdOkHours: 31 * 24, thresholdWarningHours: 45 * 24 },
  { name: 'computeAlltimeRanking', label: 'Rankings (all-time)', schedule: 'Lunes 5AM', thresholdOkHours: 7 * 24, thresholdWarningHours: 14 * 24 },
  { name: 'computeTrendingBusinesses', label: 'Trending', schedule: 'Diario 3AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'dailyMetrics', label: 'Metricas diarias', schedule: 'Diario 3AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'cleanupRejectedPhotos', label: 'Limpieza fotos rechazadas', schedule: 'Diario 4AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'cleanupExpiredNotifications', label: 'Limpieza notificaciones', schedule: 'Diario 5AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'cleanupActivityFeed', label: 'Limpieza activity feed', schedule: 'Diario 5AM', thresholdOkHours: 26, thresholdWarningHours: 48 },
  { name: 'generateFeaturedLists', label: 'Listas destacadas', schedule: 'Lunes 5AM', thresholdOkHours: 7 * 24, thresholdWarningHours: 14 * 24 },
];
