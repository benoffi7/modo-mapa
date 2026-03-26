import { useState, useEffect, useCallback } from 'react';
import { useListsSubTabRefresh } from '../../hooks/useTabRefresh';
import {
  Box, List, ListItemButton, ListItemText, IconButton, Typography, Button,
  Chip, CircularProgress, Collapse, Card, CardActionArea, CardContent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ShareIcon from '@mui/icons-material/Share';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditorsDialog from './EditorsDialog';
import SharedListDetailView from './SharedListDetailView';
import CreateListDialog from './CreateListDialog';
import InviteEditorDialog from './InviteEditorDialog';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { useToast } from '../../context/ToastContext';
import {
  deleteList,
  fetchListItems,
  removeBusinessFromList,
  toggleListPublic,
  fetchFeaturedLists,
  fetchSharedWithMe,
  fetchSharedList,
  fetchUserLists,
  fetchEditorName,
} from '../../services/sharedLists';
import { allBusinesses } from '../../hooks/useBusinesses';
import { CATEGORY_LABELS } from '../../types';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { MAX_LISTS } from '../../constants/lists';
import type { SharedList, ListItem, Business } from '../../types';
import { logger } from '../../utils/logger';

interface Props {
  onSelectBusiness: (business: Business) => void;
  sharedListId?: string | undefined;
  onRegisterBackHandler?: (handler: (() => boolean) | null) => void;
}

export default function SharedListsView({ onSelectBusiness, sharedListId, onRegisterBackHandler }: Props) {
  const { user } = useAuth();
  const { setActiveSharedListId } = useSelection();
  const toast = useToast();

  const [lists, setLists] = useState<SharedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Map<string, ListItem[]>>(new Map());
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  // Shared list from deep link or featured list click
  const [sharedList, setSharedList] = useState<SharedList | null>(null);
  const [sharedItems, setSharedItems] = useState<ListItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(!!sharedListId);

  // Featured lists & shared with me
  const [featuredLists, setFeaturedLists] = useState<SharedList[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedList[]>([]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);
  const [editorsDialogList, setEditorsDialogList] = useState<SharedList | null>(null);

  // Editor names for addedBy display
  const [editorNames, setEditorNames] = useState<Map<string, string>>(new Map());

  // Load a shared list by ID (deep link or featured click)
  const openSharedList = useCallback(async (listId: string) => {
    setLoadingShared(true);
    try {
      const list = await fetchSharedList(listId);
      if (!list) { setLoadingShared(false); return; }
      setSharedList(list);
      const items = await fetchListItems(listId);
      setSharedItems(items);
    } catch { /* ignore */ }
    setLoadingShared(false);
  }, []);

  useEffect(() => {
    if (!sharedListId) return;
    let ignore = false;
    fetchSharedList(sharedListId).then(async (list) => {
      if (ignore || !list) { if (!ignore) setLoadingShared(false); return; }
      if (!ignore) setSharedList(list);
      const items = await fetchListItems(list.id);
      if (!ignore) { setSharedItems(items); setLoadingShared(false); }
    }).catch((err) => { if (import.meta.env.DEV) logger.error('Failed to load shared list:', err); if (!ignore) setLoadingShared(false); });
    return () => { ignore = true; };
  }, [sharedListId]);

  useEffect(() => {
    fetchFeaturedLists().then(setFeaturedLists).catch((err) => logger.error('[SharedListsView] fetchFeaturedLists failed:', err));
    if (user) fetchSharedWithMe(user.uid).then(setSharedWithMe).catch((err) => logger.error('[SharedListsView] fetchSharedWithMe failed:', err));
  }, [user]);

  const loadLists = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      setLists(await fetchUserLists(user.uid));
    } catch { /* ignore */ }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    onRegisterBackHandler?.(() => {
      if (sharedList || loadingShared) {
        setSharedList(null);
        setSharedItems([]);
        setLoadingShared(false);
        loadLists();
        return true;
      }
      return false;
    });
    return () => onRegisterBackHandler?.(null);
  });

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    fetchUserLists(user.uid).then((result) => {
      if (!ignore) { setLists(result); setIsLoading(false); }
    }).catch((err) => { if (import.meta.env.DEV) logger.error('Failed to load user lists:', err); if (!ignore) setIsLoading(false); });
    return () => { ignore = true; };
  }, [user]);

  const handleRefresh = useCallback(async () => { await loadLists(); }, [loadLists]);
  useListsSubTabRefresh('listas', handleRefresh);

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
      navigator.share({ title: list.name, url }).catch((err) => logger.error('[SharedListsView] share failed:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success('Link copiado'));
    }
  };

  const handleToggleExpand = async (listId: string) => {
    if (expandedId === listId) { setExpandedId(null); return; }
    setExpandedId(listId);
    if (!expandedItems.has(listId)) {
      setLoadingItems(listId);
      try {
        const items = await fetchListItems(listId);
        setExpandedItems((prev) => new Map(prev).set(listId, items));
        const list = lists.find((l) => l.id === listId);
        if (list && list.editorIds.length > 0) {
          const uidsToFetch = [...new Set(items.map((i) => i.addedBy).filter(Boolean))].filter((uid) => !editorNames.has(uid));
          const names = await Promise.all(uidsToFetch.map((uid) => fetchEditorName(uid).then((name) => [uid, name] as const)));
          if (names.length > 0) setEditorNames((prev) => { const next = new Map(prev); for (const [uid, name] of names) next.set(uid, name); return next; });
        }
      } catch { /* ignore */ }
      setLoadingItems(null);
    }
  };

  const handleRemoveItem = async (listId: string, businessId: string) => {
    try {
      await removeBusinessFromList(listId, businessId);
      setExpandedItems((prev) => {
        const next = new Map(prev);
        next.set(listId, next.get(listId)?.filter((i) => i.businessId !== businessId) ?? []);
        return next;
      });
      setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, itemCount: Math.max(0, l.itemCount - 1) } : l)));
    } catch {
      toast.error('No se pudo quitar el comercio');
    }
  };

  const handleSelectBusiness = (business: Business, fromListId?: string) => {
    if (fromListId) setActiveSharedListId(fromListId);
    onSelectBusiness(business);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">Cargando...</Typography>
      </Box>
    );
  }

  // Show shared list from deep link or featured list click
  if ((sharedListId || sharedList) && (loadingShared || sharedList)) {
    return sharedList ? (
      <SharedListDetailView
        list={sharedList}
        items={sharedItems}
        loading={loadingShared}
        sharedListId={sharedListId}
        onSelectBusiness={handleSelectBusiness}
        onCopyComplete={() => { setSharedList(null); setSharedItems([]); loadLists(); }}
      />
    ) : (
      <Box sx={{ px: 2, py: 1 }}>
        {loadingShared ? (
          <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
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
      {/* Featured lists */}
      {featuredLists.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="overline" sx={{ px: 2, color: 'text.secondary' }}>Destacadas</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, px: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {featuredLists.map((fl) => (
              <Card key={fl.id} variant="outlined" sx={{ minWidth: 170, flexShrink: 0 }}>
                <CardActionArea onClick={() => openSharedList(fl.id)}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Chip label="Destacada" size="small" color="primary" sx={{ mb: 0.5, height: 20, fontSize: '0.65rem' }} />
                    <Typography variant="subtitle2" noWrap>{fl.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fl.itemCount} comercio{fl.itemCount !== 1 ? 's' : ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
        <Typography variant="body2" color="text.secondary">{lists.length}/{MAX_LISTS} listas</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} disabled={lists.length >= MAX_LISTS}>
          Nueva lista
        </Button>
      </Box>

      {lists.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <BookmarkBorderIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No tenés listas todavía</Typography>
          <Typography variant="caption" color="text.secondary">Creá una para organizar tus comercios favoritos</Typography>
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
                        <Chip label={`${list.itemCount} comercio${list.itemCount !== 1 ? 's' : ''}`} size="small" component="span" sx={{ fontSize: '0.7rem', height: 20, mt: 0.5, display: 'inline-flex' }} />
                      </>
                    }
                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    {list.editorIds.length > 0 && (
                      <Chip label={`${list.editorIds.length}`} icon={<GroupIcon />} size="small" variant="outlined" sx={{ height: 22, '& .MuiChip-icon': { fontSize: 14 }, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setEditorsDialogList(list); }} />
                    )}
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleTogglePublic(list); }} aria-label={list.isPublic ? 'Hacer privada' : 'Hacer pública'}>
                      {list.isPublic ? <PublicIcon fontSize="small" color="success" /> : <LockIcon fontSize="small" />}
                    </IconButton>
                    {list.isPublic && (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleShare(list); }} aria-label="Compartir lista">
                        <ShareIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setInviteOpen(list.id); }} aria-label="Invitar editor">
                      <PersonAddIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(list); }} aria-label="Eliminar lista" sx={{ color: 'error.main' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </Box>
                </ListItemButton>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 3, pr: 1, pb: 1 }}>
                    {loadingItems === list.id ? (
                      <Box sx={{ py: 1, textAlign: 'center' }}><CircularProgress size={20} /></Box>
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
                                secondary={
                                  <>
                                    {CATEGORY_LABELS[business.category]}
                                    {list.editorIds.length > 0 && item.addedBy && editorNames.has(item.addedBy) && (
                                      <Typography component="span" variant="caption" color="text.disabled">
                                        {' · '}{editorNames.get(item.addedBy)}
                                      </Typography>
                                    )}
                                  </>
                                }
                                primaryTypographyProps={{ fontSize: '0.85rem' }}
                                secondaryTypographyProps={{ fontSize: '0.7rem' }}
                              />
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRemoveItem(list.id, item.businessId); }} aria-label="Quitar de lista">
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

      {/* Shared with me */}
      {sharedWithMe.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="overline" sx={{ px: 2, color: 'text.secondary' }}>Compartidas conmigo</Typography>
          <List disablePadding>
            {sharedWithMe.map((list) => (
              <ListItemButton key={list.id} onClick={() => openSharedList(list.id)} sx={{ pr: 1 }}>
                <ListItemText
                  primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><GroupIcon fontSize="small" color="action" /><span>{list.name}</span></Box>}
                  secondary={`${list.itemCount} comercio${list.itemCount !== 1 ? 's' : ''}`}
                  primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
                  secondaryTypographyProps={{ fontSize: '0.7rem' }}
                />
                <Chip label="Colaborativa" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      <CreateListDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadLists} />
      <InviteEditorDialog listId={inviteOpen} onClose={() => setInviteOpen(null)} onInvited={loadLists} />
      <EditorsDialog
        open={!!editorsDialogList}
        onClose={() => setEditorsDialogList(null)}
        listId={editorsDialogList?.id ?? ''}
        editorIds={editorsDialogList?.editorIds ?? []}
        onEditorRemoved={() => { setEditorsDialogList(null); loadLists(); }}
      />
    </PullToRefreshWrapper>
  );
}
