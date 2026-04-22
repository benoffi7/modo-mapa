import { Fragment } from 'react';
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
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS } from '../../../constants';
import { formatDateShort } from '../../../utils/formatDate';
import { SEVERITY_CONFIG, getSeverity } from './alertsHelpers';
import type { SortDir, SortField } from './alertsHelpers';
import type { AbuseLog } from '../../../types/admin';

export interface AlertsTableProps {
  rows: AbuseLog[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  userAlertCounts: Map<string, number>;
  actionInProgress: string | null;
  onReview: (logId: string, e: React.MouseEvent) => void;
  onDismiss: (logId: string, e: React.MouseEvent) => void;
}

export default function AlertsTable({
  rows,
  expandedId,
  onExpand,
  sortField,
  sortDir,
  onSort,
  userAlertCounts,
  actionInProgress,
  onReview,
  onDismiss,
}: AlertsTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>
              <TableSortLabel active={sortField === 'type'} direction={sortField === 'type' ? sortDir : 'asc'} onClick={() => onSort('type')}>
                Tipo
              </TableSortLabel>
            </TableCell>
            <TableCell>Severidad</TableCell>
            <TableCell>Usuario</TableCell>
            <TableCell>
              <TableSortLabel active={sortField === 'collection'} direction={sortField === 'collection' ? sortDir : 'asc'} onClick={() => onSort('collection')}>
                Colección
              </TableSortLabel>
            </TableCell>
            <TableCell>Detalle</TableCell>
            <TableCell>
              <TableSortLabel active={sortField === 'timestamp'} direction={sortField === 'timestamp' ? sortDir : 'desc'} onClick={() => onSort('timestamp')}>
                Fecha
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((log) => {
            const isExpanded = expandedId === log.id;
            const userTotal = userAlertCounts.get(log.userId) ?? 0;
            const severity = getSeverity(log);
            return (
              <Fragment key={log.id}>
                <TableRow
                  hover
                  sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                  onClick={() => onExpand(isExpanded ? null : log.id)}
                >
                  <TableCell padding="checkbox">
                    <IconButton size="small" aria-label={isExpanded ? 'Colapsar' : 'Expandir'}>
                      {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                  </TableCell>
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
                            <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon />} disabled={actionInProgress === log.id} onClick={(e) => onReview(log.id, e)}>
                              Revisar
                            </Button>
                            <Button size="small" variant="outlined" color="inherit" startIcon={<DeleteOutlineIcon />} disabled={actionInProgress === log.id} onClick={(e) => onDismiss(log.id, e)}>
                              Descartar
                            </Button>
                          </Box>
                        )}
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
  );
}
