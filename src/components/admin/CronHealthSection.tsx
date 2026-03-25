import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { logger } from '../../utils/logger';
import Box from '@mui/material/Box';
import { fetchLatestRanking, fetchTrendingCurrent } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getBusinessName } from '../../utils/businessHelpers';
import { PieChartCard, TopList } from '../stats';
import HealthIndicator from './HealthIndicator';
import AdminPanelWrapper from './AdminPanelWrapper';
import type { HealthStatus } from '../../types/admin';
import type { TrendingData, UserRanking } from '../../types';

// Tier thresholds (must match rankings logic)
const TIER_THRESHOLDS = [
  { name: 'Diamante', min: 500 },
  { name: 'Oro', min: 200 },
  { name: 'Plata', min: 50 },
  { name: 'Bronce', min: 0 },
];

function getTier(score: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (score >= t.min) return t.name;
  }
  return 'Bronce';
}

function computeFreshness(date: Date, thresholdHours: number, warningHours: number): HealthStatus {
  const ageMs = Date.now() - date.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= thresholdHours) return 'ok';
  if (ageHours <= warningHours) return 'warning';
  return 'error';
}

interface CronData {
  ranking: UserRanking | null;
  trending: TrendingData | null;
}

export default function CronHealthSection() {
  const fetcher = useCallback(async (): Promise<CronData> => {
    const [ranking, trending] = await Promise.all([
      fetchLatestRanking().catch((err) => { logger.error('[CronHealthSection] fetchLatestRanking failed:', err); return null; }),
      fetchTrendingCurrent().catch((err) => { logger.error('[CronHealthSection] fetchTrendingCurrent failed:', err); return null; }),
    ]);
    return { ranking, trending };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  if (loading || error) {
    return (
      <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando estado de crons.">
        {null}
      </AdminPanelWrapper>
    );
  }

  if (!data) return null;

  const { ranking, trending } = data;

  // Rankings health
  const rankingHealth: HealthStatus = ranking
    ? computeFreshness(ranking.endDate, 7 * 24, 14 * 24)
    : 'error';

  const tierDistribution = ranking
    ? (() => {
        const counts: Record<string, number> = {};
        for (const entry of ranking.rankings) {
          const tier = getTier(entry.score);
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

  // Trending health (cron runs at 3 AM ART daily)
  const trendingHealth: HealthStatus = trending
    ? computeFreshness(trending.computedAt, 26, 48)
    : 'error';

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
        {/* Rankings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Rankings</Typography>
                <HealthIndicator status={rankingHealth} />
              </Box>
              {ranking ? (
                <>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Periodo: {ranking.period} — {ranking.totalParticipants} participantes
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Hasta: {ranking.endDate.toLocaleDateString()}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Sin datos de ranking</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trending */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Trending</Typography>
                <HealthIndicator status={trendingHealth} />
              </Box>
              {trending ? (
                <>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {trending.businesses.length} comercios trending
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Actualizado: {trending.computedAt.toLocaleDateString()} {trending.computedAt.toLocaleTimeString()}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Sin datos de trending</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tier distribution */}
        {tierDistribution.length > 0 && (
          <Grid size={{ xs: 12, md: 4 }}>
            <PieChartCard title="Distribucion de Tiers" data={tierDistribution} />
          </Grid>
        )}

        {/* Top ranking */}
        {topRanking.length > 0 && (
          <Grid size={{ xs: 12, md: 4 }}>
            <TopList title="Top 5 Ranking" items={topRanking} />
          </Grid>
        )}

        {/* Trending list */}
        {trendingItems.length > 0 && (
          <Grid size={{ xs: 12, md: 4 }}>
            <TopList title="Comercios Trending" items={trendingItems} />
          </Grid>
        )}
      </Grid>
    </>
  );
}
