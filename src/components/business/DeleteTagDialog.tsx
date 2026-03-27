import { memo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface DeleteTagDialogProps {
  open: boolean;
  tagLabel: string | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

export default memo(function DeleteTagDialog({
  open,
  tagLabel,
  onConfirm,
  onClose,
}: DeleteTagDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} role="alertdialog" aria-describedby="delete-tag-warning">
      <DialogTitle>Eliminar etiqueta</DialogTitle>
      <DialogContent>
        <Typography id="delete-tag-warning">
          {'\u00BF'}Eliminar etiqueta &ldquo;{tagLabel}&rdquo;?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          Eliminar
        </Button>
      </DialogActions>
    </Dialog>
  );
});
