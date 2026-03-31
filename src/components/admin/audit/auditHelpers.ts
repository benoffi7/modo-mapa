import type { DeletionAuditLogEntry } from '../../../types/admin';

// ── Constants ─────────────────────────────────────────────────────────

export const PAGE_SIZE = 50;

export const STATUS_COLORS: Record<DeletionAuditLogEntry['status'], 'success' | 'warning' | 'error'> = {
  success: 'success',
  partial_failure: 'warning',
  failure: 'error',
};

export const STATUS_LABELS: Record<DeletionAuditLogEntry['status'], string> = {
  success: 'Exito',
  partial_failure: 'Fallo parcial',
  failure: 'Fallo total',
};

export const TYPE_LABELS: Record<DeletionAuditLogEntry['type'], string> = {
  account_delete: 'Eliminacion de cuenta',
  anonymous_clean: 'Limpieza anonimo',
};

// ── KPI computation ───────────────────────────────────────────────────

export interface AuditKpis {
  total: number;
  successRate: number;
  lastDeletion: Date | null;
}

export function computeKpis(logs: DeletionAuditLogEntry[]): AuditKpis {
  const total = logs.length;
  const successCount = logs.filter((l) => l.status === 'success').length;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
  const lastDeletion = logs.length > 0 ? logs[0].timestamp : null;

  return { total, successRate, lastDeletion };
}

// ── Formatting helpers ────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
