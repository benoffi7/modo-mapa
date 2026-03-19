import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchUsersPanelData, fetchAuthStats, fetchSettingsAggregates } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { TopList } from '../stats';
import AdminPanelWrapper from './AdminPanelWrapper';
import StatCard from './StatCard';
import type { AuthStats, SettingsAggregates } from '../../types/admin';

interface UserStats {
  comments: number;
  ratings: number;
  favorites: number;
  tags: number;
  feedback: number;
  likesGiven: number;
  total: number;
  authMethod?: 'anonymous' | 'email';
  emailVerified?: boolean;
}

interface ProcessedData {
  users: Array<{ id: string; name: string } & UserStats>;
  totalUsers: number;
  activeUsers: number;
  avgActions: number;
  authStats: AuthStats | null;
  settingsAggregates: SettingsAggregates | null;
}

function processData(
  raw: Awaited<ReturnType<typeof fetchUsersPanelData>>,
  authStats: AuthStats | null,
  settingsAggregates: SettingsAggregates | null,
): ProcessedData {
  const map = new Map<string, { name: string; stats: UserStats }>();

  const emptyStats = (): UserStats => ({ comments: 0, ratings: 0, favorites: 0, tags: 0, feedback: 0, likesGiven: 0, total: 0 });

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

  for (const l of raw.commentLikes) {
    const entry = getOrCreate(l.userId);
    entry.stats.likesGiven++;
    entry.stats.total++;
  }

  // Enrich with auth info
  if (authStats) {
    const authMap = new Map(authStats.users.map((u) => [u.uid, u]));
    for (const [id, entry] of map) {
      const authUser = authMap.get(id);
      if (authUser) {
        entry.stats.authMethod = authUser.authMethod;
        entry.stats.emailVerified = authUser.emailVerified;
      }
    }
  }

  const users = [...map.entries()].map(([id, { name, stats }]) => ({ id, name, ...stats }));
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.total > 0).length;
  const avgActions = totalUsers > 0
    ? Math.round(users.reduce((s, u) => s + u.total, 0) / totalUsers)
    : 0;

  return { users, totalUsers, activeUsers, avgActions, authStats, settingsAggregates };
}

export default function UsersPanel() {
  const fetcher = useCallback(async () => {
    const [raw, authStats, settingsAggregates] = await Promise.all([
      fetchUsersPanelData(500),
      fetchAuthStats().catch((err) => { console.error('[UsersPanel] fetchAuthStats failed:', err); return null; }),
      fetchSettingsAggregates().catch((err) => { console.error('[UsersPanel] fetchSettingsAggregates failed:', err); return null; }),
    ]);
    return { raw, authStats, settingsAggregates };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const processed = data ? processData(data.raw, data.authStats, data.settingsAggregates) : null;
  const users = processed?.users ?? [];
  const authStats = processed?.authStats;
  const settings = processed?.settingsAggregates;

  const topBy = (key: keyof UserStats, limit = 10) =>
    [...users]
      .sort((a, b) => (b[key] as number) - (a[key] as number))
      .filter((u) => (u[key] as number) > 0)
      .slice(0, limit)
      .map((u) => {
        const authSuffix = u.authMethod === 'email' ? ' ✉' : '';
        return { label: `${u.name}${authSuffix}`, value: u[key] as number };
      });

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

        {authStats && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Autenticación</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
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
            </Grid>
          </>
        )}

        {settings && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Preferencias de usuarios</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <StatCard label="Perfiles públicos" value={settings.publicProfiles} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <StatCard label="Notificaciones activas" value={settings.notificationsEnabled} />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <StatCard label="Analytics activo" value={settings.analyticsEnabled} />
              </Grid>
            </Grid>
          </>
        )}

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
            <TopList title="Más likes dados" items={topBy('likesGiven')} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList title="Más activos (total)" items={topBy('total')} />
          </Grid>
        </Grid>
      </Box>
    </AdminPanelWrapper>
  );
}
