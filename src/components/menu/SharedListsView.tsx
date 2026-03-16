import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ShareIcon from '@mui/icons-material/Share';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { useToast } from '../../context/ToastContext';
import {
  getSharedListsCollection,
  createList,
  deleteList,
  fetchListItems,
  removeBusinessFromList,
  toggleListPublic,
} from '../../services/sharedLists';
import { allBusinesses } from '../../hooks/useBusinesses';
import { getDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { sharedListConverter } from '../../config/converters';
import { CATEGORY_LABELS } from '../../types';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import type { SharedList, ListItem, Business } from '../../types';

interface Props {
  onNavigate: () => void;
  sharedListId?: string | undefined;
}

const MAX_LISTS = 10;

export default function SharedListsView({ onNavigate, sharedListId }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useSelection();
  const toast = useToast();

  const [lists, setLists] = useState<SharedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Map<string, ListItem[]>>(new Map());
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  // Shared list from deep link
  const [sharedList, setSharedList] = useState<SharedList | null>(null);
  const [sharedItems, setSharedItems] = useState<ListItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => {
    if (!sharedListId) return;
    let ignore = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch
    setLoadingShared(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.SHARED_LISTS, sharedListId).withConverter(sharedListConverter));
        if (ignore || !snap.exists()) { setLoadingShared(false); return; }
        const list = snap.data();
        setSharedList(list);
        const items = await fetchListItems(list.id);
        if (!ignore) setSharedItems(items);
      } catch { /* ignore */ }
      if (!ignore) setLoadingShared(false);
    })();
    return () => { ignore = true; };
  }, [sharedListId]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadLists = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const snap = await getDocs(
        query(getSharedListsCollection(), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc')),
      );
      setLists(snap.docs.map((d) => d.data()));
    } catch {
      /* ignore */
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount
    loadLists();
  }, [loadLists]);

  const handleRefresh = useCallback(async () => { await loadLists(); }, [loadLists]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setIsCreating(true);
    try {
      await createList(user.uid, newName, newDesc);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      toast.success('Lista creada');
      await loadLists();
    } catch (err) {
      console.error('Create list error:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setIsCreating(false);
  };

  const handleDelete = async (list: SharedList) => {
    if (!user) return;
    try {
      await deleteList(list.id, user.uid);
      toast.info('Lista eliminada');
      setLists((prev) => prev.filter((l) => l.id !== list.id));
      if (expandedId === list.id) setExpandedId(null);
    } catch {
      toast.error('No se pudo eliminar la lista');
    }
  };

  const handleTogglePublic = async (list: SharedList) => {
    try {
      await toggleListPublic(list.id, !list.isPublic);
      setLists((prev) => prev.map((l) => l.id === list.id ? { ...l, isPublic: !l.isPublic } : l));
      toast.success(list.isPublic ? 'Lista ahora es privada' : 'Lista ahora es pública');
    } catch {
      toast.error('No se pudo cambiar la visibilidad');
    }
  };

  const handleShare = (list: SharedList) => {
    const url = `${window.location.origin}/?list=${list.id}`;
    if (navigator.share) {
      navigator.share({ title: list.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success('Link copiado'));
    }
  };

  const handleToggleExpand = async (listId: string) => {
    if (expandedId === listId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(listId);
    if (!expandedItems.has(listId)) {
      setLoadingItems(listId);
      try {
        const items = await fetchListItems(listId);
        setExpandedItems((prev) => new Map(prev).set(listId, items));
      } catch {
        /* ignore */
      }
      setLoadingItems(null);
    }
  };

  const handleRemoveItem = async (listId: string, businessId: string) => {
    try {
      await removeBusinessFromList(listId, businessId);
      setExpandedItems((prev) => {
        const next = new Map(prev);
        const items = next.get(listId)?.filter((i) => i.businessId !== businessId) ?? [];
        next.set(listId, items);
        return next;
      });
      setLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, itemCount: Math.max(0, l.itemCount - 1) } : l)),
      );
    } catch {
      toast.error('No se pudo quitar el comercio');
    }
  };

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusiness(business);
    onNavigate();
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">Cargando...</Typography>
      </Box>
    );
  }

  // Show shared list from deep link
  if (sharedListId && (loadingShared || sharedList)) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        {loadingShared ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : sharedList ? (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              {sharedList.name}
            </Typography>
            {sharedList.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {sharedList.description}
              </Typography>
            )}
            <Chip label={`${sharedItems.length} comercio${sharedItems.length !== 1 ? 's' : ''}`} size="small" sx={{ mb: 1.5 }} />
            {sharedItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Lista vacía.</Typography>
            ) : (
              <List disablePadding dense>
                {sharedItems.map((item) => {
                  const business = allBusinesses.find((b) => b.id === item.businessId);
                  if (!business) return null;
                  return (
                    <ListItemButton key={item.id} onClick={() => handleSelectBusiness(business)} sx={{ borderRadius: 1 }}>
                      <ListItemText
                        primary={business.name}
                        secondary={`${CATEGORY_LABELS[business.category]} · ${business.address}`}
                        primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Lista no encontrada o es privada.
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <PullToRefreshWrapper onRefresh={handleRefresh}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {lists.length}/{MAX_LISTS} listas
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          disabled={lists.length >= MAX_LISTS}
        >
          Nueva lista
        </Button>
      </Box>

      {lists.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <BookmarkBorderIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No tenés listas todavía
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Creá una para organizar tus comercios favoritos
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {lists.map((list) => {
            const isExpanded = expandedId === list.id;
            const items = expandedItems.get(list.id) ?? [];
            return (
              <Box key={list.id}>
                <ListItemButton onClick={() => handleToggleExpand(list.id)} sx={{ pr: 1 }}>
                  <ListItemText
                    primary={list.name}
                    secondary={
                      <>
                        {list.description && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {list.description}
                          </Typography>
                        )}
                        <Chip
                          label={`${list.itemCount} comercio${list.itemCount !== 1 ? 's' : ''}`}
                          size="small"
                          component="span"
                          sx={{ fontSize: '0.7rem', height: 20, mt: 0.5, display: 'inline-flex' }}
                        />
                      </>
                    }
                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleTogglePublic(list); }} aria-label={list.isPublic ? 'Hacer privada' : 'Hacer pública'}>
                      {list.isPublic ? <PublicIcon fontSize="small" color="success" /> : <LockIcon fontSize="small" />}
                    </IconButton>
                    {list.isPublic && (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleShare(list); }} aria-label="Compartir lista">
                        <ShareIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(list); }} aria-label="Eliminar lista" sx={{ color: 'error.main' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </Box>
                </ListItemButton>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 3, pr: 1, pb: 1 }}>
                    {loadingItems === list.id ? (
                      <Box sx={{ py: 1, textAlign: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : items.length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ py: 1, display: 'block' }}>
                        Lista vacía. Agregá comercios desde el mapa.
                      </Typography>
                    ) : (
                      <List disablePadding dense>
                        {items.map((item) => {
                          const business = allBusinesses.find((b) => b.id === item.businessId);
                          if (!business) return null;
                          return (
                            <ListItemButton key={item.id} onClick={() => handleSelectBusiness(business)} sx={{ borderRadius: 1 }}>
                              <ListItemText
                                primary={business.name}
                                secondary={CATEGORY_LABELS[business.category]}
                                primaryTypographyProps={{ fontSize: '0.85rem' }}
                                secondaryTypographyProps={{ fontSize: '0.7rem' }}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleRemoveItem(list.id, item.businessId); }}
                                aria-label="Quitar de lista"
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </ListItemButton>
                          );
                        })}
                      </List>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </List>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nueva lista</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 50 } }}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Descripción (opcional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreate} variant="contained" disabled={isCreating || !newName.trim()}>
            {isCreating ? <CircularProgress size={20} /> : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </PullToRefreshWrapper>
  );
}
