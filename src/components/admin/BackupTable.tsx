import { memo } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import type { BackupEntry, ConfirmAction } from './backupTypes';
import { formatBackupDate } from './backupUtils';

interface BackupTableProps {
  backups: BackupEntry[];
  operating: boolean;
  onConfirmAction: (action: ConfirmAction) => void;
}

function BackupTable({ backups, operating, onConfirmAction }: BackupTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Lista de backups">
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {backups.map((backup) => (
            <TableRow key={backup.id}>
              <TableCell>{formatBackupDate(backup.createdAt)}</TableCell>
              <TableCell align="right">
                <Tooltip title="Restaurar backup">
                  <span>
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => onConfirmAction({ type: 'restore', backup })}
                      disabled={operating}
                      aria-label={`Restaurar backup del ${formatBackupDate(backup.createdAt)}`}
                    >
                      <RestoreIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Eliminar backup">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onConfirmAction({ type: 'delete', backup })}
                      disabled={operating}
                      aria-label={`Eliminar backup del ${formatBackupDate(backup.createdAt)}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default memo(BackupTable);
