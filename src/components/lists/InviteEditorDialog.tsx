import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useToast } from '../../context/ToastContext';
import { MSG_LIST } from '../../constants/messages';
import { useConnectivity } from '../../context/ConnectivityContext';
import { inviteEditor } from '../../services/sharedLists';
import { withBusyFlag } from '../../utils/busyFlag';

interface Props {
  listId: string | null;
  onClose: () => void;
  onInvited: () => void;
}

export default function InviteEditorDialog({ listId, onClose, onInvited }: Props) {
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!listId || !email.trim()) return;
    setIsInviting(true);
    try {
      await withBusyFlag('list_editor_invite', async () => {
        await inviteEditor(listId, email.trim());
      });
      toast.success(MSG_LIST.invitationProcessed);
      setEmail('');
      onClose();
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG_LIST.editorInviteError);
    }
    setIsInviting(false);
  };

  const handleClose = () => { setEmail(''); onClose(); };

  return (
    <Dialog open={!!listId} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Invitar editor</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>El editor podrá agregar y quitar comercios de tu lista.</Typography>
        <TextField autoFocus fullWidth label="Email del usuario" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button onClick={handleInvite} variant="contained" disabled={isInviting || !email.trim() || isOffline} title={isOffline ? 'Requiere conexión' : undefined}>
          {isInviting ? <CircularProgress size={20} /> : 'Invitar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
