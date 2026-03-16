import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getSharedListsCollection,
  createList,
  addBusinessToList,
  removeBusinessFromList,
  fetchListItems,
} from '../../services/sharedLists';
import { getDocs, query, where, orderBy } from 'firebase/firestore';
import type { SharedList } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}

export default function AddToListDialog({ open, onClose, businessId, businessName }: Props) {
  const { user } = useAuth();
  const toast = useToast();

  const [lists, setLists] = useState<SharedList[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Inline create
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    let ignore = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount
    setIsLoading(true);

    (async () => {
      try {
        const snap = await getDocs(
          query(getSharedListsCollection(), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc')),
        );
        if (ignore) return;
        const userLists = snap.docs.map((d) => d.data());
        setLists(userLists);

        const checked = new Set<string>();
        for (const list of userLists) {
          const items = await fetchListItems(list.id);
          if (items.some((item) => item.businessId === businessId)) {
            checked.add(list.id);
          }
        }
        if (!ignore) setCheckedIds(checked);
      } catch {
        /* ignore */
      }
      if (!ignore) setIsLoading(false);
    })();

    return () => { ignore = true; };
  }, [user, open, businessId]);

  const handleToggle = async (listId: string) => {
    setActionInProgress(listId);
    const isChecked = checkedIds.has(listId);
    try {
      if (isChecked) {
        await removeBusinessFromList(listId, businessId);
        setCheckedIds((prev) => { const next = new Set(prev); next.delete(listId); return next; });
        setLists((prev) => prev.map((l) => l.id === listId ? { ...l, itemCount: Math.max(0, l.itemCount - 1) } : l));
      } else {
        await addBusinessToList(listId, businessId);
        setCheckedIds((prev) => new Set(prev).add(listId));
        setLists((prev) => prev.map((l) => l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l));
      }
    } catch {
      toast.error('No se pudo actualizar la lista');
    }
    setActionInProgress(null);
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setIsCreating(true);
    try {
      const listId = await createList(user.uid, newName);
      // Add business to the new list immediately
      await addBusinessToList(listId, businessId);
      setNewName('');
      setShowCreate(false);
      toast.success('Lista creada y comercio agregado');
      // Reload lists
      const snap = await getDocs(
        query(getSharedListsCollection(), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc')),
      );
      setLists(snap.docs.map((d) => d.data()));
      setCheckedIds((prev) => new Set(prev).add(listId));
    } catch {
      toast.error('No se pudo crear la lista');
    }
    setIsCreating(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Guardar en lista
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {businessName}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ px: 1 }}>
        {isLoading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {lists.length === 0 && !showCreate && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                No tenés listas. Creá una para empezar.
              </Typography>
            )}
            <List disablePadding>
              {lists.map((list) => (
                <ListItemButton
                  key={list.id}
                  onClick={() => handleToggle(list.id)}
                  disabled={actionInProgress === list.id}
                  dense
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={checkedIds.has(list.id)}
                      disableRipple
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={list.name}
                    secondary={`${list.itemCount} comercio${list.itemCount !== 1 ? 's' : ''}`}
                    primaryTypographyProps={{ fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  {actionInProgress === list.id && <CircularProgress size={16} />}
                </ListItemButton>
              ))}
            </List>

            {/* Inline create */}
            {showCreate ? (
              <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1, alignItems: 'center' }}>
                <TextField
                  autoFocus
                  size="small"
                  placeholder="Nombre de la lista"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  sx={{ flex: 1 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim()}
                >
                  {isCreating ? <CircularProgress size={16} /> : 'Crear'}
                </Button>
              </Box>
            ) : (
              <Button
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => setShowCreate(true)}
                sx={{ mt: 1 }}
                disabled={lists.length >= 10}
              >
                Nueva lista
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
