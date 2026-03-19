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
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { useToast } from '../../context/ToastContext';
import { removeEditor } from '../../services/sharedLists';

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
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
          const data = snap.data();
          results.push({ uid, displayName: (data as { displayName?: string })?.displayName ?? 'Usuario' });
        } catch {
          results.push({ uid, displayName: 'Usuario' });
        }
      }
      if (!ignore) {
        setEditors(results);
        setIsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [open, editorIds]);

  const handleRemove = async (targetUid: string) => {
    setRemoving(targetUid);
    try {
      await removeEditor(listId, targetUid);
      setEditors((prev) => prev.filter((e) => e.uid !== targetUid));
      toast.success('Editor removido');
      onEditorRemoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo remover');
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
                    disabled={removing === editor.uid}
                    aria-label={`Remover ${editor.displayName}`}
                    sx={{ color: 'error.main' }}
                  >
                    {removing === editor.uid ? <CircularProgress size={16} /> : <RemoveCircleOutlineIcon fontSize="small" />}
                  </IconButton>
                }
              >
                <ListItemText
                  primary={editor.displayName}
                  secondary={editor.uid.slice(0, 8) + '...'}
                  primaryTypographyProps={{ fontSize: '0.9rem' }}
                  secondaryTypographyProps={{ fontSize: '0.7rem' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
