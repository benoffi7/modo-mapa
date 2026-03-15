import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import TableSortLabel from '@mui/material/TableSortLabel';
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { fetchAbuseLogs } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS } from '../../constants';
import AdminPanelWrapper from './AdminPanelWrapper';
import type { AbuseLog } from '../../types/admin';

type AbuseType = AbuseLog['type'];
type SortField = 'timestamp' | 'type' | 'collection';
type SortDir = 'asc' | 'desc';

const ALL_TYPES: AbuseType[] = ['rate_limit', 'flagged', 'top_writers'];
const PAGE_SIZE = 20;

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
  }, [logs, typeFilter, collectionFilter, userSearch, sortField, sortDir]);

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
    setVisibleCount(PAGE_SIZE);
  };

  const hasActiveFilters = typeFilter !== 'all' || collectionFilter !== '' || userSearch !== '';

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando alertas.">
      {/* Type filter chips with counts */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Badge badgeContent={logs?.length ?? 0} color="default" max={999}>
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

      {/* Collection filter + user search */}
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
