import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import {
  fetchRecentFollows,
  fetchRecentRecommendations,
  fetchFollowStats,
  fetchRecommendationStats,
} from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import { getBusinessName } from '../../utils/businessHelpers';
import { ADMIN_PAGE_SIZE } from '../../constants/admin';
import { TopList } from '../stats';
import AdminPanelWrapper from './AdminPanelWrapper';
import StatCard from './StatCard';
import ActivityTable from './ActivityTable';
import type { Follow, Recommendation } from '../../types';

interface SocialData {
  follows: Follow[];
  recommendations: Recommendation[];
  followStats: { totalFollows: number; topFollowed: Array<{ userId: string; count: number }> };
  recoStats: { total: number; read: number; unread: number; readRate: number };
}

export default function SocialPanel() {
  const [tab, setTab] = useState(0);

  const fetcher = useCallback(async (): Promise<SocialData> => {
    const [follows, recommendations, followStats, recoStats] = await Promise.all([
      fetchRecentFollows(ADMIN_PAGE_SIZE),
      fetchRecentRecommendations(ADMIN_PAGE_SIZE),
      fetchFollowStats(),
      fetchRecommendationStats(),
    ]);
    return { follows, recommendations, followStats, recoStats };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const follows = data?.follows ?? [];
  const recommendations = data?.recommendations ?? [];
  const followStats = data?.followStats;
  const recoStats = data?.recoStats;

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando datos sociales.">
      <Box>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label="Total follows" value={followStats?.totalFollows ?? 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label="Recomendaciones" value={recoStats?.total ?? 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label="Reco. leidas" value={recoStats?.read ?? 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard label={`Tasa lectura (${recoStats?.readRate ?? 0}%)`} value={recoStats?.readRate ?? 0} />
          </Grid>
        </Grid>

        <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Follows (${follows.length})`} />
          <Tab label={`Recomendaciones (${recommendations.length})`} />
        </Tabs>

        {tab === 0 && (
          <>
            <ActivityTable
              items={follows}
              columns={[
                { label: 'Seguidor', render: (f) => f.followerId.slice(0, 8) },
                { label: 'Seguido', render: (f) => f.followedId.slice(0, 8) },
                { label: 'Fecha', render: (f) => formatDateShort(f.createdAt) },
              ]}
            />
            {followStats && followStats.topFollowed.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <TopList
                  title="Top 10 — Mas seguidos"
                  items={followStats.topFollowed.map((f) => ({
                    label: f.userId.slice(0, 12),
                    value: f.count,
                  }))}
                />
              </Box>
            )}
          </>
        )}

        {tab === 1 && (
          <ActivityTable
            items={recommendations}
            columns={[
              { label: 'Remitente', render: (r) => r.senderName },
              { label: 'Comercio', render: (r) => getBusinessName(r.businessId) },
              { label: 'Leida', render: (r) => <Chip label={r.read ? 'Si' : 'No'} size="small" color={r.read ? 'success' : 'default'} variant="outlined" /> },
              { label: 'Fecha', render: (r) => formatDateShort(r.createdAt) },
            ]}
          />
        )}
      </Box>
    </AdminPanelWrapper>
  );
}
