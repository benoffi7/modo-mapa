import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { MSG_LIST, MSG_OFFLINE } from '../../constants/messages';
import { removeEditor, fetchEditorName } from '../../services/sharedLists';

interface Props {
  open: boolean;
  onClose: () => void;
  listId: string;
  editorIds: string[];
  onEditorRemoved: () => void;
}

interface EditorInfo {
  uid: string;
  displayName: string;
}

export default function EditorsDialog({ open, onClose, listId, editorIds, onEditorRemoved }: Props) {
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!open || editorIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state when dialog closes
      setEditors([]);
      setIsLoading(false);
      return;
    }
    let ignore = false;
    setIsLoading(true);
    (async () => {
      const results: EditorInfo[] = [];
      for (const uid of editorIds) {
        const displayName = await fetchEditorName(uid);
        results.push({ uid, displayName });
      }
      if (!ignore) {
        setEditors(results);
        setIsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [open, editorIds]);

  const handleRemove = async (targetUid: string) => {
    if (isOffline) {
      toast.warning(MSG_OFFLINE.noConnection);
      return;
    }
    setRemoving(targetUid);
    try {
      await removeEditor(listId, targetUid);
      setEditors((prev) => prev.filter((e) => e.uid !== targetUid));
      toast.success(MSG_LIST.editorRemoved);
      onEditorRemoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG_LIST.editorRemoveError);
    }
    setRemoving(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Editores</DialogTitle>
      <DialogContent sx={{ px: 1 }}>
        {isLoading ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : editors.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            No hay editores en esta lista.
          </Typography>
        ) : (
          <List disablePadding dense>
            {editors.map((editor) => (
              <ListItem
                key={editor.uid}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleRemove(editor.uid)}
                    disabled={removing === editor.uid || isOffline}
                    aria-label={`Remover ${editor.displayName}`}
                    sx={{ color: 'error.main' }}
                  >
                    {removing === editor.uid ? <CircularProgress size={16} /> : <RemoveCircleOutlineIcon fontSize="small" />}
                  </IconButton>
                }
              >
                <ListItemText
                  primary={editor.displayName}
                  secondary="Editor"
                  slotProps={{
                    primary: { sx: { fontSize: '0.9rem' } },
                    secondary: { sx: { fontSize: '0.7rem' } },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
