import { type ReactNode, useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { fetchAbuseLogs } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS } from '../../constants';
import AdminPanelWrapper from './AdminPanelWrapper';
import type { AbuseLog } from '../../types/admin';

type AbuseType = AbuseLog['type'];
type SortField = 'timestamp' | 'type' | 'collection';
type SortDir = 'asc' | 'desc';
type DatePreset = 'all' | 'today' | 'week' | 'month';

const ALL_TYPES: AbuseType[] = ['rate_limit', 'flagged', 'top_writers'];
const PAGE_SIZE = 20;

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Última semana' },
  { key: 'month', label: 'Último mes' },
];

// ---------------------------------------------------------------------------
// KpiCard – local component for KPI summary cards
// ---------------------------------------------------------------------------
function KpiCard({ label, value, secondary }: { label: string; value: string | number; secondary?: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140, flex: '1 1 0' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
          {secondary}
        </Box>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// computeKpis – derive KPI values from raw logs
// ---------------------------------------------------------------------------
interface KpiData {
  alertsToday: number;
  alertsYesterday: number;
  topType: string;
  topUser: string;
  topUserCount: number;
  total: number;
}

function computeKpis(logs: AbuseLog[]): KpiData {
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
    if (count > topTypeCount) {
      topTypeCount = count;
      topType = ABUSE_TYPE_LABELS[type as AbuseType] ?? type;
    }
  }

  let topUser = '-';
  let topUserCount = 0;
  for (const [user, count] of Object.entries(userCounts)) {
    if (count > topUserCount) {
      topUserCount = count;
      topUser = user.slice(0, 8);
    }
  }

  return { alertsToday, alertsYesterday, topType, topUser, topUserCount, total: logs.length };
}

// ---------------------------------------------------------------------------
// getDateThreshold – return Date threshold for a given preset or null
// ---------------------------------------------------------------------------
function getDateThreshold(preset: DatePreset): Date | null {
  if (preset === 'all') return null;
  const now = new Date();
  if (preset === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (preset === 'week') {
    return new Date(now.getTime() - 7 * 86_400_000);
  }
  // month
  return new Date(now.getTime() - 30 * 86_400_000);
}

// ---------------------------------------------------------------------------
// exportToCsv – generate and download a CSV file from logs
// ---------------------------------------------------------------------------
function exportToCsv(logs: AbuseLog[], filename: string): void {
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AbuseAlerts() {
  const fetcher = useCallback(() => fetchAbuseLogs(200), []);
  const { data: logs, loading, error } = useAsyncData(fetcher);

  const [typeFilter, setTypeFilter] = useState<AbuseType | 'all'>('all');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');

  // KPI summary
  const kpis = useMemo(() => {
    if (!logs) return null;
    return computeKpis(logs);
  }, [logs]);

  // Unique collections for filter chips
  const collections = useMemo(() => {
    if (!logs) return [];
    return [...new Set(logs.map((l) => l.collection))].sort();
  }, [logs]);

  // Counts per type
  const typeCounts = useMemo(() => {
    if (!logs) return { rate_limit: 0, flagged: 0, top_writers: 0 };
    const counts = { rate_limit: 0, flagged: 0, top_writers: 0 };
    for (const log of logs) counts[log.type]++;
    return counts;
  }, [logs]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!logs) return [];
    let result = logs;

    // Date preset filter
    const threshold = getDateThreshold(datePreset);
    if (threshold) {
      result = result.filter((l) => l.timestamp.getTime() >= threshold.getTime());
    }

    if (typeFilter !== 'all') {
      result = result.filter((l) => l.type === typeFilter);
    }
    if (collectionFilter) {
      result = result.filter((l) => l.collection === collectionFilter);
    }
    if (userSearch.trim()) {
      const q = userSearch.trim().toLowerCase();
      result = result.filter((l) => l.userId.toLowerCase().includes(q));
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'timestamp') {
        cmp = a.timestamp.getTime() - b.timestamp.getTime();
      } else if (sortField === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else {
        cmp = a.collection.localeCompare(b.collection);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [logs, datePreset, typeFilter, collectionFilter, userSearch, sortField, sortDir]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setCollectionFilter('');
    setUserSearch('');
    setDatePreset('all');
    setVisibleCount(PAGE_SIZE);
  };

  const hasActiveFilters =
    typeFilter !== 'all' || collectionFilter !== '' || userSearch !== '' || datePreset !== 'all';

  // Trend icon for today vs yesterday
  const trendIcon = useMemo(() => {
    if (!kpis) return null;
    if (kpis.alertsToday > kpis.alertsYesterday) {
      return <TrendingUpIcon fontSize="small" sx={{ color: 'error.main' }} />;
    }
    if (kpis.alertsToday < kpis.alertsYesterday) {
      return <TrendingDownIcon fontSize="small" sx={{ color: 'success.main' }} />;
    }
    return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
  }, [kpis]);

  const handleExport = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    exportToCsv(filtered, `alertas-${yyyy}-${mm}-${dd}.csv`);
  };

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando alertas.">
      {/* KPI Cards */}
      {kpis && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <KpiCard label="Alertas hoy" value={kpis.alertsToday} secondary={trendIcon} />
          <KpiCard label="Tipo más frecuente" value={kpis.topType} />
          <KpiCard
            label="Usuario más activo"
            value={kpis.topUser}
            secondary={
              kpis.topUserCount > 0 ? (
                <Typography variant="caption" color="text.secondary">
                  ({kpis.topUserCount})
                </Typography>
              ) : undefined
            }
          />
          <KpiCard label="Total cargadas" value={kpis.total} />
        </Box>
      )}

      {/* Date preset chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {DATE_PRESETS.map((preset) => (
          <Chip
            key={preset.key}
            label={preset.label}
            size="small"
            variant={datePreset === preset.key ? 'filled' : 'outlined'}
            color={datePreset === preset.key ? 'primary' : 'default'}
            onClick={() => setDatePreset(datePreset === preset.key ? 'all' : preset.key)}
          />
        ))}
      </Box>

      {/* Type filter chips with counts */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Badge
          badgeContent={logs?.length ?? 0}
          max={999}
          sx={{ '& .MuiBadge-badge': { bgcolor: 'text.primary', color: 'background.paper' } }}
        >
          <Chip
            label="Todas"
            variant={typeFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setTypeFilter('all')}
            size="small"
          />
        </Badge>
        {ALL_TYPES.map((type) => (
          <Badge key={type} badgeContent={typeCounts[type]} color={ABUSE_TYPE_COLORS[type]} max={999}>
            <Chip
              label={ABUSE_TYPE_LABELS[type]}
              color={ABUSE_TYPE_COLORS[type]}
              variant={typeFilter === type ? 'filled' : 'outlined'}
              onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              size="small"
            />
          </Badge>
        ))}
      </Box>

      {/* Collection filter + user search + export */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}>
        {collections.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {collections.map((col) => (
              <Chip
                key={col}
                label={col}
                size="small"
                variant={collectionFilter === col ? 'filled' : 'outlined'}
                onClick={() => setCollectionFilter(collectionFilter === col ? '' : col)}
              />
            ))}
          </Box>
        )}
        <TextField
          size="small"
          placeholder="Buscar por userId..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          sx={{ minWidth: 200, ml: 'auto' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {hasActiveFilters && (
          <Button size="small" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
        <Tooltip title="Exportar CSV">
          <span>
            <IconButton size="small" onClick={handleExport} disabled={filtered.length === 0}>
              <FileDownloadIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Results count */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {filtered.length} alerta{filtered.length !== 1 ? 's' : ''}
        {hasActiveFilters ? ' (filtrado)' : ''}
      </Typography>

      {/* Table */}
      {filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          {hasActiveFilters ? 'Sin resultados para los filtros seleccionados.' : 'Sin alertas de abuso.'}
        </Typography>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'type'}
                      direction={sortField === 'type' ? sortDir : 'asc'}
                      onClick={() => handleSort('type')}
                    >
                      Tipo
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'collection'}
                      direction={sortField === 'collection' ? sortDir : 'asc'}
                      onClick={() => handleSort('collection')}
                    >
                      Colección
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Detalle</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'timestamp'}
                      direction={sortField === 'timestamp' ? sortDir : 'desc'}
                      onClick={() => handleSort('timestamp')}
                    >
                      Fecha
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <TableRow
                      key={log.id}
                      hover
                      sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <TableCell padding="checkbox">
                        <IconButton size="small">
                          {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ABUSE_TYPE_LABELS[log.type]}
                          color={ABUSE_TYPE_COLORS[log.type]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {log.userId.slice(0, 12)}
                      </TableCell>
                      <TableCell>{log.collection}</TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.detail}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatDateShort(log.timestamp)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Expanded detail */}
          {visible.map((log) => (
            <Collapse key={`detail-${log.id}`} in={expandedId === log.id} timeout="auto" unmountOnExit>
              <Paper variant="outlined" sx={{ p: 2, my: 1, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" gutterBottom>Detalle completo</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {log.detail}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Usuario: {log.userId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Colección: {log.collection}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Fecha: {log.timestamp.toLocaleString()}
                  </Typography>
                </Box>
              </Paper>
            </Collapse>
          ))}

          {/* Load more */}
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Cargar más ({filtered.length - visibleCount} restantes)
              </Button>
            </Box>
          )}
        </>
      )}
    </AdminPanelWrapper>
  );
}
