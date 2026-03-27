import { memo, useMemo, useCallback, useRef, type RefCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  Snackbar,
  TextField,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useSwipeActions } from '../../hooks/useSwipeActions';
import { useCommentEdit } from '../../hooks/useCommentEdit';
import { deleteComment, editComment, getCommentsCollection } from '../../services/comments';
import { PaginatedListShell } from './PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import CommentsStats from './CommentsStats';
import CommentsToolbar from './CommentsToolbar';
import { useCommentsListFilters } from './useCommentsListFilters';
import { useVirtualizedList } from './useVirtualizedList';
import type { SortMode } from './useCommentsListFilters';
import { MAX_COMMENT_LENGTH } from '../../constants/validation';
import { formatRelativeTime } from '../../utils/formatDate';
import { truncate } from '../../utils/text';
import type { Business, Comment } from '../../types';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

interface CommentItemProps {
  id: string;
  comment: Comment;
  business: Business | null;
  editingId: string | null;
  editText: string;
  isSavingEdit: boolean;
  swipe: ReturnType<typeof useSwipeActions>;
  getSwipeRef: (id: string) => React.RefObject<HTMLElement | null>;
  unreadReplyCommentIds: Set<string>;
  onSelectBusiness: (business: Business | null, commentId?: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditText: (text: string) => void;
  onMarkForDelete: (id: string, comment: Comment) => void;
}

const CommentItem = memo(function CommentItem({
  id, comment, business, editingId, editText, isSavingEdit,
  swipe, getSwipeRef, unreadReplyCommentIds,
  onSelectBusiness, onStartEdit, onSaveEdit, onCancelEdit, onSetEditText, onMarkForDelete,
}: CommentItemProps) {
  const isSwiped = swipe.swipedId === id;
  const itemRef = getSwipeRef(id);
  // eslint-disable-next-line react-hooks/refs -- ref is only read inside touch event callbacks, not during render
  const handlers = swipe.getHandlers(id, itemRef);
  const style = swipe.getStyle(id);

  return (
    <Box
      sx={{ position: 'relative', overflow: 'hidden' }}
      onClick={() => isSwiped && swipe.reset()}
    >
      {isSwiped && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(swipe.direction === 'left'
              ? { right: 0, bgcolor: 'error.main' }
              : { left: 0, bgcolor: 'primary.main' }),
            width: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconButton
            sx={{ color: 'common.white' }}
            onClick={(e) => {
              e.stopPropagation();
              if (swipe.direction === 'left') {
                onMarkForDelete(id, comment);
              } else {
                onStartEdit(comment);
              }
              swipe.reset();
            }}
            aria-label={swipe.direction === 'left' ? 'Eliminar' : 'Editar'}
          >
            {swipe.direction === 'left'
              ? <DeleteOutlineIcon />
              : <EditOutlinedIcon />}
          </IconButton>
        </Box>
      )}

      <Box
        ref={itemRef}
        {...handlers}
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          zIndex: 1,
        }}
        style={style}
      >
        <ListItemButton
          onClick={() => editingId !== id && !isSwiped && onSelectBusiness(business, id)}
          disabled={!business && editingId !== id}
          sx={{ pr: 1, alignItems: 'flex-start' }}
        >
          <ListItemText
            primary={business?.name || 'Comercio desconocido'}
            secondary={
              editingId === id ? (
                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    maxRows={4}
                    value={editText}
                    onChange={(e) => onSetEditText(e.target.value)}
                    disabled={isSavingEdit}
                    slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
                    helperText={`${editText.length}/${MAX_COMMENT_LENGTH}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Box component="span" sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}
                      disabled={isSavingEdit || !editText.trim()}
                      aria-label="Guardar edición"
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                      disabled={isSavingEdit}
                      aria-label="Cancelar edición"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <>
                  {comment.type === 'question' && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mb: 0.25 }}>
                      <HelpOutlineIcon sx={{ fontSize: 13, color: 'info.main' }} />
                      <Typography component="span" variant="caption" color="info.main" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                        Pregunta
                      </Typography>
                    </Box>
                  )}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'block' }}>
                    {truncate(comment.text, 80)}
                  </Typography>
                  <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {formatRelativeTime(comment.createdAt)}
                    </Typography>
                    {comment.updatedAt && (
                      <Typography component="span" variant="caption" color="text.disabled">
                        (editado)
                      </Typography>
                    )}
                    {comment.likeCount > 0 && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        <FavoriteIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        <Typography component="span" variant="caption" color="text.disabled">
                          {comment.likeCount}
                        </Typography>
                      </Box>
                    )}
                    {(comment.replyCount ?? 0) > 0 && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        {unreadReplyCommentIds.has(comment.id) && (
                          <Box
                            component="span"
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: 'info.main',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <ChatBubbleOutlineIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {comment.replyCount}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )
            }
            primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
          />
          {editingId !== id && (
            <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onStartEdit(comment); }}
                sx={{ color: 'text.secondary' }}
                aria-label="Editar comentario"
              >
                <EditOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onMarkForDelete(id, comment); }}
                sx={{ color: 'text.secondary' }}
                aria-label="Eliminar comentario"
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </ListItemButton>
      </Box>
    </Box>
  );
});

export default function CommentsList({ onSelectBusiness }: Props) {
  const { user } = useAuth();
  const { notifications, markRead } = useNotifications();

  // Data loading
  const collectionRef = useMemo(() => getCommentsCollection(), []);
  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, loadAll, reload } =
    usePaginatedQuery<Comment>(collectionRef, user?.uid, 'createdAt');

  const handleRefresh = useCallback(async () => { reload(); }, [reload]);

  // Undo delete
  const onConfirmDelete = useCallback(
    async (comment: Comment) => {
      if (!user) return;
      await deleteComment(comment.id, user.uid);
    },
    [user],
  );
  const { isPendingDelete, markForDelete, snackbarProps } = useUndoDelete<Comment>({
    onConfirmDelete,
    onDeleteComplete: reload,
    message: 'Comentario eliminado',
  });

  // Edit (extracted hook)
  const handleEditSave = useCallback(async (commentId: string, newText: string) => {
    if (!user) return;
    await editComment(commentId, user.uid, newText);
  }, [user]);

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
            <CommentItem
              key={id}
              id={id}
              comment={comment}
              business={business}
              editingId={editingId}
              editText={editText}
              isSavingEdit={isSavingEdit}
              swipe={swipe}
              getSwipeRef={getSwipeRef}
              unreadReplyCommentIds={unreadReplyCommentIds}
              onSelectBusiness={handleSelectBusiness}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onSetEditText={setEditText}
              onMarkForDelete={markForDelete}
            />
          ))}
        </List>
      )}

      {filteredComments.length > 0 && shouldVirtualize && (
        <Box
          ref={scrollContainerRef}
          sx={{ flex: 1, overflow: 'auto' }}
        >
          <List
            disablePadding
            sx={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
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
                  <CommentItem
                    id={id}
                    comment={comment}
                    business={business}
                    editingId={editingId}
                    editText={editText}
                    isSavingEdit={isSavingEdit}
                    swipe={swipe}
                    getSwipeRef={getSwipeRef}
                    unreadReplyCommentIds={unreadReplyCommentIds}
                    onSelectBusiness={handleSelectBusiness}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onSetEditText={setEditText}
                    onMarkForDelete={markForDelete}
                  />
                </Box>
              );
            })}
          </List>
        </Box>
      )}

      <Snackbar
        open={snackbarProps.open}
        message={snackbarProps.message}
        autoHideDuration={snackbarProps.autoHideDuration}
        onClose={snackbarProps.onClose}
        action={
          <Button color="primary" size="small" onClick={snackbarProps.onUndo}>
            Deshacer
          </Button>
        }
      />
    </PaginatedListShell>
    </PullToRefreshWrapper>
  );
}
