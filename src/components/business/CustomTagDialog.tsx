import { memo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

interface CustomTagDialogProps {
  open: boolean;
  isEditing: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default memo(function CustomTagDialog({
  open,
  isEditing,
  value,
  onChange,
  onSave,
  onClose,
}: CustomTagDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? 'Editar etiqueta' : 'Agregar etiqueta'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Ej: Tiene estacionamiento"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 30))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            }
          }}
          helperText={`${value.length}/30`}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!value.trim()}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
});
