import { useCallback } from 'react';
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
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchPerfMetrics, fetchStorageStats, fetchDailyMetrics } from '../../services/admin';
import { PERF_THRESHOLDS } from '../../constants/performance';
import type { PerfMetricsDoc, PerfVitals } from '../../types/perfMetrics';
import type { StorageStats } from '../../types/admin';
import AdminPanelWrapper from './AdminPanelWrapper';

// ── Helpers ─────────────────────────────────────────────────────────────

type VitalKey = keyof PerfVitals;

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

const SEMAPHORE_COLORS = {
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
} as const;

function formatVital(key: VitalKey, value: number): string {
  if (key === 'cls') return value.toFixed(3);
  return `${Math.round(value)}`;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Data aggregation ────────────────────────────────────────────────────

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

interface PanelData {
  vitals: Record<VitalKey, AggregatedVitals | null>;
  queries: AggregatedQueries;
  functions: Record<string, FunctionTiming>;
  totalSessions: number;
  storageStats: StorageStats | null;
}

function aggregateMetrics(docs: PerfMetricsDoc[]): Omit<PanelData, 'storageStats' | 'functions'> {
  const vitalArrays: Record<VitalKey, number[]> = { lcp: [], inp: [], cls: [], ttfb: [] };
  const queryAcc: Record<string, { p50s: number[]; p95s: number[]; totalCount: number }> = {};

  for (const doc of docs) {
    for (const key of Object.keys(vitalArrays) as VitalKey[]) {
      const val = doc.vitals[key];
      if (val !== null && val !== undefined) {
        vitalArrays[key].push(val);
      }
    }

    for (const [name, timing] of Object.entries(doc.queries)) {
      if (!queryAcc[name]) queryAcc[name] = { p50s: [], p95s: [], totalCount: 0 };
      queryAcc[name].p50s.push(timing.p50);
      queryAcc[name].p95s.push(timing.p95);
      queryAcc[name].totalCount += timing.count;
    }
  }

  const vitals = {} as Record<VitalKey, AggregatedVitals | null>;
  for (const key of Object.keys(vitalArrays) as VitalKey[]) {
    const arr = vitalArrays[key];
    if (arr.length === 0) {
      vitals[key] = null;
    } else {
      vitals[key] = {
        p50: percentile(arr, 50),
        p75: percentile(arr, 75),
        p95: percentile(arr, 95),
        samples: arr.length,
      };
    }
  }

  const queries: AggregatedQueries = {};
  for (const [name, acc] of Object.entries(queryAcc)) {
    queries[name] = {
      p50: percentile(acc.p50s, 50),
      p95: percentile(acc.p95s, 50),
      count: acc.totalCount,
    };
  }

  return { vitals, queries, totalSessions: docs.length };
}

// ── Components ──────────────────────────────────────────────────────────

function SemaphoreCard({ vitalKey, data }: { vitalKey: VitalKey; data: AggregatedVitals | null }) {
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
  const color = SEMAPHORE_COLORS[status];

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

const FUNCTION_LABELS: Record<string, string> = {
  onCommentCreated: 'onCommentCreated',
  onRatingWritten: 'onRatingWritten',
};

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
              <TableCell>{FUNCTION_LABELS[name] ?? name}</TableCell>
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

// ── Main Panel ──────────────────────────────────────────────────────────

export default function PerformancePanel() {
  const fetcher = useCallback(async (): Promise<PanelData> => {
    const [docs, storageStats, dailyMetrics] = await Promise.all([
      fetchPerfMetrics(200),
      fetchStorageStats().catch(() => null),
      fetchDailyMetrics('desc', 1).catch(() => []),
    ]);

    const aggregated = aggregateMetrics(docs);
    const latestMetrics = dailyMetrics[0] as unknown as Record<string, unknown> | undefined;
    const perfData = (latestMetrics?.performance ?? {}) as Record<string, unknown>;
    const functions = (perfData.functions ?? {}) as Record<string, FunctionTiming>;

    return { ...aggregated, functions, storageStats };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando métricas de performance.">
      {data && (
        <>
          <Typography variant="h6" gutterBottom>Web Vitals</Typography>
          {data.totalSessions === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No hay sesiones con datos de performance. Los datos se recopilan solo en producción.
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(['lcp', 'inp', 'cls', 'ttfb'] as VitalKey[]).map((key) => (
              <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
                <SemaphoreCard vitalKey={key} data={data.vitals[key]} />
              </Grid>
            ))}
          </Grid>

          <Typography variant="h6" gutterBottom>Latencia de Queries</Typography>
          <Box sx={{ mb: 3 }}>
            <QueryLatencyTable queries={data.queries} />
          </Box>

          <Typography variant="h6" gutterBottom>Cloud Functions</Typography>
          <Box sx={{ mb: 3 }}>
            <FunctionTimingTable functions={data.functions} />
          </Box>

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
