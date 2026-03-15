import { useState, useCallback, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { calculatePercentile } from '../../utils/perfMetrics';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchPerfMetrics, fetchStorageStats, fetchDailyMetrics } from '../../services/admin';
import { PERF_THRESHOLDS } from '../../constants/performance';
import type { PerfMetricsDoc, PerfVitals } from '../../types/perfMetrics';
import type { StorageStats } from '../../types/admin';
import AdminPanelWrapper from './AdminPanelWrapper';
import LineChartCard from './charts/LineChartCard';
import { CHART_COLORS } from '../../constants/ui';

// ── Helpers ─────────────────────────────────────────────────────────────

type VitalKey = keyof PerfVitals;
type Period = 'today' | '7d' | '30d';
type DeviceFilter = 'all' | 'mobile' | 'desktop';
type ConnectionFilter = 'all' | 'wifi' | '4g' | '3g';

const VITAL_LABELS: Record<VitalKey, { name: string; unit: string }> = {
  lcp: { name: 'LCP', unit: 'ms' },
  inp: { name: 'INP', unit: 'ms' },
  cls: { name: 'CLS', unit: '' },
  ttfb: { name: 'TTFB', unit: 'ms' },
};

const VITAL_DESCRIPTIONS: Record<VitalKey, string> = {
  lcp: 'Largest Contentful Paint',
  inp: 'Interaction to Next Paint',
  cls: 'Cumulative Layout Shift',
  ttfb: 'Time to First Byte',
};

function getSemaphoreColor(key: VitalKey, value: number): 'success' | 'warning' | 'error' {
  const t = PERF_THRESHOLDS[key];
  if (value <= t.green) return 'success';
  if (value <= t.red) return 'warning';
  return 'error';
}


function formatVital(key: VitalKey, value: number): string {
  if (key === 'cls') return value.toFixed(3);
  return `${Math.round(value)}`;
}

// Re-export from shared utility to avoid duplication
const pctl = calculatePercentile;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function docDate(doc: PerfMetricsDoc): Date {
  return doc.timestamp?.toDate?.() ?? new Date();
}

// ── Data types ──────────────────────────────────────────────────────────

interface AggregatedVitals {
  p75: number;
  p50: number;
  p95: number;
  samples: number;
}

interface AggregatedQueries {
  [name: string]: { p50: number; p95: number; count: number };
}

interface FunctionTiming {
  p50: number;
  p95: number;
  count: number;
}

interface RawData {
  docs: PerfMetricsDoc[];
  functions: Record<string, FunctionTiming>;
  storageStats: StorageStats | null;
}

// ── Filtering ───────────────────────────────────────────────────────────

function filterDocs(
  docs: PerfMetricsDoc[],
  period: Period,
  device: DeviceFilter,
  connection: ConnectionFilter,
): PerfMetricsDoc[] {
  const cutoff = period === 'today' ? daysAgo(0) : period === '7d' ? daysAgo(7) : daysAgo(30);

  return docs.filter((doc) => {
    if (docDate(doc) < cutoff) return false;
    if (device !== 'all' && doc.device.type !== device) return false;
    if (connection !== 'all' && doc.device.connection !== connection) return false;
    return true;
  });
}

// ── Aggregation ─────────────────────────────────────────────────────────

function aggregateVitals(docs: PerfMetricsDoc[]) {
  const vitalArrays: Record<VitalKey, number[]> = { lcp: [], inp: [], cls: [], ttfb: [] };

  for (const doc of docs) {
    for (const key of ['lcp', 'inp', 'cls', 'ttfb'] as VitalKey[]) {
      const val = doc.vitals[key];
      if (val !== null && val !== undefined) vitalArrays[key].push(val);
    }
  }

  const vitals = {} as Record<VitalKey, AggregatedVitals | null>;
  for (const key of ['lcp', 'inp', 'cls', 'ttfb'] as VitalKey[]) {
    const arr = vitalArrays[key];
    vitals[key] = arr.length === 0 ? null : {
      p50: pctl(arr, 50), p75: pctl(arr, 75), p95: pctl(arr, 95), samples: arr.length,
    };
  }
  return vitals;
}

