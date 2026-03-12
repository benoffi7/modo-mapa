import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import { fetchUsersPanelData } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { TopList } from '../stats';
import AdminPanelWrapper from './AdminPanelWrapper';
import StatCard from './StatCard';

interface UserStats {
  comments: number;
  ratings: number;
  favorites: number;
  tags: number;
  feedback: number;
  total: number;
}

interface ProcessedData {
  users: Array<{ id: string; name: string } & UserStats>;
  totalUsers: number;
  activeUsers: number;
  avgActions: number;
}

function processData(raw: Awaited<ReturnType<typeof fetchUsersPanelData>>): ProcessedData {
  const map = new Map<string, { name: string; stats: UserStats }>();

  const emptyStats = (): UserStats => ({ comments: 0, ratings: 0, favorites: 0, tags: 0, feedback: 0, total: 0 });

  const getOrCreate = (userId: string): { name: string; stats: UserStats } => {
    let entry = map.get(userId);
    if (!entry) {
      entry = { name: userId.slice(0, 8), stats: emptyStats() };
      map.set(userId, entry);
    }
    return entry;
  };

  // Register users with display names
  raw.users.forEach((user, idx) => {
    const userId = raw.userIds[idx];
    const entry = getOrCreate(userId);
    entry.name = user.displayName || userId.slice(0, 8);
  });

  for (const c of raw.comments) {
    const entry = getOrCreate(c.userId);
    entry.stats.comments++;
    entry.stats.total++;
  }

  for (const r of raw.ratings) {
    const entry = getOrCreate(r.userId);
    entry.stats.ratings++;
    entry.stats.total++;
  }

  for (const f of raw.favorites) {
    const entry = getOrCreate(f.userId);
    entry.stats.favorites++;
    entry.stats.total++;
  }

  for (const t of raw.userTags) {
    const entry = getOrCreate(t.userId);
    entry.stats.tags++;
    entry.stats.total++;
  }

  for (const t of raw.customTags) {
    const entry = getOrCreate(t.userId);
    entry.stats.tags++;
    entry.stats.total++;
  }

  for (const f of raw.feedback) {
    const entry = getOrCreate(f.userId);
    entry.stats.feedback++;
    entry.stats.total++;
  }

  const users = [...map.entries()].map(([id, { name, stats }]) => ({ id, name, ...stats }));
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.total > 0).length;
  const avgActions = totalUsers > 0
    ? Math.round(users.reduce((s, u) => s + u.total, 0) / totalUsers)
    : 0;

  return { users, totalUsers, activeUsers, avgActions };
}

export default function UsersPanel() {
  const fetcher = useCallback(() => fetchUsersPanelData(500), []);
  const { data: raw, loading, error } = useAsyncData(fetcher);

  const processed = raw ? processData(raw) : null;
  const users = processed?.users ?? [];

  const topBy = (key: keyof UserStats, limit = 10) =>
    [...users]
      .sort((a, b) => b[key] - a[key])
      .filter((u) => u[key] > 0)
      .slice(0, limit)
      .map((u) => ({ label: u.name, value: u[key] }));

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando datos de usuarios.">
      <Box>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <StatCard label="Total usuarios" value={processed?.totalUsers ?? 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <StatCard label="Usuarios activos" value={processed?.activeUsers ?? 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <StatCard label="Promedio acciones/usuario" value={processed?.avgActions ?? 0} />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más comentarios" items={topBy('comments')} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más ratings" items={topBy('ratings')} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más favoritos" items={topBy('favorites')} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más tags" items={topBy('tags')} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más feedback" items={topBy('feedback')} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más activos (total)" items={topBy('total')} />
          </Grid>
        </Grid>
      </Box>
    </AdminPanelWrapper>
  );
}
