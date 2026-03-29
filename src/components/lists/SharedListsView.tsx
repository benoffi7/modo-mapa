import { useState, useEffect, useCallback } from 'react';
import { useListsSubTabRefresh } from '../../hooks/useTabRefresh';
import {
  Box, Typography, CircularProgress, CardActionArea, CardContent, Chip,
} from '@mui/material';
import { cardSx } from '../../theme/cards';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import CreateListDialog from './CreateListDialog';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import ListCardGrid from '../lists/ListCardGrid';
import ListDetailScreen from '../lists/ListDetailScreen';
import { useAuth } from '../../context/AuthContext';
import {
  fetchFeaturedLists,
  fetchSharedList,
  fetchUserLists,
} from '../../services/sharedLists';
import { MAX_LISTS } from '../../constants/lists';
import { MSG_LIST } from '../../constants/messages';
import type { SharedList } from '../../types';
import { logger } from '../../utils/logger';

interface Props {
  sharedListId?: string | undefined;
  onRegisterBackHandler?: (handler: (() => boolean) | null) => void;
}

export default function SharedListsView({ sharedListId, onRegisterBackHandler }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<SharedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredLists, setFeaturedLists] = useState<SharedList[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<SharedList | null>(null);

  // Deep link support
  useEffect(() => {
    if (!sharedListId) return;
    fetchSharedList(sharedListId).then((list) => {
      if (list) setSelectedList(list);
    }).catch((err) => logger.error('[SharedListsView] fetchSharedList failed:', err));
  }, [sharedListId]);

  // Back handler for parent navigation
  useEffect(() => {
    onRegisterBackHandler?.(() => {
      if (selectedList) {
        setSelectedList(null);
        return true;
      }
      return false;
    });
    return () => onRegisterBackHandler?.(null);
  }, [selectedList, onRegisterBackHandler]);

  const loadLists = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      setLists(await fetchUserLists(user.uid));
    } catch (err) {
      logger.error('[SharedListsView] fetchUserLists failed:', err);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    fetchUserLists(user.uid).then((result) => {
      if (!ignore) { setLists(result); setIsLoading(false); }
    }).catch((err) => { logger.error('[SharedListsView] fetchUserLists failed:', err); if (!ignore) setIsLoading(false); });
    return () => { ignore = true; };
  }, [user]);

  useEffect(() => {
    let ignore = false;
    fetchFeaturedLists().then((result) => { if (!ignore) setFeaturedLists(result); }).catch((err) => logger.error('[SharedListsView] fetchFeaturedLists failed:', err));
    return () => { ignore = true; };
  }, []);

  const handleRefresh = useCallback(async () => { await loadLists(); }, [loadLists]);
  useListsSubTabRefresh('listas', handleRefresh);

  // Detail view
  if (selectedList) {
    return (
      <ListDetailScreen
        list={selectedList}
        onBack={(updated?: Partial<SharedList>) => {
          setSelectedList(null);
          if (updated?.id) {
            setLists((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
          }
        }}
        onDeleted={() => {
          const deletedId = selectedList.id;
          setSelectedList(null);
          setLists((prev) => prev.filter((l) => l.id !== deletedId));
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
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
              <Box key={fl.id} sx={{ ...cardSx, minWidth: 170, flexShrink: 0, p: 0 }}>
                <CardActionArea onClick={() => setSelectedList(fl)}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Chip label="Destacada" size="small" color="primary" sx={{ borderRadius: 1, mb: 0.5, height: 22, fontSize: '0.65rem' }} />
                    <Typography variant="subtitle2" noWrap>{fl.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fl.itemCount} comercio{fl.itemCount !== 1 ? 's' : ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* User lists grid */}
      {lists.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <BookmarkBorderIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">{MSG_LIST.emptyLists}</Typography>
          <Typography variant="caption" color="text.secondary">Crea una para organizar tus comercios favoritos</Typography>
        </Box>
      ) : (
        <ListCardGrid
          lists={lists}
          onListClick={setSelectedList}
          onCreateClick={lists.length < MAX_LISTS ? () => setCreateOpen(true) : undefined}
        />
      )}

      {lists.length === 0 && (
        <Box sx={{ px: 2 }}>
          <Box
            onClick={() => setCreateOpen(true)}
            sx={{
              border: 1,
              borderStyle: 'dashed',
              borderColor: 'divider',
              borderRadius: 2,
              py: 1.5,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Typography variant="body2" color="text.secondary">+ Crear nueva lista</Typography>
          </Box>
        </Box>
      )}

      <CreateListDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(listId, name, description, icon) => {
          setCreateOpen(false);
          if (user) {
            setLists((prev) => [{
              id: listId, ownerId: user.uid, name, description, icon,
              isPublic: false, featured: false, editorIds: [], itemCount: 0,
              createdAt: new Date(), updatedAt: new Date(),
            }, ...prev]);
          }
        }}
      />
    </PullToRefreshWrapper>
  );
}
