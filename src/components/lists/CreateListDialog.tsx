import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MSG_LIST } from '../../constants/messages';
import { createList } from '../../services/sharedLists';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (listId: string, name: string, description: string) => void;
}

export default function CreateListDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setIsCreating(true);
    try {
      const listId = await createList(user.uid, name, desc);
      const createdName = name.trim();
      const createdDesc = desc.trim();
      setName('');
      setDesc('');
      toast.success(MSG_LIST.createSuccess);
      onClose();
      onCreated(listId, createdName, createdDesc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG_LIST.createError);
    }
    setIsCreating(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nueva lista</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth label="Nombre" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 50 } }} sx={{ mt: 1, mb: 2 }} />
        <TextField fullWidth label="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} multiline rows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleCreate} variant="contained" disabled={isCreating || !name.trim()}>
          {isCreating ? <CircularProgress size={20} /> : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