function aggregateQueries(docs: PerfMetricsDoc[]): AggregatedQueries {
  const acc: Record<string, { p50s: number[]; p95s: number[]; totalCount: number }> = {};

  for (const doc of docs) {
    for (const [name, timing] of Object.entries(doc.queries)) {
      if (!acc[name]) acc[name] = { p50s: [], p95s: [], totalCount: 0 };
      acc[name].p50s.push(timing.p50);
      acc[name].p95s.push(timing.p95);
      acc[name].totalCount += timing.count;
    }
  }

  const queries: AggregatedQueries = {};
  for (const [name, a] of Object.entries(acc)) {
    queries[name] = { p50: pctl(a.p50s, 50), p95: pctl(a.p95s, 50), count: a.totalCount };
  }
  return queries;
}

// ── Trend data ──────────────────────────────────────────────────────────

interface TrendPoint {
  [key: string]: string | number;
  date: string;
}

function buildTrendData(docs: PerfMetricsDoc[]): TrendPoint[] {
  const byDate = new Map<string, PerfMetricsDoc[]>();

  for (const doc of docs) {
    const date = docDate(doc).toISOString().slice(0, 10);
    const arr = byDate.get(date) ?? [];
    arr.push(doc);
    byDate.set(date, arr);
  }

  const points: TrendPoint[] = [];
  for (const [date, dateDocs] of [...byDate.entries()].sort()) {
    const point: TrendPoint = { date };
    for (const key of ['lcp', 'inp', 'ttfb'] as VitalKey[]) {
      const vals = dateDocs.map((d) => d.vitals[key]).filter((v): v is number => v !== null);
      point[key] = vals.length > 0 ? Math.round(pctl(vals, 75)) : 0;
    }
    // CLS is separate because it's not in ms
    const clsVals = dateDocs.map((d) => d.vitals.cls).filter((v): v is number => v !== null);
    point.cls = clsVals.length > 0 ? Number(pctl(clsVals, 75).toFixed(3)) : 0;
    points.push(point);
  }

  return points;
}

// ── Sub-components ──────────────────────────────────────────────────────

