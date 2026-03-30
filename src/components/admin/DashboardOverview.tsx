import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { fetchCounters, fetchAllCustomTags, fetchAuthStats, fetchNotificationDetails, fetchCommentStats } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { allBusinesses } from '../../hooks/useBusinesses';
import { usePublicMetrics } from '../../hooks/usePublicMetrics';
import { getBusinessName, getTagLabel } from '../../utils/businessHelpers';
import { NOTIFICATION_TYPE_LABELS } from '../../constants/admin';
import type { AdminCounters, AuthStats, NotificationDetails } from '../../types/admin';
import type { CustomTag } from '../../types';
import AdminPanelWrapper from './AdminPanelWrapper';
import CronHealthSection from './CronHealthSection';
import StatCard from './StatCard';
import { TopList, PieChartCard } from '../stats';
import { logger } from '../../utils/logger';

interface CommentStats {
  edited: number;
  replies: number;
  total: number;
}

interface DashboardData {
  counters: AdminCounters | null;
  customTagCounts: Array<{ label: string; value: number }>;
  authStats: AuthStats | null;
  notificationDetails: NotificationDetails | null;
  commentStats: CommentStats | null;
}

export default function DashboardOverview() {
  const fetcher = useCallback(async (): Promise<DashboardData> => {
    const [counters, customTags, authStats, notificationStats, commentStats] = await Promise.all([
      fetchCounters(),
      fetchAllCustomTags(),
      fetchAuthStats().catch((err) => { logger.error('[DashboardOverview] fetchAuthStats failed:', err); return null; }),
      fetchNotificationDetails().catch((err) => { logger.error('[DashboardOverview] fetchNotificationDetails failed:', err); return null; }),
      fetchCommentStats().catch((err) => { logger.error('[DashboardOverview] fetchCommentStats failed:', err); return null; }),
    ]);

    const labelMap = new Map<string, number>();
    for (const tag of customTags as CustomTag[]) {
      labelMap.set(tag.label, (labelMap.get(tag.label) ?? 0) + 1);
    }
    const customTagCounts = [...labelMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    return { counters, customTagCounts, authStats, notificationDetails: notificationStats, commentStats };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);
  const { metrics, loading: metricsLoading, error: metricsError } = usePublicMetrics();

  const isLoading = loading || metricsLoading;
  const isError = error || metricsError;

  const counters = data?.counters;
  const customTagCounts = data?.customTagCounts ?? [];
  const authStats = data?.authStats;
  const notifStats = data?.notificationDetails;
  const commentStats = data?.commentStats;

  const ratingPieData = metrics
    ? Object.entries(metrics.ratingDistribution).map(([key, value]) => ({
        name: `${key} estrella${key === '1' ? '' : 's'}`,
        value,
      }))
    : [];

  const tagsPieData = metrics
    ? metrics.topTags.map((t) => ({ name: getTagLabel(t.tagId), value: t.count }))
    : [];

  const authPieData = authStats
    ? [
        { name: 'Email', value: authStats.byMethod.email },
        { name: 'Anónimo', value: authStats.byMethod.anonymous },
      ]
    : [];

  const notifPieData = notifStats
    ? notifStats.byType.map((entry) => ({
        name: NOTIFICATION_TYPE_LABELS[entry.type] ?? entry.type,
        value: entry.total,
      }))
    : [];

  const readRate = notifStats && notifStats.total > 0
    ? Math.round((notifStats.read / notifStats.total) * 100)
    : 0;

  return (
    <AdminPanelWrapper
      loading={isLoading}
      error={isError}
      errorMessage="No se pudieron cargar los datos del dashboard. Revisá la consola para más detalles."
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Comercios" value={allBusinesses.length} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Usuarios" value={counters?.users ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Comentarios" value={counters?.comments ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Ratings" value={counters?.ratings ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Favoritos" value={counters?.favorites ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Feedback" value={counters?.feedback ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Likes" value={counters?.commentLikes ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Check-ins" value={counters?.checkins ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Follows" value={counters?.follows ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Recomendaciones" value={counters?.recommendations ?? 0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Precios" value={counters?.priceLevels ?? 0} />
        </Grid>

        {commentStats && commentStats.total > 0 && (
          <>
            <Grid size={12}>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>Salud de comentarios</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Editados" value={commentStats.edited} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard
                label="% editados"
                value={Math.round((commentStats.edited / commentStats.total) * 100)}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Respuestas" value={commentStats.replies} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard
                label="% respuestas"
                value={Math.round((commentStats.replies / commentStats.total) * 100)}
              />
            </Grid>
          </>
        )}

        {authStats && (
          <>
            <Grid size={12}>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>Autenticación</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Email" value={authStats.byMethod.email} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Anónimos" value={authStats.byMethod.anonymous} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Verificados" value={authStats.emailVerification.verified} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Sin verificar" value={authStats.emailVerification.unverified} />
            </Grid>
          </>
        )}

        <Grid size={{ xs: 12, md: 6 }}>
          <PieChartCard title="Distribución de Ratings" data={ratingPieData} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieChartCard title="Tags más usados" data={tagsPieData} />
        </Grid>

        {authStats && (
          <Grid size={{ xs: 12, md: 6 }}>
            <PieChartCard title="Usuarios por método de auth" data={authPieData} />
          </Grid>
        )}

        {notifStats && (
          <Grid size={{ xs: 12, md: 6 }}>
            <PieChartCard title="Notificaciones por tipo" data={notifPieData} />
          </Grid>
        )}

        {notifStats && (
          <>
            <Grid size={12}>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>Notificaciones</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="Total enviadas" value={notifStats.total} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label={`Leídas (${readRate}%)`} value={notifStats.read} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label="No leídas" value={notifStats.unread} />
            </Grid>
          </>
        )}

        <Grid size={{ xs: 12, md: 4 }}>
          <TopList
            title="Top 10 — Más favoriteados"
            items={(metrics?.topFavorited ?? []).map((t) => ({
              label: getBusinessName(t.businessId),
              value: t.count,
            }))}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TopList
            title="Top 10 — Más comentados"
            items={(metrics?.topCommented ?? []).map((t) => ({
              label: getBusinessName(t.businessId),
              value: t.count,
            }))}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TopList
            title="Top 10 — Mejor calificados"
            items={(metrics?.topRated ?? []).map((t) => ({
              label: getBusinessName(t.businessId),
              value: t.avgScore,
              secondary: `${t.count} votos`,
            }))}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TopList
            title="Custom Tags — Candidatas a promover"
            items={customTagCounts}
          />
        </Grid>
        <Grid size={12}>
          <CronHealthSection />
        </Grid>
      </Grid>
    </AdminPanelWrapper>
  );
}
