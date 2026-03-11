import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { countersConverter, dailyMetricsConverter } from '../../config/adminConverters';
import { allBusinesses } from '../../hooks/useBusinesses';
import { PREDEFINED_TAGS } from '../../types';
import type { AdminCounters, DailyMetrics } from '../../types/admin';
import StatCard from './StatCard';
import TopList from './TopList';
import PieChartCard from './charts/PieChartCard';

function getBusinessName(id: string): string {
  return allBusinesses.find((b) => b.id === id)?.name ?? id;
}

function getTagLabel(tagId: string): string {
  return PREDEFINED_TAGS.find((t) => t.id === tagId)?.label ?? tagId;
}

export default function DashboardOverview() {
  const [counters, setCounters] = useState<AdminCounters | null>(null);
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      getDoc(doc(db, 'config', 'counters').withConverter(countersConverter)),
      getDoc(doc(db, 'dailyMetrics', today).withConverter(dailyMetricsConverter)),
    ])
      .then(([countersSnap, metricsSnap]) => {
        if (ignore) return;
        setCounters(countersSnap.exists() ? countersSnap.data() : null);
        setMetrics(metricsSnap.exists() ? metricsSnap.data() : null);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError(true);
        setLoading(false);
      });

    return () => { ignore = true; };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Error cargando métricas del dashboard.</Alert>;
  }

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
            value: t.count,
            secondary: `★ ${t.avgScore}`,
          }))}
        />
      </Grid>
    </Grid>
  );
}
