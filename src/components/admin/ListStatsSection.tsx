import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { fetchListStats, fetchTopLists } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import StatCard from './StatCard';
import { TopList } from '../stats';

export default function ListStatsSection() {
  const statsFetcher = useCallback(async () => {
    const [stats, topLists] = await Promise.all([
      fetchListStats(),
      fetchTopLists(10),
    ]);
    return { stats, topLists };
  }, []);

  const { data, loading, error } = useAsyncData(statsFetcher);
  const stats = data?.stats;
  const topLists = data?.topLists ?? [];

  if (loading || error || !stats) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Estadisticas de Listas</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Total listas" value={stats.totalLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Publicas" value={stats.publicLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Privadas" value={stats.privateLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Colaborativas" value={stats.collaborativeLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Total items" value={stats.totalItems} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Prom. items/lista" value={stats.avgItemsPerList} />
        </Grid>
      </Grid>
      {topLists.length > 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList
              title="Top 10 — Listas mas grandes"
              items={topLists.map((l) => ({
                label: `${l.name}${l.isPublic ? '' : ' (privada)'}`,
                value: l.itemCount,
                secondary: `Owner: ${l.ownerId.slice(0, 8)}...`,
              }))}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
