import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { MAX_DISPLAY_NAME_LENGTH } from '../../constants/validation';
import { withBusyFlag } from '../../utils/busyFlag';

interface EditDisplayNameDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function EditDisplayNameDialog({ open, onClose }: EditDisplayNameDialogProps) {
  const { displayName, setDisplayName } = useAuth();
  const [nameValue, setNameValue] = useState(displayName || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    setIsSaving(true);
    await withBusyFlag('profile_save', async () => {
      await setDisplayName(trimmed);
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Editar nombre</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
          slotProps={{ htmlInput: { maxLength: MAX_DISPLAY_NAME_LENGTH } }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isSaving || !nameValue.trim()}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
