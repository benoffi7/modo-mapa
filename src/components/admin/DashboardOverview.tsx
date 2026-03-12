import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import { fetchCounters, fetchAllCustomTags } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { allBusinesses } from '../../hooks/useBusinesses';
import { usePublicMetrics } from '../../hooks/usePublicMetrics';
import { getBusinessName, getTagLabel } from '../../utils/businessHelpers';
import type { AdminCounters } from '../../types/admin';
import type { CustomTag } from '../../types';
import AdminPanelWrapper from './AdminPanelWrapper';
import StatCard from './StatCard';
import { TopList, PieChartCard } from '../stats';

interface DashboardData {
  counters: AdminCounters | null;
  customTagCounts: Array<{ label: string; value: number }>;
}

export default function DashboardOverview() {
  const fetcher = useCallback(async (): Promise<DashboardData> => {
    const [counters, customTags] = await Promise.all([
      fetchCounters(),
      fetchAllCustomTags(),
    ]);

    const labelMap = new Map<string, number>();
    for (const tag of customTags as CustomTag[]) {
      labelMap.set(tag.label, (labelMap.get(tag.label) ?? 0) + 1);
    }
    const customTagCounts = [...labelMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    return { counters, customTagCounts };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);
  const { metrics, loading: metricsLoading, error: metricsError } = usePublicMetrics();

  const isLoading = loading || metricsLoading;
  const isError = error || metricsError;

  const counters = data?.counters;
  const customTagCounts = data?.customTagCounts ?? [];

  const ratingPieData = metrics
    ? Object.entries(metrics.ratingDistribution).map(([key, value]) => ({
        name: `${key} estrella${key === '1' ? '' : 's'}`,
        value,
      }))
    : [];

  const tagsPieData = metrics
    ? metrics.topTags.map((t) => ({ name: getTagLabel(t.tagId), value: t.count }))
    : [];

  return (
    <AdminPanelWrapper
      loading={isLoading}
      error={isError}
      errorMessage="Error cargando datos del dashboard. Revisá la consola para más detalles."
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

        <Grid size={{ xs: 12, md: 6 }}>
          <PieChartCard title="Distribución de Ratings" data={ratingPieData} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieChartCard title="Tags más usados" data={tagsPieData} />
        </Grid>

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
      </Grid>
    </AdminPanelWrapper>
  );
}
