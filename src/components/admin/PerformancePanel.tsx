import { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchPerfMetrics, fetchStorageStats, fetchDailyMetrics } from '../../services/admin';
import { CHART_COLORS } from '../../constants/ui';
import AdminPanelWrapper from './AdminPanelWrapper';
import LineChartCard from './charts/LineChartCard';
import SemaphoreCard from './perf/SemaphoreCard';
import QueryLatencyTable from './perf/QueryLatencyTable';
import FunctionTimingTable from './perf/FunctionTimingTable';
import StorageCard from './perf/StorageCard';
import {
  filterDocs, aggregateVitals, aggregateQueries, buildTrendData,
} from './perf/perfHelpers';
import type { PerfMetricsDoc } from '../../types/perfMetrics';
import type { StorageStats } from '../../types/admin';
import type { Period, DeviceFilter, ConnectionFilter, VitalKey, FunctionTiming } from './perf/perfHelpers';

interface RawData {
  docs: PerfMetricsDoc[];
  functions: Record<string, FunctionTiming>;
  storageStats: StorageStats | null;
}

const VITAL_TREND_LINES = [
  { dataKey: 'lcp', color: CHART_COLORS[0], label: 'LCP (ms)' },
  { dataKey: 'inp', color: CHART_COLORS[1], label: 'INP (ms)' },
  { dataKey: 'ttfb', color: CHART_COLORS[2], label: 'TTFB (ms)' },
];

const CLS_TREND_LINES = [
  { dataKey: 'cls', color: CHART_COLORS[3], label: 'CLS' },
];

export default function PerformancePanel() {
  const [period, setPeriod] = useState<Period>('7d');
  const [device, setDevice] = useState<DeviceFilter>('all');
  const [connection, setConnection] = useState<ConnectionFilter>('all');

  const fetcher = useCallback(async (): Promise<RawData> => {
    const [docs, storageStats, dailyMetrics] = await Promise.all([
      fetchPerfMetrics(500),
      fetchStorageStats().catch(() => null),
      fetchDailyMetrics('desc', 1).catch(() => []),
    ]);
    const latestMetrics = dailyMetrics[0] as unknown as Record<string, unknown> | undefined;
    const perfData = (latestMetrics?.performance ?? {}) as Record<string, unknown>;
    const functions = (perfData.functions ?? {}) as Record<string, FunctionTiming>;
    return { docs, functions, storageStats };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterDocs(data.docs, period, device, connection);
  }, [data, period, device, connection]);

  const vitals = useMemo(() => aggregateVitals(filtered), [filtered]);
  const queries = useMemo(() => aggregateQueries(filtered), [filtered]);
  const trendData = useMemo(() => buildTrendData(filtered), [filtered]);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando métricas de performance.">
      {data && (
        <>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v && setPeriod(v)} size="small">
              <ToggleButton value="today">Hoy</ToggleButton>
              <ToggleButton value="7d">7 días</ToggleButton>
              <ToggleButton value="30d">30 días</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup value={device} exclusive onChange={(_, v) => v && setDevice(v)} size="small">
              <ToggleButton value="all">Todos</ToggleButton>
              <ToggleButton value="mobile">Mobile</ToggleButton>
              <ToggleButton value="desktop">Desktop</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup value={connection} exclusive onChange={(_, v) => v && setConnection(v)} size="small">
              <ToggleButton value="all">Todas</ToggleButton>
              <ToggleButton value="wifi">WiFi</ToggleButton>
              <ToggleButton value="4g">4G</ToggleButton>
              <ToggleButton value="3g">3G</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Semaphore cards */}
          <Typography variant="h6" gutterBottom>Web Vitals</Typography>
          {filtered.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No hay sesiones con datos de performance para los filtros seleccionados.
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(['lcp', 'inp', 'cls', 'ttfb'] as VitalKey[]).map((key) => (
              <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
                <SemaphoreCard vitalKey={key} data={vitals[key]} />
              </Grid>
            ))}
          </Grid>

          {/* Trend charts */}
          {trendData.length > 1 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <LineChartCard title="Tendencia Vitals (p75)" data={trendData} lines={VITAL_TREND_LINES} xAxisKey="date" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <LineChartCard title="Tendencia CLS (p75)" data={trendData} lines={CLS_TREND_LINES} xAxisKey="date" />
              </Grid>
            </Grid>
          )}

          {/* Query latency */}
          <Typography variant="h6" gutterBottom>Latencia de Queries</Typography>
          <Box sx={{ mb: 3 }}><QueryLatencyTable queries={queries} /></Box>

          {/* Cloud Functions */}
          <Typography variant="h6" gutterBottom>Cloud Functions</Typography>
          <Box sx={{ mb: 3 }}><FunctionTimingTable functions={data.functions} /></Box>

          {/* Storage */}
          <Typography variant="h6" gutterBottom>Storage</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><StorageCard stats={data.storageStats} /></Grid>
          </Grid>
        </>
      )}
    </AdminPanelWrapper>
  );
}
