import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { logger } from '../../utils/logger';
import { fetchLatestRanking, fetchTrendingCurrent, fetchCronHealthStatus } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getBusinessName } from '../../utils/businessHelpers';
import { PieChartCard, TopList } from '../stats';
import AdminPanelWrapper from './AdminPanelWrapper';
import CronCard from './CronCard';
import { CRON_CONFIGS } from '../../constants/admin';
import type { CronRunStatus } from '../../types/admin';
import type { TrendingData, UserRanking } from '../../types';
import { getUserTier } from '../../constants/rankings';

interface CronData {
  cronRuns: CronRunStatus[];
  ranking: UserRanking | null;
  trending: TrendingData | null;
}

export default function CronHealthSection() {
  const fetcher = useCallback(async (): Promise<CronData> => {
    const [cronRuns, ranking, trending] = await Promise.all([
      fetchCronHealthStatus().catch((err) => { logger.error('[CronHealthSection] fetchCronHealthStatus failed:', err); return [] as CronRunStatus[]; }),
      fetchLatestRanking().catch((err) => { logger.error('[CronHealthSection] fetchLatestRanking failed:', err); return null; }),
      fetchTrendingCurrent().catch((err) => { logger.error('[CronHealthSection] fetchTrendingCurrent failed:', err); return null; }),
    ]);
    return { cronRuns, ranking, trending };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  if (loading || error) {
    return (
      <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudo cargar el estado de crons.">
        {null}
      </AdminPanelWrapper>
    );
  }

  if (!data) return null;

  const { cronRuns, ranking, trending } = data;

  const tierDistribution = ranking
    ? (() => {
        const counts: Record<string, number> = {};
        for (const entry of ranking.rankings) {
          const tier = getUserTier(entry.score).name;
          counts[tier] = (counts[tier] ?? 0) + 1;
        }
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      })()
    : [];

  const topRanking = ranking
    ? ranking.rankings.slice(0, 5).map((r) => ({
        label: r.displayName || r.userId.slice(0, 8),
        value: r.score,
      }))
    : [];

  const trendingItems = trending
    ? trending.businesses.map((b) => ({
        label: getBusinessName(b.businessId) || b.name,
        value: b.score,
        secondary: `R:${b.breakdown.ratings} C:${b.breakdown.comments} T:${b.breakdown.userTags}`,
      }))
    : [];

  return (
    <>
      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Estado de Crons</Typography>
      <Grid container spacing={2}>
        {CRON_CONFIGS.map((config) => (
          <Grid key={config.name} size={{ xs: 12, sm: 6, md: 4 }}>
            <CronCard
              config={config}
              run={cronRuns.find((r) => r.cronName === config.name) ?? null}
            />
          </Grid>
        ))}
      </Grid>

      {/* Datos adicionales */}
      {(tierDistribution.length > 0 || topRanking.length > 0 || trendingItems.length > 0) && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Datos adicionales</Typography>
          <Grid container spacing={2}>
            {tierDistribution.length > 0 && (
              <Grid size={{ xs: 12, md: 4 }}>
                <PieChartCard title="Distribucion de Tiers" data={tierDistribution} />
              </Grid>
            )}
            {topRanking.length > 0 && (
              <Grid size={{ xs: 12, md: 4 }}>
                <TopList title="Top 5 Ranking" items={topRanking} />
              </Grid>
            )}
            {trendingItems.length > 0 && (
              <Grid size={{ xs: 12, md: 4 }}>
                <TopList title="Comercios Trending" items={trendingItems} />
              </Grid>
            )}
          </Grid>
        </>
      )}
    </>
  );
}
