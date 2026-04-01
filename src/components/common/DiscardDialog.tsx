import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

interface DiscardDialogProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

export default function DiscardDialog({ open, onKeepEditing, onDiscard }: DiscardDialogProps) {
  return (
    <Dialog open={open} onClose={onKeepEditing} role="alertdialog" aria-describedby="discard-dialog-description">
      <DialogTitle>&iquest;Descartar borrador?</DialogTitle>
      <DialogContent>
        <DialogContentText id="discard-dialog-description">
          Tenés texto sin enviar. Si cerrás, se va a perder.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="error" variant="text" onClick={onDiscard}>
          Descartar
        </Button>
        <Button variant="contained" onClick={onKeepEditing} autoFocus>
          Seguir editando
        </Button>
      </DialogActions>
    </Dialog>
  );
}
