import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { reviewAbuseLog, dismissAbuseLog } from '../../services/admin';
import { useAbuseLogsRealtime } from '../../hooks/useAbuseLogsRealtime';
import { useToast } from '../../context/ToastContext';
import AdminPanelWrapper from './AdminPanelWrapper';
import AlertsFilters from './alerts/AlertsFilters';
import AlertsTable from './alerts/AlertsTable';
import KpiCard from './alerts/KpiCard';
import ReincidentesView from './alerts/ReincidentesView';
import {
  computeKpis, getDateThreshold, exportToCsv, getSeverity,
  ALL_TYPES, PAGE_SIZE,
} from './alerts/alertsHelpers';
import type { AbuseType, SortField, SortDir, DatePreset, StatusFilter, SeverityFilter } from './alerts/alertsHelpers';
import { logger } from '../../utils/logger';

interface AbuseAlertsProps {
  onPendingCount?: (count: number) => void;
}

export default function AbuseAlerts({ onPendingCount }: AbuseAlertsProps) {
  const { logs, loading, error, newCount } = useAbuseLogsRealtime(200);

  const [typeFilter, setTypeFilter] = useState<AbuseType | 'all'>('all');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<'alerts' | 'reincidentes'>('alerts');

  // Toast for new alerts (mantener en el orquestador para no romper al split).
  const toast = useToast();
  const prevNewCount = useRef(0);

  useEffect(() => {
    if (newCount > 0 && newCount !== prevNewCount.current) {
      toast.warning(
        newCount === 1
          ? '1 alerta nueva de abuso'
          : `${newCount} alertas nuevas de abuso`,
      );
      prevNewCount.current = newCount;
    }
  }, [newCount, toast]);

  // Communicate pending count to parent
  const pendingCount = useMemo(() => {
    if (!logs) return 0;
    return logs.filter((l) => !l.reviewed && !l.dismissed).length;
  }, [logs]);

  useEffect(() => {
    onPendingCount?.(pendingCount);
  }, [pendingCount, onPendingCount]);

  const kpis = useMemo(() => logs ? computeKpis(logs) : null, [logs]);
  const collections = useMemo(() => logs ? [...new Set(logs.map((l) => l.collection))].sort() : [], [logs]);
  const typeCounts = useMemo(() => {
    const empty: Record<string, number> = {};
    for (const t of ALL_TYPES) empty[t] = 0;
    if (!logs) return empty;
    const counts = { ...empty };
    for (const log of logs) counts[log.type] = (counts[log.type] ?? 0) + 1;
    return counts;
  }, [logs]);

  const filtered = useMemo(() => {
    if (!logs?.length) return [];
    let result = [...logs];
    if (statusFilter === 'pending') result = result.filter((l) => !l.reviewed && !l.dismissed);
    else if (statusFilter === 'reviewed') result = result.filter((l) => l.reviewed === true);
    else if (statusFilter === 'dismissed') result = result.filter((l) => l.dismissed === true);
    const threshold = getDateThreshold(datePreset);
    if (threshold) result = result.filter((l) => l.timestamp.getTime() >= threshold.getTime());
    if (typeFilter !== 'all') result = result.filter((l) => l.type === typeFilter);
    if (severityFilter !== 'all') result = result.filter((l) => getSeverity(l) === severityFilter);
    if (collectionFilter) result = result.filter((l) => l.collection === collectionFilter);
    if (userSearch.trim()) { const q = userSearch.trim().toLowerCase(); result = result.filter((l) => l.userId.toLowerCase().includes(q)); }
    return result.sort((a, b) => {
      let cmp: number;
      if (sortField === 'timestamp') cmp = a.timestamp.getTime() - b.timestamp.getTime();
      else if (sortField === 'type') cmp = a.type.localeCompare(b.type);
      else cmp = a.collection.localeCompare(b.collection);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [logs, statusFilter, datePreset, typeFilter, severityFilter, collectionFilter, userSearch, sortField, sortDir]);

  const userAlertCounts = useMemo(() => {
    if (!logs) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const log of logs) counts.set(log.userId, (counts.get(log.userId) ?? 0) + 1);
    return counts;
  }, [logs]);

  const reincidentesCount = useMemo(() => {
    if (!logs) return 0;
    const byUser = new Map<string, number>();
    for (const log of logs) byUser.set(log.userId, (byUser.get(log.userId) ?? 0) + 1);
    let count = 0;
    for (const total of byUser.values()) if (total > 3) count++;
    return count;
  }, [logs]);

  const handleReview = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionInProgress(logId);
    try { await reviewAbuseLog(logId); }
    catch (err) { logger.error('Error reviewing:', err); }
    setActionInProgress(null);
  };

  const handleDismiss = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionInProgress(logId);
    try { await dismissAbuseLog(logId); }
    catch (err) { logger.error('Error dismissing:', err); }
    setActionInProgress(null);
  };

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir(field === 'timestamp' ? 'desc' : 'asc'); }
  };
  const clearFilters = () => {
    setTypeFilter('all'); setCollectionFilter(''); setUserSearch('');
    setDatePreset('all'); setStatusFilter('pending'); setSeverityFilter('all');
    setVisibleCount(PAGE_SIZE);
  };
  const hasActiveFilters = typeFilter !== 'all' || collectionFilter !== '' || userSearch !== '' || datePreset !== 'all' || statusFilter !== 'pending' || severityFilter !== 'all';
  const trendIcon = useMemo(() => {
    if (!kpis) return null;
    if (kpis.alertsToday > kpis.alertsYesterday) return <TrendingUpIcon fontSize="small" sx={{ color: 'error.main' }} />;
    if (kpis.alertsToday < kpis.alertsYesterday) return <TrendingDownIcon fontSize="small" sx={{ color: 'success.main' }} />;
    return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
  }, [kpis]);
  const handleExport = () => {
    const d = new Date();
    exportToCsv(filtered, `alertas-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`);
  };

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudieron cargar las alertas.">
      {kpis && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <KpiCard label="Alertas hoy" value={kpis.alertsToday} secondary={trendIcon} />
          <KpiCard label="Tipo más frecuente" value={kpis.topType} />
          <KpiCard label="Usuario más activo" value={kpis.topUser} secondary={kpis.topUserCount > 0 ? <Typography variant="caption" color="text.secondary">({kpis.topUserCount})</Typography> : undefined} />
          <KpiCard label="Total cargadas" value={kpis.total} />
        </Box>
      )}

      <Tabs value={innerTab} onChange={(_, v: 'alerts' | 'reincidentes') => setInnerTab(v)} sx={{ mb: 2 }}>
        <Tab value="alerts" label="Alertas" />
        <Tab value="reincidentes" label={
          <Badge badgeContent={reincidentesCount} color="error" max={99}>
            Reincidentes
          </Badge>
        } />
      </Tabs>

      {innerTab === 'alerts' && (
        <>
          <AlertsFilters
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            collectionFilter={collectionFilter}
            onCollectionFilterChange={setCollectionFilter}
            userSearch={userSearch}
            onUserSearchChange={setUserSearch}
            collections={collections}
            typeCounts={typeCounts}
            totalLogs={logs?.length ?? 0}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            onExport={handleExport}
            exportDisabled={filtered.length === 0}
          />

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {filtered.length} alerta{filtered.length !== 1 ? 's' : ''}{hasActiveFilters ? ' (filtrado)' : ''}
          </Typography>

          {filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {hasActiveFilters ? 'Sin resultados para los filtros seleccionados.' : 'Sin alertas de abuso.'}
            </Typography>
          ) : (
            <>
              <AlertsTable
                rows={visible}
                expandedId={expandedId}
                onExpand={setExpandedId}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                userAlertCounts={userAlertCounts}
                actionInProgress={actionInProgress}
                onReview={handleReview}
                onDismiss={handleDismiss}
              />
              {hasMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button variant="outlined" size="small" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                    Cargar más ({filtered.length - visibleCount} restantes)
                  </Button>
                </Box>
              )}
            </>
          )}
        </>
      )}

      {innerTab === 'reincidentes' && (
        <ReincidentesView logs={logs ?? []} />
      )}
    </AdminPanelWrapper>
  );
}