function SemaphoreCard({ vitalKey, data }: { vitalKey: VitalKey; data: AggregatedVitals | null }) {
  const theme = useTheme();
  const label = VITAL_LABELS[vitalKey];
  const description = VITAL_DESCRIPTIONS[vitalKey];

  if (!data) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">{label.name}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
          <Typography variant="h5" sx={{ mt: 1 }}>--</Typography>
          <Typography variant="caption" color="text.secondary">Sin datos</Typography>
        </CardContent>
      </Card>
    );
  }

  const status = getSemaphoreColor(vitalKey, data.p75);
  const color = theme.palette[status].main;

  return (
    <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
          <Typography variant="subtitle2">{label.name}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
          {formatVital(vitalKey, data.p75)}
          {label.unit && <Typography component="span" variant="body2" color="text.secondary"> {label.unit}</Typography>}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          p75 &middot; {data.samples} sesiones
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            p50: {formatVital(vitalKey, data.p50)} &middot; p95: {formatVital(vitalKey, data.p95)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

const QUERY_LABELS: Record<string, string> = {
  notifications: 'Notificaciones',
  unreadCount: 'Contador no leídos',
  userSettings: 'Settings de usuario',
  paginatedQuery: 'Query paginada',
};

function QueryLatencyTable({ queries }: { queries: AggregatedQueries }) {
  const entries = Object.entries(queries);

  if (entries.length === 0) {
    return <Alert severity="info">No hay datos de latencia de queries.</Alert>;
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Query</TableCell>
            <TableCell align="right">p50</TableCell>
            <TableCell align="right">p95</TableCell>
            <TableCell align="right">Samples</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map(([name, timing]) => (
            <TableRow key={name}>
              <TableCell>{QUERY_LABELS[name] ?? name}</TableCell>
              <TableCell align="right">{Math.round(timing.p50)} ms</TableCell>
              <TableCell align="right">{Math.round(timing.p95)} ms</TableCell>
              <TableCell align="right">{timing.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function FunctionTimingTable({ functions }: { functions: Record<string, FunctionTiming> }) {
  const entries = Object.entries(functions);

  if (entries.length === 0) {
    return <Alert severity="info">No hay datos de timing de funciones. Se agregan con el dailyMetrics diario.</Alert>;
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Function</TableCell>
            <TableCell align="right">p50</TableCell>
            <TableCell align="right">p95</TableCell>
            <TableCell align="right">Invocaciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map(([name, timing]) => (
            <TableRow key={name}>
              <TableCell>{name}</TableCell>
              <TableCell align="right">{Math.round(timing.p50)} ms</TableCell>
              <TableCell align="right">{Math.round(timing.p95)} ms</TableCell>
              <TableCell align="right">{timing.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const FREE_TIER_STORAGE = 1 * 1024 * 1024 * 1024; // 1 GB

function StorageCard({ stats }: { stats: StorageStats | null }) {
  if (!stats) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2">Fotos Menu - Storage</Typography>
          <Alert severity="warning" sx={{ mt: 1 }}>
            No se pudo obtener datos de storage.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const pct = (stats.totalBytes / FREE_TIER_STORAGE) * 100;
  const barColor = pct < 50 ? 'success' : pct < 80 ? 'warning' : 'error';

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>Fotos Menu - Storage</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {formatBytes(stats.totalBytes)}
          <Typography component="span" variant="body2" color="text.secondary"> / {formatBytes(FREE_TIER_STORAGE)}</Typography>
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          color={barColor}
          sx={{ my: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary">
          {stats.fileCount} archivos &middot; {pct.toFixed(1)}% usado
        </Typography>
      </CardContent>
    </Card>
  );
}

// ── Trend chart lines ───────────────────────────────────────────────────

const VITAL_TREND_LINES = [
  { dataKey: 'lcp', color: CHART_COLORS[0], label: 'LCP (ms)' },
  { dataKey: 'inp', color: CHART_COLORS[1], label: 'INP (ms)' },
  { dataKey: 'ttfb', color: CHART_COLORS[2], label: 'TTFB (ms)' },
];

const CLS_TREND_LINES = [
  { dataKey: 'cls', color: CHART_COLORS[3], label: 'CLS' },
];

// ── Main Panel ──────────────────────────────────────────────────────────

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
            <ToggleButtonGroup
              value={period}
              exclusive
              onChange={(_, v) => v && setPeriod(v)}
              size="small"
            >
              <ToggleButton value="today">Hoy</ToggleButton>
              <ToggleButton value="7d">7 días</ToggleButton>
              <ToggleButton value="30d">30 días</ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup
              value={device}
              exclusive
              onChange={(_, v) => v && setDevice(v)}
              size="small"
            >
              <ToggleButton value="all">Todos</ToggleButton>
              <ToggleButton value="mobile">Mobile</ToggleButton>
              <ToggleButton value="desktop">Desktop</ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup
              value={connection}
              exclusive
              onChange={(_, v) => v && setConnection(v)}
              size="small"
            >
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
                <LineChartCard
                  title="Tendencia Vitals (p75)"
                  data={trendData}
                  lines={VITAL_TREND_LINES}
                  xAxisKey="date"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <LineChartCard
                  title="Tendencia CLS (p75)"
                  data={trendData}
                  lines={CLS_TREND_LINES}
                  xAxisKey="date"
                />
              </Grid>
            </Grid>
          )}

          {/* Query latency table */}
          <Typography variant="h6" gutterBottom>Latencia de Queries</Typography>
          <Box sx={{ mb: 3 }}>
            <QueryLatencyTable queries={queries} />
          </Box>

          {/* Cloud Functions timing */}
          <Typography variant="h6" gutterBottom>Cloud Functions</Typography>
          <Box sx={{ mb: 3 }}>
            <FunctionTimingTable functions={data.functions} />
          </Box>

          {/* Storage */}
          <Typography variant="h6" gutterBottom>Storage</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StorageCard stats={data.storageStats} />
            </Grid>
          </Grid>
        </>
      )}
    </AdminPanelWrapper>
  );
}
