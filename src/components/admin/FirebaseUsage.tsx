import { useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { fetchDailyMetrics } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import AdminPanelWrapper from './AdminPanelWrapper';
import LineChartCard from './charts/LineChartCard';
import PieChartCard from '../stats/PieChartCard';
import { FREE_TIER_READS, FREE_TIER_WRITES } from '../../constants/admin';

export default function FirebaseUsage() {
  const fetcher = useCallback(() => fetchDailyMetrics('desc', 30), []);
  const { data: rawMetrics, loading, error } = useAsyncData(fetcher);

  // Reverse to chronological order
  const metrics = rawMetrics ? [...rawMetrics].reverse() : [];

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
    <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudieron cargar las métricas de Firebase.">
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
          <QuotaBar
            title="Estimación vs Cuota Gratuita — Reads"
            current={estimatedMonthlyReads}
            limit={FREE_TIER_READS}
            unit="reads/mes"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <QuotaBar
            title="Estimación vs Cuota Gratuita — Writes"
            current={estimatedMonthlyWrites}
            limit={FREE_TIER_WRITES}
            unit="writes/mes"
          />
        </Grid>
      </Grid>
    </AdminPanelWrapper>
  );
}

// ── Extracted sub-component ──────────────────────────────────────────────

interface QuotaBarProps {
  title: string;
  current: number;
  limit: number;
  unit: string;
}

function QuotaBar({ title, current, limit: quotaLimit, unit }: QuotaBarProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          ~{current.toLocaleString('es-AR')} / {quotaLimit.toLocaleString('es-AR')} {unit}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min((current / quotaLimit) * 100, 100)}
          color={current > quotaLimit * 0.8 ? 'error' : 'primary'}
          sx={{ height: 12, borderRadius: 1 }}
        />
      </CardContent>
    </Card>
  );
}
