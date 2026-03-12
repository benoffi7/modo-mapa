import { memo } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import type { ConfirmAction } from './backupTypes';
import { formatBackupDate } from './backupUtils';

interface BackupConfirmDialogProps {
  confirmAction: ConfirmAction | null;
  onClose: () => void;
  onConfirm: () => void;
}

function BackupConfirmDialog({ confirmAction, onClose, onConfirm }: BackupConfirmDialogProps) {
  return (
    <Dialog
      open={confirmAction !== null}
      onClose={onClose}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <DialogTitle id="confirm-dialog-title">
        {confirmAction?.type === 'restore' ? 'Restaurar backup' : 'Eliminar backup'}
      </DialogTitle>
      <DialogContent>
        {confirmAction?.type === 'restore' ? (
          <>
            <DialogContentText id="confirm-dialog-description">
              Esta accion sobrescribira los datos actuales con el backup del{' '}
              <strong>{confirmAction ? formatBackupDate(confirmAction.backup.createdAt) : ''}</strong>.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1 }}>
              Se creara un backup de seguridad automaticamente antes de restaurar.
            </DialogContentText>
          </>
        ) : (
          <>
            <DialogContentText id="confirm-dialog-description">
              Se eliminara permanentemente el backup del{' '}
              <strong>{confirmAction ? formatBackupDate(confirmAction.backup.createdAt) : ''}</strong>.
            </DialogContentText>
            <DialogContentText sx={{ mt: 1, fontWeight: 'bold' }}>
              Esta operacion NO es reversible.
            </DialogContentText>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmAction?.type === 'restore' ? 'warning' : 'error'}
          variant="contained"
        >
          {confirmAction?.type === 'restore' ? 'Restaurar' : 'Eliminar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default memo(BackupConfirmDialog);
