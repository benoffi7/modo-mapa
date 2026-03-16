import { ABUSE_TYPE_LABELS } from '../../../constants';
import type { AbuseLog } from '../../../types/admin';

export type AbuseType = AbuseLog['type'];
export type SortField = 'timestamp' | 'type' | 'collection';
export type SortDir = 'asc' | 'desc';
export type DatePreset = 'all' | 'today' | 'week' | 'month';
export type StatusFilter = 'pending' | 'reviewed' | 'dismissed' | 'all';

export const ALL_TYPES: AbuseType[] = ['rate_limit', 'flagged', 'top_writers'];
export const PAGE_SIZE = 20;

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Última semana' },
  { key: 'month', label: 'Último mes' },
];

export const STATUS_OPTIONS: { key: StatusFilter; label: string; color: 'warning' | 'success' | 'default' }[] = [
  { key: 'pending', label: 'Pendientes', color: 'warning' },
  { key: 'reviewed', label: 'Revisadas', color: 'success' },
  { key: 'dismissed', label: 'Descartadas', color: 'default' },
  { key: 'all', label: 'Todas', color: 'default' },
];

export interface KpiData {
  alertsToday: number;
  alertsYesterday: number;
  topType: string;
  topUser: string;
  topUserCount: number;
  total: number;
}

export function computeKpis(logs: AbuseLog[]): KpiData {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  let alertsToday = 0;
  let alertsYesterday = 0;
  const typeCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  for (const log of logs) {
    const ts = log.timestamp.getTime();
    if (ts >= startOfToday.getTime()) alertsToday++;
    else if (ts >= startOfYesterday.getTime()) alertsYesterday++;
    typeCounts[log.type] = (typeCounts[log.type] ?? 0) + 1;
    userCounts[log.userId] = (userCounts[log.userId] ?? 0) + 1;
  }

  let topType = '-';
  let topTypeCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > topTypeCount) { topTypeCount = count; topType = ABUSE_TYPE_LABELS[type as AbuseType] ?? type; }
  }

  let topUser = '-';
  let topUserCount = 0;
  for (const [user, count] of Object.entries(userCounts)) {
    if (count > topUserCount) { topUserCount = count; topUser = user.slice(0, 8); }
  }

  return { alertsToday, alertsYesterday, topType, topUser, topUserCount, total: logs.length };
}

export function getDateThreshold(preset: DatePreset): Date | null {
  if (preset === 'all') return null;
  const now = new Date();
  if (preset === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'week') return new Date(now.getTime() - 7 * 86_400_000);
  return new Date(now.getTime() - 30 * 86_400_000);
}

export function exportToCsv(logs: AbuseLog[], filename: string): void {
  const header = 'Tipo,Usuario,Colección,Detalle,Fecha';
  const rows = logs.map((log) => {
    const type = ABUSE_TYPE_LABELS[log.type] ?? log.type;
    const detail = `"${log.detail.replace(/"/g, '""')}"`;
    const date = log.timestamp.toLocaleString();
    return `${type},${log.userId},${log.collection},${detail},${date}`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
