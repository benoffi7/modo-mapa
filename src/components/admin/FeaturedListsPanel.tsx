import { useCallback, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { MSG_ADMIN, MSG_OFFLINE } from '../../constants/messages';
import AdminPanelWrapper from './AdminPanelWrapper';
import ListStatsSection from './ListStatsSection';
import { fetchListItems } from '../../services/sharedLists';
import { fetchPublicLists, toggleFeaturedList } from '../../services/adminFeatured';
import { adminDeleteListItem } from '../../services/admin';
import { fetchUserDisplayNames } from '../../services/users';
import { trackEvent } from '../../utils/analytics';
import {
  EVT_ADMIN_LIST_ITEM_DELETED,
  EVT_ADMIN_LIST_ITEMS_INSPECTED,
} from '../../constants/analyticsEvents/admin';
import { getBusinessById } from '../../utils/businessMap';
import { CATEGORY_LABELS } from '../../constants/business';
import { CHIP_SMALL_SX } from '../../theme/cards';
import { logger } from '../../utils/logger';
import type { SharedList, ListItem as ListItemType } from '../../types';

const ITEMS_TRUNCATE_LIMIT = 50;

interface DeleteDialogState {
  item: ListItemType;
  list: SharedList;
  businessName: string;
}

interface FirebaseFunctionsError extends Error {
  code?: string;
}

function isAlreadyDeletedError(err: unknown): boolean {
  const code = (err as FirebaseFunctionsError | undefined)?.code;
  return code === 'functions/not-found' || code === 'not-found';
}

export default function FeaturedListsPanel() {
  const fetcher = useCallback(() => fetchPublicLists(), []);
  const { data, loading, error, refetch } = useAsyncData(fetcher);
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Map<string, ListItemType[]>>(new Map());
  const [realItemCounts, setRealItemCounts] = useState<Map<string, number>>(new Map());
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  // Optimistic local override of `itemCount` after a successful delete —
  // avoids re-running fetchPublicLists which reorders rows and causes flicker.
  const [localItemCounts, setLocalItemCounts] = useState<Map<string, number>>(new Map());
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dedup `admin_list_items_inspected`: emit once per listId per mount.
  // When the panel unmounts (admin leaves "Featured Lists" tab) the ref
  // resets — that's a deliberate trade-off for "new moderation session".
  const inspectedListsRef = useRef<Set<string>>(new Set());

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog) return;
    const { item, list } = deleteDialog;
    setDeleting(true);
    try {
      await adminDeleteListItem(item.id);
      trackEvent(EVT_ADMIN_LIST_ITEM_DELETED, { listId: list.id, itemId: item.id });
      toast.success(MSG_ADMIN.listItemDeleteSuccess);
      // Drop the item from the expanded list locally so the row disappears
      // immediately. itemCount is decremented optimistically.
      setExpandedItems((prev) => {
        const current = prev.get(list.id) ?? [];
        return new Map(prev).set(
          list.id,
          current.filter((i) => i.id !== item.id),
        );
      });
      setRealItemCounts((prev) => {
        const current = prev.get(list.id);
        if (current === undefined) return prev;
        return new Map(prev).set(list.id, Math.max(0, current - 1));
      });
      setLocalItemCounts((prev) => {
        const current = prev.get(list.id) ?? list.itemCount;
        return new Map(prev).set(list.id, Math.max(0, current - 1));
      });
      setDeleteDialog(null);
    } catch (err) {
      if (isAlreadyDeletedError(err)) {
        toast.info(MSG_ADMIN.listItemAlreadyDeleted);
        setDeleteDialog(null);
        refetch();
      } else {
        logger.error('adminDeleteListItem failed', err);
        toast.error(MSG_ADMIN.listItemDeleteError);
      }
    } finally {
      setDeleting(false);
    }
  }, [deleteDialog, refetch, toast]);

  const handleToggle = async (list: SharedList) => {
    setToggling(list.id);
    try {
      await toggleFeaturedList(list.id, !list.featured);
      toast.success(MSG_ADMIN.featuredToggleSuccess(list.featured));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG_ADMIN.featuredToggleError);
    }
    setToggling(null);
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
        const realCount = items.length;
        const truncated = items.slice(0, ITEMS_TRUNCATE_LIMIT);
        setExpandedItems((prev) => new Map(prev).set(listId, truncated));
        setRealItemCounts((prev) => new Map(prev).set(listId, realCount));

        if (!inspectedListsRef.current.has(listId)) {
          trackEvent(EVT_ADMIN_LIST_ITEMS_INSPECTED, { listId, itemCount: realCount });
          inspectedListsRef.current.add(listId);
        }

        // Resolve `addedBy` -> displayName for items we don't have yet.
        const uids = [
          ...new Set(
            truncated
              .map((i) => i.addedBy)
              .filter((uid): uid is string => Boolean(uid)),
          ),
        ].filter((uid) => !displayNames.has(uid));
        if (uids.length > 0) {
          try {
            const newNames = await fetchUserDisplayNames(uids);
            setDisplayNames((prev) => {
              const next = new Map(prev);
              for (const [uid, name] of newNames) next.set(uid, name);
              return next;
            });
          } catch (err) {
            logger.warn('FeaturedListsPanel fetchUserDisplayNames failed', err);
          }
        }
      } catch (err) {
        logger.warn('FeaturedListsPanel fetchListItems failed', err);
      }
      setLoadingItems(null);
    }
  };

  return (
    <Box>
      <ListStatsSection />
      <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudieron cargar las listas destacadas.">
        <Typography variant="h6" sx={{ mb: 2 }}>
        <StarIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Listas Destacadas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Solo listas públicas pueden marcarse como destacadas. Las listas destacadas aparecen en la sección superior de "Mis Listas" para todos los usuarios.
      </Typography>

      {!data || data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay listas públicas.
        </Typography>
      ) : (
        <List>
          {data.map((list) => {
            const isExpanded = expandedId === list.id;
            const items = expandedItems.get(list.id) ?? [];
            return (
              <Box key={list.id}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    <Switch
                      edge="end"
                      checked={list.featured}
                      onChange={() => handleToggle(list)}
                      disabled={toggling === list.id}
                    />
                  }
                >
                  <ListItemButton onClick={() => handleToggleExpand(list.id)} sx={{ pr: 8 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {list.name}
                          {list.featured && <Chip label="Destacada" size="small" color="primary" />}
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </Box>
                      }
                      secondary={`${localItemCounts.get(list.id) ?? list.itemCount} comercios · Owner: ${list.ownerId.slice(0, 8)}…`}
                    />
                  </ListItemButton>
                </ListItem>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 4, pr: 2, pb: 1 }}>
                    {loadingItems === list.id ? (
                      <Box sx={{ py: 1, textAlign: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : items.length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ py: 1, display: 'block' }}>
                        Lista vacía.
                      </Typography>
                    ) : (
                      <>
                        <List disablePadding dense>
                          {items.map((item) => {
                            const business = getBusinessById(item.businessId);
                            if (!business) return null;
                            const isOwner = item.addedBy === list.ownerId;
                            const resolvedName =
                              displayNames.get(item.addedBy) ?? `${item.addedBy.slice(0, 8)}…`;
                            return (
                              <ListItem
                                key={item.id}
                                disablePadding
                                sx={{ flexDirection: 'column', alignItems: 'flex-start' }}
                                secondaryAction={
                                  <Tooltip title={isOffline ? MSG_OFFLINE.requiresConnection : ''}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        edge="end"
                                        disabled={isOffline}
                                        aria-label={`Eliminar ${business.name} de ${list.name}`}
                                        onClick={() =>
                                          setDeleteDialog({ item, list, businessName: business.name })
                                        }
                                        sx={{ p: 1 }}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                }
                              >
                                <ListItemText
                                  primary={business.name}
                                  secondary={`${CATEGORY_LABELS[business.category]} · ${business.address}`}
                                  slotProps={{
                                    primary: { sx: { fontSize: '0.85rem' } },
                                    secondary: { sx: { fontSize: '0.75rem' } },
                                  }}
                                  sx={{ pl: 1, py: 0.5, width: '100%', pr: 5 }}
                                />
                                <Box sx={{ pl: 1, pb: 0.5 }}>
                                  <Chip
                                    size="small"
                                    sx={CHIP_SMALL_SX}
                                    label={`${resolvedName} ${isOwner ? '(Owner)' : '(Editor)'}`}
                                  />
                                </Box>
                              </ListItem>
                            );
                          })}
                        </List>
                        {(() => {
                          const realCount = realItemCounts.get(list.id) ?? items.length;
                          if (realCount > ITEMS_TRUNCATE_LIMIT) {
                            return (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                aria-live="polite"
                                sx={{ display: 'block', pl: 1, pt: 0.5 }}
                              >
                                Mostrando {ITEMS_TRUNCATE_LIMIT} de {realCount} — usar Cloud Console para casos extremos.
                              </Typography>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </List>
      )}
      </AdminPanelWrapper>

      <Dialog
        open={deleteDialog !== null}
        onClose={() => {
          if (!deleting) setDeleteDialog(null);
        }}
        role="alertdialog"
        aria-labelledby="delete-list-item-title"
        aria-describedby="delete-list-item-body"
      >
        <DialogTitle id="delete-list-item-title">
          {deleteDialog
            ? `¿Eliminar ${deleteDialog.businessName} de ${deleteDialog.list.name}?`
            : ''}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-list-item-body">
            Esta acción elimina el item de la lista y decrementa el contador. El abuseLog queda auditado.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleting || isOffline}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
