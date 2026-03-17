import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { reviewAbuseLog, dismissAbuseLog } from '../../services/admin';
import { useAbuseLogsRealtime } from '../../hooks/useAbuseLogsRealtime';
import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/formatDate';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS } from '../../constants';
import AdminPanelWrapper from './AdminPanelWrapper';
import KpiCard from './alerts/KpiCard';
import ReincidentesView from './alerts/ReincidentesView';
import {
  computeKpis, getDateThreshold, exportToCsv, getSeverity,
  ALL_TYPES, PAGE_SIZE, DATE_PRESETS, STATUS_OPTIONS,
  SEVERITY_CONFIG, SEVERITY_FILTER_OPTIONS,
} from './alerts/alertsHelpers';
import type { AbuseType, SortField, SortDir, DatePreset, StatusFilter, SeverityFilter } from './alerts/alertsHelpers';

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

  // Toast for new alerts
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
    if (!logs) return { rate_limit: 0, flagged: 0, top_writers: 0 };
    const counts = { rate_limit: 0, flagged: 0, top_writers: 0 };
    for (const log of logs) counts[log.type]++;
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
      let cmp = 0;
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
    catch (err) { if (import.meta.env.DEV) console.error('Error reviewing:', err); }
    setActionInProgress(null);
  };

  const handleDismiss = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionInProgress(logId);
    try { await dismissAbuseLog(logId); }
    catch (err) { if (import.meta.env.DEV) console.error('Error dismissing:', err); }
    setActionInProgress(null);
  };

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir(field === 'timestamp' ? 'desc' : 'asc'); }
  };
  const clearFilters = () => { setTypeFilter('all'); setCollectionFilter(''); setUserSearch(''); setDatePreset('all'); setStatusFilter('pending'); setSeverityFilter('all'); setVisibleCount(PAGE_SIZE); };
  const hasActiveFilters = typeFilter !== 'all' || collectionFilter !== '' || userSearch !== '' || datePreset !== 'all' || statusFilter !== 'pending' || severityFilter !== 'all';
  const trendIcon = useMemo(() => {
    if (!kpis) return null;
    if (kpis.alertsToday > kpis.alertsYesterday) return <TrendingUpIcon fontSize="small" sx={{ color: 'error.main' }} />;
    if (kpis.alertsToday < kpis.alertsYesterday) return <TrendingDownIcon fontSize="small" sx={{ color: 'success.main' }} />;
    return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
  }, [kpis]);
  const handleExport = () => { const d = new Date(); exportToCsv(filtered, `alertas-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`); };

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando alertas.">
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            {/* Row 1: Periodo + Estado */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Periodo</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {DATE_PRESETS.map((p) => <Chip key={p.key} label={p.label} size="small" variant={datePreset === p.key ? 'filled' : 'outlined'} color={datePreset === p.key ? 'primary' : 'default'} onClick={() => setDatePreset(datePreset === p.key ? 'all' : p.key)} />)}
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Estado</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map((o) => <Chip key={o.key} label={o.label} size="small" variant={statusFilter === o.key ? 'filled' : 'outlined'} color={statusFilter === o.key ? o.color : 'default'} onClick={() => setStatusFilter(o.key)} />)}
              </Box>
            </Box>

            {/* Row 2: Tipo + Severidad */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Tipo</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Badge badgeContent={logs?.length ?? 0} max={999} sx={{ '& .MuiBadge-badge': { bgcolor: 'text.primary', color: 'background.paper' } }}>
                  <Chip label="Todas" variant={typeFilter === 'all' ? 'filled' : 'outlined'} onClick={() => setTypeFilter('all')} size="small" />
                </Badge>
                {ALL_TYPES.map((type) => (
                  <Badge key={type} badgeContent={typeCounts[type]} color={ABUSE_TYPE_COLORS[type]} max={999}>
                    <Chip label={ABUSE_TYPE_LABELS[type]} color={ABUSE_TYPE_COLORS[type]} variant={typeFilter === type ? 'filled' : 'outlined'} onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)} size="small" />
                  </Badge>
                ))}
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Severidad</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {SEVERITY_FILTER_OPTIONS.map((o) => <Chip key={o.key} label={o.label} size="small" variant={severityFilter === o.key ? 'filled' : 'outlined'} color={severityFilter === o.key && o.key !== 'all' ? SEVERITY_CONFIG[o.key].color : 'default'} onClick={() => setSeverityFilter(o.key)} />)}
              </Box>
            </Box>

            {/* Row 3: Colección + búsqueda + acciones — full width */}
            <Box sx={{ gridColumn: { md: '1 / -1' }, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              {collections.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Colección</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {collections.map((col) => <Chip key={col} label={col} size="small" variant={collectionFilter === col ? 'filled' : 'outlined'} onClick={() => setCollectionFilter(collectionFilter === col ? '' : col)} />)}
                  </Box>
                </Box>
              )}
              <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" placeholder="Buscar por userId..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} sx={{ minWidth: 200 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
                {hasActiveFilters && <Button size="small" onClick={clearFilters}>Limpiar</Button>}
                <Tooltip title="Exportar CSV"><span><IconButton size="small" onClick={handleExport} disabled={filtered.length === 0}><FileDownloadIcon fontSize="small" /></IconButton></span></Tooltip>
              </Box>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>{filtered.length} alerta{filtered.length !== 1 ? 's' : ''}{hasActiveFilters ? ' (filtrado)' : ''}</Typography>

          {filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{hasActiveFilters ? 'Sin resultados para los filtros seleccionados.' : 'Sin alertas de abuso.'}</Typography>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell><TableSortLabel active={sortField === 'type'} direction={sortField === 'type' ? sortDir : 'asc'} onClick={() => handleSort('type')}>Tipo</TableSortLabel></TableCell>
                      <TableCell>Severidad</TableCell>
                      <TableCell>Usuario</TableCell>
                      <TableCell><TableSortLabel active={sortField === 'collection'} direction={sortField === 'collection' ? sortDir : 'asc'} onClick={() => handleSort('collection')}>Colección</TableSortLabel></TableCell>
                      <TableCell>Detalle</TableCell>
                      <TableCell><TableSortLabel active={sortField === 'timestamp'} direction={sortField === 'timestamp' ? sortDir : 'desc'} onClick={() => handleSort('timestamp')}>Fecha</TableSortLabel></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visible.map((log) => {
                      const isExpanded = expandedId === log.id;
                      const userTotal = userAlertCounts.get(log.userId) ?? 0;
                      const severity = getSeverity(log);
                      return (
                        <>
                          <TableRow key={log.id} hover sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }} onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                            <TableCell padding="checkbox"><IconButton size="small">{isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}</IconButton></TableCell>
                            <TableCell><Chip label={ABUSE_TYPE_LABELS[log.type]} color={ABUSE_TYPE_COLORS[log.type]} size="small" /></TableCell>
                            <TableCell><Chip label={SEVERITY_CONFIG[severity].label} color={SEVERITY_CONFIG[severity].color} size="small" variant="outlined" /></TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.userId.slice(0, 12)}</TableCell>
                            <TableCell>{log.collection}</TableCell>
                            <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateShort(log.timestamp)}</TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`detail-${log.id}`}>
                              <TableCell colSpan={7} sx={{ py: 0, px: 1 }}>
                                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
                                  <Typography variant="subtitle2" gutterBottom>Detalle completo</Typography>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{log.detail}</Typography>
                                  <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Typography variant="caption" color="text.secondary">Usuario: {log.userId}</Typography>
                                    <Typography variant="caption" color="text.secondary">Colección: {log.collection}</Typography>
                                    <Typography variant="caption" color="text.secondary">Fecha: {log.timestamp.toLocaleString()}</Typography>
                                    <Chip label={`${userTotal} alerta${userTotal !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                                    {userTotal > 3 && <Chip icon={<WarningAmberIcon />} label="Reincidente" size="small" color="error" variant="outlined" />}
                                    {log.reviewed && <Chip label="Revisada" size="small" color="success" variant="outlined" />}
                                    {log.dismissed && <Chip label="Descartada" size="small" variant="outlined" />}
                                  </Box>
                                  {!log.reviewed && !log.dismissed && (
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                      <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon />} disabled={actionInProgress === log.id} onClick={(e) => handleReview(log.id, e)}>Revisar</Button>
                                      <Button size="small" variant="outlined" color="inherit" startIcon={<DeleteOutlineIcon />} disabled={actionInProgress === log.id} onClick={(e) => handleDismiss(log.id, e)}>Descartar</Button>
                                    </Box>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {hasMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button variant="outlined" size="small" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>Cargar más ({filtered.length - visibleCount} restantes)</Button>
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
