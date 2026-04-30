import { useMemo, useCallback, useRef, type RefCallback } from 'react';
import {
  Box,
  List,
  Typography,
  Button,
  Snackbar,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useNotifications } from '../../hooks/useNotifications';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useSwipeActions } from '../../hooks/useSwipeActions';
import { useCommentEdit } from '../../hooks/useCommentEdit';
import { deleteComment, editComment, getCommentsCollection } from '../../services/comments';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { useToast } from '../../context/ToastContext';
import { MSG_COMMON, MSG_COMMENT, MSG_OFFLINE } from '../../constants/messages';
import { logger } from '../../utils/logger';
import { PaginatedListShell } from '../common/PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import CommentsStats from './CommentsStats';
import CommentsToolbar from './CommentsToolbar';
import CommentsListItemSwipeable from './CommentsListItemSwipeable';
import { useCommentsListFilters } from '../../hooks/useCommentsListFilters';
import { useVirtualizedList } from '../../hooks/useVirtualizedList';
import type { SortMode } from '../../hooks/useCommentsListFilters';
import { truncate } from '../../utils/text';
import type { Business, Comment } from '../../types';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function CommentsList({ onSelectBusiness }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const { notifications, markRead } = useNotifications();

  // Data loading
  const collectionRef = useMemo(() => getCommentsCollection(), []);
  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, loadAll, reload } =
    usePaginatedQuery<Comment>(collectionRef, user?.uid, 'createdAt');

  const handleRefresh = useCallback(async () => { reload(); }, [reload]);

  // Undo delete (#323: wrap con withOfflineSupport para encolar offline)
  const onConfirmDelete = useCallback(
    async (comment: Comment) => {
      if (!user) return;
      try {
        await withOfflineSupport(
          isOffline,
          'comment_delete',
          { userId: user.uid, businessId: comment.businessId },
          { commentId: comment.id },
          () => deleteComment(comment.id, user.uid),
          toast,
        );
      } catch (err) {
        logger.error('[CommentsList] deleteComment failed:', err);
        toast.error(MSG_COMMON.deleteError);
      }
    },
    [user, isOffline, toast],
  );
  const { isPendingDelete, markForDelete, snackbarProps } = useUndoDelete<Comment>({
    onConfirmDelete,
    onDeleteComplete: reload,
    message: MSG_COMMENT.deleteSuccess,
  });

  // Edit (extracted hook) — #323 wrap con withOfflineSupport
  const handleEditSave = useCallback(async (commentId: string, newText: string) => {
    if (!user) return;
    // CommentsList no tiene businessId fijo (lista paginada multi-business);
    // buscamos el businessId del comentario para metadata de la queue.
    const target = rawItems.find((c) => c.id === commentId);
    const businessId = target?.businessId ?? '';
    try {
      await withOfflineSupport(
        isOffline,
        'comment_edit',
        { userId: user.uid, businessId },
        { commentId, text: newText },
        () => editComment(commentId, user.uid, newText),
        toast,
      );
    } catch (err) {
      logger.error('[CommentsList] editComment failed:', err);
      toast.error(MSG_COMMON.editError);
    }
  }, [user, isOffline, toast, rawItems]);

  const { editingId, editText, isSavingEdit, setEditText, startEdit, cancelEdit, saveEdit } = useCommentEdit({
    onSave: handleEditSave,
    onSaveComplete: reload,
  });

  // Filters, sort, search, stats (extracted hook)
  const {
    sortMode, setSortMode,
    searchInput, setSearchInput,
    deferredSearch,
    filterBusiness, setFilterBusiness,
    comments, filteredComments,
    businessOptions, stats,
    isFiltered, showControls,
  } = useCommentsListFilters({ rawItems, isPendingDelete, hasMore, loadAll });

  // Swipe actions
  const swipe = useSwipeActions();
  const swipeRefs = useRef<Map<string, React.RefObject<HTMLElement | null>>>(new Map());
  const getSwipeRef = useCallback((id: string) => {
    if (!swipeRefs.current.has(id)) {
      swipeRefs.current.set(id, { current: null });
    }
    return swipeRefs.current.get(id)!;
  }, []);

  // Unread reply notifications
  const unreadReplyCommentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of notifications) {
      if (n.type === 'comment_reply' && !n.read && n.referenceId) {
        ids.add(n.referenceId);
      }
    }
    return ids;
  }, [notifications]);

  // Virtualization (extracted hook)
  const { shouldVirtualize, scrollContainerRef, virtualizer } = useVirtualizedList({
    itemCount: filteredComments.length,
    hasMore,
    isLoadingMore,
    searchInput,
    loadMore,
  });

  const handleSelectBusiness = useCallback((business: Business | null, commentId?: string) => {
    if (!business) return;
    if (commentId) {
      for (const n of notifications) {
        if (n.type === 'comment_reply' && !n.read && n.referenceId === commentId) {
          markRead(n.id);
        }
      }
    }
    onSelectBusiness(business);
  }, [notifications, markRead, onSelectBusiness]);

  const itemProps = {
    editingId, editText, isSavingEdit, unreadReplyCommentIds,
    onSelectBusiness: handleSelectBusiness,
    onStartEdit: startEdit, onSaveEdit: saveEdit, onCancelEdit: cancelEdit,
    onSetEditText: setEditText, onMarkForDelete: markForDelete,
  };

  return (
    <PullToRefreshWrapper onRefresh={handleRefresh}>
    <PaginatedListShell
      isLoading={isLoading}
      error={error}
      isEmpty={comments.length === 0}
      isFiltered={isFiltered}
      hasMore={hasMore && !searchInput}
      isLoadingMore={isLoadingMore}
      emptyIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 48 }} />}
      emptyMessage="No dejaste comentarios todavía"
      emptySubtext="Tocá un comercio en el mapa para dejar tu opinión"
      noResultsMessage={
        deferredSearch
          ? `No se encontraron resultados para "${truncate(deferredSearch, 30)}"`
          : 'No hay comentarios para este comercio'
      }
      onRetry={reload}
      onLoadMore={loadMore}
    >
      {stats && <CommentsStats stats={stats} />}

      {showControls && (
        <CommentsToolbar
          sortMode={sortMode}
          onSortChange={(v) => setSortMode(v as SortMode)}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          filterBusiness={filterBusiness}
          onFilterBusinessChange={setFilterBusiness}
          businessOptions={businessOptions}
        />
      )}

      {deferredSearch && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, display: 'block', mb: 0.5 }}
          aria-live="polite"
        >
          {filteredComments.length} resultado{filteredComments.length !== 1 ? 's' : ''}
        </Typography>
      )}
      {searchInput && hasMore && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block', mb: 0.5 }}>
          Cargando todos los comentarios...
        </Typography>
      )}

      {filteredComments.length > 0 && !shouldVirtualize && (
        <List disablePadding>
          {filteredComments.map(({ id, comment, business }) => (
            <CommentsListItemSwipeable key={id} id={id} comment={comment} business={business} swipe={swipe} getSwipeRef={getSwipeRef} {...itemProps} />
          ))}
        </List>
      )}

      {filteredComments.length > 0 && shouldVirtualize && (
        <Box ref={scrollContainerRef} sx={{ flex: 1, overflow: 'auto' }}>
          <List disablePadding sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { id, comment, business } = filteredComments[virtualRow.index];
              return (
                <Box
                  key={id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement as RefCallback<HTMLDivElement>}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <CommentsListItemSwipeable id={id} comment={comment} business={business} swipe={swipe} getSwipeRef={getSwipeRef} {...itemProps} />
                </Box>
              );
            })}
          </List>
        </Box>
      )}

      <Snackbar
        open={snackbarProps.open}
        message={isOffline ? MSG_OFFLINE.commentDeletedOffline : snackbarProps.message}
        autoHideDuration={snackbarProps.autoHideDuration}
        onClose={snackbarProps.onClose}
        action={
          isOffline ? undefined : (
            <Button color="primary" size="small" onClick={snackbarProps.onUndo}>
              Deshacer
            </Button>
          )
        }
      />
    </PaginatedListShell>
    </PullToRefreshWrapper>
  );
}
