import { Fragment, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { reviewAbuseLog, dismissAbuseLog } from '../../../services/admin';
import { formatDateShort } from '../../../utils/formatDate';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS } from '../../../constants';
import { getSeverity, SEVERITY_CONFIG } from './alertsHelpers';
import type { AbuseLog } from '../../../types/admin';
import { logger } from '../../../utils/logger';

interface ReincidenteRow {
  userId: string;
  totalAlerts: number;
  topType: AbuseLog['type'];
  lastAlertDate: Date;
  pendingCount: number;
  alerts: AbuseLog[];
}

interface Props {
  logs: AbuseLog[];
}

const MIN_ALERTS_OPTIONS = [
  { key: 3, label: '> 3 alertas' },
  { key: 5, label: '> 5 alertas' },
  { key: 10, label: '> 10 alertas' },
];

export default function ReincidentesView({ logs }: Props) {
  const [minAlerts, setMinAlerts] = useState(3);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const reincidentes = useMemo(() => {
    const byUser = new Map<string, AbuseLog[]>();
    for (const log of logs) {
      const arr = byUser.get(log.userId) ?? [];
      arr.push(log);
      byUser.set(log.userId, arr);
    }

    const rows: ReincidenteRow[] = [];
    for (const [userId, userLogs] of byUser) {
      if (userLogs.length <= minAlerts) continue;

      // Most frequent type
      const typeCounts: Record<string, number> = {};
      for (const l of userLogs) typeCounts[l.type] = (typeCounts[l.type] ?? 0) + 1;
      const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0] as AbuseLog['type'];

      // Last alert
      const lastAlertDate = userLogs.reduce((max, l) => l.timestamp > max ? l.timestamp : max, userLogs[0].timestamp);

      // Pending count
      const pendingCount = userLogs.filter((l) => !l.reviewed && !l.dismissed).length;

      const sortedAlerts = [...userLogs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      rows.push({ userId, totalAlerts: userLogs.length, topType, lastAlertDate, pendingCount, alerts: sortedAlerts });
    }

    return rows.sort((a, b) => b.totalAlerts - a.totalAlerts);
  }, [logs, minAlerts]);

  const handleReview = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionInProgress(logId);
    try { await reviewAbuseLog(logId); }
    catch (err) { if (import.meta.env.DEV) logger.error('Error reviewing:', err); }
    setActionInProgress(null);
  };

  const handleDismiss = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setActionInProgress(logId);
    try { await dismissAbuseLog(logId); }
    catch (err) { if (import.meta.env.DEV) logger.error('Error dismissing:', err); }
    setActionInProgress(null);
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {MIN_ALERTS_OPTIONS.map((o) => (
          <Chip
            key={o.key}
            label={o.label}
            size="small"
            variant={minAlerts === o.key ? 'filled' : 'outlined'}
            color={minAlerts === o.key ? 'primary' : 'default'}
            onClick={() => setMinAlerts(o.key)}
          />
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {reincidentes.length} usuario{reincidentes.length !== 1 ? 's' : ''} con más de {minAlerts} alertas
      </Typography>

      {reincidentes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No hay usuarios con más de {minAlerts} alertas.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Usuario</TableCell>
                <TableCell>Total alertas</TableCell>
                <TableCell>Tipo frecuente</TableCell>
                <TableCell>Última alerta</TableCell>
                <TableCell>Pendientes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reincidentes.map((row) => {
                const isExpanded = expandedUserId === row.userId;
                return (
                  <Fragment key={row.userId}>
                    <TableRow
                      hover
                      sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                      onClick={() => setExpandedUserId(isExpanded ? null : row.userId)}
                    >
                      <TableCell padding="checkbox">
                        <IconButton size="small">{isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}</IconButton>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.userId.slice(0, 12)}</TableCell>
                      <TableCell>
                        <Chip label={row.totalAlerts} size="small" color="error" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={ABUSE_TYPE_LABELS[row.topType]} color={ABUSE_TYPE_COLORS[row.topType]} size="small" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateShort(row.lastAlertDate)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ color: row.pendingCount > 0 ? 'error.main' : 'text.secondary', fontWeight: row.pendingCount > 0 ? 600 : 400 }}
                        >
                          {row.pendingCount}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`history-${row.userId}`}>
                        <TableCell colSpan={6} sx={{ py: 0, px: 1 }}>
                          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Historial de {row.userId.slice(0, 12)} ({row.alerts.length} alertas)
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Tipo</TableCell>
                                  <TableCell>Severidad</TableCell>
                                  <TableCell>Colección</TableCell>
                                  <TableCell>Detalle</TableCell>
                                  <TableCell>Fecha</TableCell>
                                  <TableCell>Estado</TableCell>
                                  <TableCell>Acciones</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {row.alerts.map((alert) => {
                                  const severity = getSeverity(alert);
                                  const isPending = !alert.reviewed && !alert.dismissed;
                                  return (
                                    <TableRow key={alert.id}>
                                      <TableCell><Chip label={ABUSE_TYPE_LABELS[alert.type]} color={ABUSE_TYPE_COLORS[alert.type]} size="small" /></TableCell>
                                      <TableCell><Chip label={SEVERITY_CONFIG[severity].label} color={SEVERITY_CONFIG[severity].color} size="small" variant="outlined" /></TableCell>
                                      <TableCell>{alert.collection}</TableCell>
                                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.detail}</TableCell>
                                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateShort(alert.timestamp)}</TableCell>
                                      <TableCell>
                                        {alert.reviewed && <Chip label="Revisada" size="small" color="success" variant="outlined" />}
                                        {alert.dismissed && <Chip label="Descartada" size="small" variant="outlined" />}
                                        {isPending && <Chip label="Pendiente" size="small" color="warning" variant="outlined" />}
                                      </TableCell>
                                      <TableCell>
                                        {isPending && (
                                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <IconButton size="small" color="success" disabled={actionInProgress === alert.id} onClick={(e) => handleReview(alert.id, e)}>
                                              <CheckCircleOutlineIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" disabled={actionInProgress === alert.id} onClick={(e) => handleDismiss(alert.id, e)}>
                                              <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
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
      )}
    </>
  );
}
