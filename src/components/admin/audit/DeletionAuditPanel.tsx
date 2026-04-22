import { Fragment, useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchDeletionAuditLogs } from '../../../services/admin/audit';
import { formatDateShort } from '../../../utils/formatDate';
import AdminPanelWrapper from '../AdminPanelWrapper';
import AuditKpiCards from './AuditKpiCards';
import {
  PAGE_SIZE,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDuration,
} from './auditHelpers';
import { MSG_COMMON } from '../../../constants/messages';
import type { DeletionAuditLogEntry } from '../../../types/admin';

type TypeFilter = DeletionAuditLogEntry['type'] | 'all';
type StatusFilter = DeletionAuditLogEntry['status'] | 'all';

export default function DeletionAuditPanel() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<DeletionAuditLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetcher = useCallback(async () => {
    const result = await fetchDeletionAuditLogs({ pageSize: PAGE_SIZE });
    setAllLogs(result.logs);
    setHasMore(result.hasMore);
    return result.logs;
  }, []);

  const { data: initialLogs, loading, error } = useAsyncData(fetcher);

  const logs = useMemo(
    () => (allLogs.length > 0 ? allLogs : (initialLogs ?? [])),
    [allLogs, initialLogs],
  );

  const filtered = useMemo(() => {
    let result = [...logs];
    if (typeFilter !== 'all') result = result.filter((l) => l.type === typeFilter);
    if (statusFilter !== 'all') result = result.filter((l) => l.status === statusFilter);
    return result;
  }, [logs, typeFilter, statusFilter]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || logs.length === 0) return;
    setLoadingMore(true);
    try {
      const lastLog = logs[logs.length - 1];
      const result = await fetchDeletionAuditLogs({
        pageSize: PAGE_SIZE,
        startAfter: lastLog.timestamp.toISOString(),
      });
      setAllLogs((prev) => [...prev, ...result.logs]);
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <AdminPanelWrapper loading={loading} error={error}>
      <AuditKpiCards logs={logs} />

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Tipo
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label="Todas"
              size="small"
              variant={typeFilter === 'all' ? 'filled' : 'outlined'}
              color={typeFilter === 'all' ? 'primary' : 'default'}
              onClick={() => setTypeFilter('all')}
            />
            {(['account_delete', 'anonymous_clean'] as const).map((t) => (
              <Chip
                key={t}
                label={TYPE_LABELS[t]}
                size="small"
                variant={typeFilter === t ? 'filled' : 'outlined'}
                color={typeFilter === t ? 'primary' : 'default'}
                onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              />
            ))}
          </Box>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Estado
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label="Todos"
              size="small"
              variant={statusFilter === 'all' ? 'filled' : 'outlined'}
              color={statusFilter === 'all' ? 'primary' : 'default'}
              onClick={() => setStatusFilter('all')}
            />
            {(['success', 'partial_failure', 'failure'] as const).map((s) => (
              <Chip
                key={s}
                label={STATUS_LABELS[s]}
                size="small"
                variant={statusFilter === s ? 'filled' : 'outlined'}
                color={statusFilter === s ? STATUS_COLORS[s] : 'default'}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              />
            ))}
          </Box>
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
      </Typography>

      {filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Sin registros de eliminación.
        </Typography>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Fecha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Colecciones</TableCell>
                  <TableCell>Duracion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        hover
                        sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <TableCell padding="checkbox">
                          <IconButton size="small">
                            {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateShort(log.timestamp)}</TableCell>
                        <TableCell>
                          <Chip label={TYPE_LABELS[log.type]} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip label={STATUS_LABELS[log.status]} color={STATUS_COLORS[log.status]} size="small" />
                        </TableCell>
                        <TableCell>{log.collectionsProcessed}/{log.collectionsProcessed + log.collectionsFailed.length}</TableCell>
                        <TableCell>{formatDuration(log.durationMs)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`detail-${log.id}`}>
                          <TableCell colSpan={6} sx={{ py: 0, px: 1 }}>
                            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
                              <Typography variant="subtitle2" gutterBottom>Detalle</Typography>
                              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  UID Hash: <code>{log.uidHash}</code>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Trigger: {log.triggeredBy}
                                </Typography>
                              </Box>

                              {log.collectionsFailed.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                  <Typography variant="caption" color="error.main" fontWeight="bold">
                                    Colecciones fallidas:
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                    {log.collectionsFailed.map((col) => (
                                      <Chip key={col} label={col} size="small" color="error" variant="outlined" />
                                    ))}
                                  </Box>
                                </Box>
                              )}

                              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <Typography variant="caption" color="text.secondary">
                                  Storage: {log.storageFilesDeleted} eliminados, {log.storageFilesFailed} fallidos
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Aggregates corregidos: {log.aggregatesCorrected ? 'Si' : 'No'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? MSG_COMMON.loading : MSG_COMMON.loadMore}
              </Button>
            </Box>
          )}
        </>
      )}
    </AdminPanelWrapper>
  );
}
