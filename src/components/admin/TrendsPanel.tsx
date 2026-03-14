import { useState, useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { fetchDailyMetrics } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { DailyMetrics } from '../../types/admin';
import AdminPanelWrapper from './AdminPanelWrapper';
import LineChartCard from './charts/LineChartCard';

type Granularity = 'day' | 'week' | 'month' | 'year';

interface AggregatedPoint {
  [key: string]: string | number;
  label: string;
  comments: number;
  ratings: number;
  favorites: number;
  feedback: number;
  tags: number;
  activeUsers: number;
  totalWrites: number;
  newAccounts: number;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay() || 7;
  d.setDate(d.getDate() - dayOfWeek + 1);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function getGroupKey(dateStr: string, granularity: Granularity): string {
  switch (granularity) {
    case 'day':
      return dateStr.slice(5); // MM-DD
    case 'week':
      return `sem ${getWeekKey(dateStr)}`;
    case 'month':
      return dateStr.slice(0, 7); // YYYY-MM
    case 'year':
      return dateStr.slice(0, 4); // YYYY
  }
}

function aggregate(metrics: DailyMetrics[], granularity: Granularity): AggregatedPoint[] {
  const groups = new Map<string, { points: DailyMetrics[]; sortKey: string }>();

  for (const m of metrics) {
    const key = getGroupKey(m.date, granularity);
    const existing = groups.get(key);
    if (existing) {
      existing.points.push(m);
    } else {
      groups.set(key, { points: [m], sortKey: m.date });
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([label, { points }]) => ({
      label,
      comments: points.reduce((s, p) => s + (p.writesByCollection.comments ?? 0), 0),
      ratings: points.reduce((s, p) => s + (p.writesByCollection.ratings ?? 0), 0),
      favorites: points.reduce((s, p) => s + (p.writesByCollection.favorites ?? 0), 0),
      feedback: points.reduce((s, p) => s + (p.writesByCollection.feedback ?? 0), 0),
      tags: points.reduce((s, p) => s + (p.writesByCollection.userTags ?? 0) + (p.writesByCollection.customTags ?? 0), 0),
      activeUsers: granularity === 'day'
        ? points[0].activeUsers
        : Math.round(points.reduce((s, p) => s + p.activeUsers, 0) / points.length),
      totalWrites: points.reduce((s, p) => s + p.dailyWrites, 0),
      newAccounts: points.reduce((s, p) => s + (p.newAccounts ?? 0), 0),
    }));
}

export default function TrendsPanel() {
  const [granularity, setGranularity] = useState<Granularity>('day');

  const fetcher = useCallback(() => fetchDailyMetrics('asc'), []);
  const { data: allMetrics, loading, error } = useAsyncData(fetcher);

  const data = allMetrics ? aggregate(allMetrics, granularity) : [];

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando tendencias.">
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <ToggleButtonGroup
            value={granularity}
            exclusive
            onChange={(_, v: Granularity | null) => { if (v) setGranularity(v); }}
            size="small"
          >
            <ToggleButton value="day">Día</ToggleButton>
            <ToggleButton value="week">Semana</ToggleButton>
            <ToggleButton value="month">Mes</ToggleButton>
            <ToggleButton value="year">Año</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <LineChartCard
              title="Actividad por tipo"
              data={data}
              xAxisKey="label"
              lines={[
                { dataKey: 'comments', color: '#1976d2', label: 'Comentarios' },
                { dataKey: 'ratings', color: '#388e3c', label: 'Ratings' },
                { dataKey: 'favorites', color: '#f57c00', label: 'Favoritos' },
                { dataKey: 'feedback', color: '#7b1fa2', label: 'Feedback' },
                { dataKey: 'tags', color: '#00796b', label: 'Tags' },
              ]}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <LineChartCard
              title="Usuarios activos"
              data={data}
              xAxisKey="label"
              lines={[{ dataKey: 'activeUsers', color: '#7b1fa2', label: 'Usuarios activos' }]}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <LineChartCard
              title="Total de escrituras"
              data={data}
              xAxisKey="label"
              lines={[{ dataKey: 'totalWrites', color: '#388e3c', label: 'Writes totales' }]}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <LineChartCard
              title="Nuevos registros"
              data={data}
              xAxisKey="label"
              lines={[{ dataKey: 'newAccounts', color: '#e91e63', label: 'Nuevas cuentas' }]}
            />
          </Grid>
        </Grid>
      </Box>
    </AdminPanelWrapper>
  );
}
