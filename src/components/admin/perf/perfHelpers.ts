import { calculatePercentile } from '../../../utils/perfMetrics';
import { PERF_THRESHOLDS } from '../../../constants/performance';
import type { PerfMetricsDoc, PerfVitals } from '../../../types/perfMetrics';

export type VitalKey = keyof PerfVitals;
export type Period = 'today' | '7d' | '30d';
export type DeviceFilter = 'all' | 'mobile' | 'desktop';
export type ConnectionFilter = 'all' | 'wifi' | '4g' | '3g';

export interface AggregatedVitals {
  p75: number;
  p50: number;
  p95: number;
  samples: number;
}

export interface AggregatedQueries {
  [name: string]: { p50: number; p95: number; count: number };
}

export interface FunctionTiming {
  p50: number;
  p95: number;
  count: number;
}

export interface TrendPoint {
  [key: string]: string | number;
  date: string;
}

export const VITAL_LABELS: Record<VitalKey, { name: string; unit: string }> = {
  lcp: { name: 'LCP', unit: 'ms' },
  inp: { name: 'INP', unit: 'ms' },
  cls: { name: 'CLS', unit: '' },
  ttfb: { name: 'TTFB', unit: 'ms' },
};

export const VITAL_DESCRIPTIONS: Record<VitalKey, string> = {
  lcp: 'Largest Contentful Paint',
  inp: 'Interaction to Next Paint',
  cls: 'Cumulative Layout Shift',
  ttfb: 'Time to First Byte',
};

export const QUERY_LABELS: Record<string, string> = {
  notifications: 'Notificaciones',
  unreadCount: 'Contador no leídos',
  userSettings: 'Settings de usuario',
  paginatedQuery: 'Query paginada',
};

export function getSemaphoreColor(key: VitalKey, value: number): 'success' | 'warning' | 'error' {
  const t = PERF_THRESHOLDS[key];
  if (value <= t.green) return 'success';
  if (value <= t.red) return 'warning';
  return 'error';
}

export function formatVital(key: VitalKey, value: number): string {
  if (key === 'cls') return value.toFixed(3);
  return `${Math.round(value)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const pctl = calculatePercentile;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function docDate(doc: PerfMetricsDoc): Date {
  return doc.timestamp?.toDate?.() ?? new Date();
}

export function filterDocs(
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

export function aggregateVitals(docs: PerfMetricsDoc[]): Record<VitalKey, AggregatedVitals | null> {
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

export function aggregateQueries(docs: PerfMetricsDoc[]): AggregatedQueries {
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

export function buildTrendData(docs: PerfMetricsDoc[]): TrendPoint[] {
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
    const clsVals = dateDocs.map((d) => d.vitals.cls).filter((v): v is number => v !== null);
    point.cls = clsVals.length > 0 ? Number(pctl(clsVals, 75).toFixed(3)) : 0;
    points.push(point);
  }
  return points;
}
