import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { dailyMetricsConverter } from '../../config/adminConverters';
import type { DailyMetrics } from '../../types/admin';
import LineChartCard from './charts/LineChartCard';
import PieChartCard from './charts/PieChartCard';

// Spark plan free tier (monthly)
const FREE_TIER_READS = 50_000;
const FREE_TIER_WRITES = 20_000;

export default function FirebaseUsage() {
  const [metrics, setMetrics] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;

    getDocs(
      query(
        collection(db, 'dailyMetrics').withConverter(dailyMetricsConverter),
        orderBy('__name__', 'desc'),
        limit(30),
      ),
    )
      .then((snap) => {
        if (ignore) return;
        const data = snap.docs.map((d) => d.data()).reverse(); // chronological
        setMetrics(data);
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
    return <Alert severity="error">Error cargando métricas de Firebase.</Alert>;
  }

  const lineData = metrics.map((m) => ({
    date: m.date.slice(5), // MM-DD
    reads: m.dailyReads,
    writes: m.dailyWrites,
    deletes: m.dailyDeletes,
  }));

  const activeUsersData = metrics.map((m) => ({
    date: m.date.slice(5),
    usuarios: m.activeUsers,
  }));

  const today = metrics[metrics.length - 1];
  const writesPieData = today
    ? Object.entries(today.writesByCollection).map(([name, value]) => ({ name, value }))
    : [];
  const deletesPieData = today
    ? Object.entries(today.deletesByCollection ?? {}).map(([name, value]) => ({ name, value }))
    : [];

  // Estimate monthly usage from last 30 days
  const totalReads = metrics.reduce((sum, m) => sum + m.dailyReads, 0);
  const totalWrites = metrics.reduce((sum, m) => sum + m.dailyWrites, 0);
  const daysTracked = metrics.length || 1;
  const estimatedMonthlyReads = Math.round((totalReads / daysTracked) * 30);
  const estimatedMonthlyWrites = Math.round((totalWrites / daysTracked) * 30);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12 }}>
        <LineChartCard
          title="Reads / Writes / Deletes por día (últimos 30 días)"
          data={lineData}
          lines={[
            { dataKey: 'reads', color: '#1976d2', label: 'Reads' },
            { dataKey: 'writes', color: '#388e3c', label: 'Writes' },
            { dataKey: 'deletes', color: '#d32f2f', label: 'Deletes' },
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <LineChartCard
          title="Usuarios activos por día"
          data={activeUsersData}
          lines={[{ dataKey: 'usuarios', color: '#7b1fa2', label: 'Usuarios activos' }]}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <PieChartCard title="Writes por colección (hoy)" data={writesPieData} />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <PieChartCard title="Deletes por colección (hoy)" data={deletesPieData} />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>Estimación vs Cuota Gratuita — Reads</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              ~{estimatedMonthlyReads.toLocaleString('es-AR')} / {FREE_TIER_READS.toLocaleString('es-AR')} reads/mes
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min((estimatedMonthlyReads / FREE_TIER_READS) * 100, 100)}
              color={estimatedMonthlyReads > FREE_TIER_READS * 0.8 ? 'error' : 'primary'}
              sx={{ height: 12, borderRadius: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>Estimación vs Cuota Gratuita — Writes</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              ~{estimatedMonthlyWrites.toLocaleString('es-AR')} / {FREE_TIER_WRITES.toLocaleString('es-AR')} writes/mes
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min((estimatedMonthlyWrites / FREE_TIER_WRITES) * 100, 100)}
              color={estimatedMonthlyWrites > FREE_TIER_WRITES * 0.8 ? 'error' : 'primary'}
              sx={{ height: 12, borderRadius: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
