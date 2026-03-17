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
    <Dialog open={open} onClose={onKeepEditing}>
      <DialogTitle>Descartar borrador?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Tenes texto sin enviar. Si cerras, se va a perder.
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
