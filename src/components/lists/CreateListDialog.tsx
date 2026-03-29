import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import InsertEmoticonOutlinedIcon from '@mui/icons-material/InsertEmoticonOutlined';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MSG_LIST } from '../../constants/messages';
import { createList } from '../../services/sharedLists';
import { getListIconById } from '../../constants/listIcons';
import type { ListIconOption } from '../../constants/listIcons';
import IconPicker from './IconPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (listId: string, name: string, description: string, icon?: string) => void;
}

export default function CreateListDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const iconOption = getListIconById(selectedIcon);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setIsCreating(true);
    try {
      const listId = await createList(user.uid, name, desc, selectedIcon);
      const createdName = name.trim();
      const createdDesc = desc.trim();
      const createdIcon = selectedIcon;
      setName('');
      setDesc('');
      setSelectedIcon(undefined);
      toast.success(MSG_LIST.createSuccess);
      onClose();
      onCreated(listId, createdName, createdDesc, createdIcon);
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
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={iconOption ? <Typography fontSize={18}>{iconOption.emoji}</Typography> : <InsertEmoticonOutlinedIcon />}
            onClick={() => setIconPickerOpen(true)}
          >
            {iconOption ? iconOption.label : 'Elegir icono'}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleCreate} variant="contained" disabled={isCreating || !name.trim()}>
          {isCreating ? <CircularProgress size={20} /> : 'Crear'}
        </Button>
      </DialogActions>
      <IconPicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(icon: ListIconOption) => setSelectedIcon(icon.id)}
        selectedId={selectedIcon}
      />
    </Dialog>
  );
}
