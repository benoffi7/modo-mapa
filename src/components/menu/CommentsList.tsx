import { useMemo, useState, useCallback, useDeferredValue, useEffect, useRef, type RefCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box,
  List,
  Typography,
  Button,
  Snackbar,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useSwipeActions } from '../../hooks/useSwipeActions';
import { allBusinesses } from '../../hooks/useBusinesses';
import { deleteComment, editComment, getCommentsCollection } from '../../services/comments';
import { PaginatedListShell } from './PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import CommentsStats from './CommentsStats';
import CommentsToolbar from './CommentsToolbar';
import CommentItem from './CommentItem';
import { truncate } from '../../utils/text';
import type { Business, Comment } from '../../types';

const VIRTUALIZE_THRESHOLD = 20;

type SortMode = 'recent' | 'oldest' | 'useful';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

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

  // Sorting (#103)
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Search (#102)
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);

  // Edit inline (#106)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filter by business (#101)
  const [filterBusiness, setFilterBusiness] = useState<Business | null>(null);

  // Stats (#107)

  // Swipe actions (#109)
  const swipe = useSwipeActions();
  const swipeRefs = useRef<Map<string, React.RefObject<HTMLElement | null>>>(new Map());
  const getSwipeRef = useCallback((id: string) => {
    if (!swipeRefs.current.has(id)) {
      swipeRefs.current.set(id, { current: null });
    }
    return swipeRefs.current.get(id)!;
  }, []);

  // Unread reply notifications — referenceId points to the parent comment id
  const unreadReplyCommentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of notifications) {
      if (n.type === 'comment_reply' && !n.read && n.referenceId) {
        ids.add(n.referenceId);
      }
    }
    return ids;
  }, [notifications]);

  // "Load all" when search becomes active — fires once, not on every keystroke
  const hasTriggeredLoadAll = useRef(false);
  useEffect(() => {
    if (searchInput && !hasTriggeredLoadAll.current) {
      hasTriggeredLoadAll.current = true;
    }
    if (!searchInput) {
      hasTriggeredLoadAll.current = false;
    }
  }, [searchInput]);
  useEffect(() => {
    if (!hasTriggeredLoadAll.current || !hasMore) return;
    loadAll(200);
  }, [hasMore, loadAll]);

  // Map raw items to { comment, business }
  const comments = useMemo(() => {
    return rawItems
      .filter((data) => !isPendingDelete(data.id))
      .map((data) => ({
        id: data.id,
        comment: data,
        business: allBusinesses.find((b) => b.id === data.businessId) || null,
      }));
  }, [rawItems, isPendingDelete]);

  // Sort (#103)
  const sortedComments = useMemo(() => {
    const list = [...comments];
    switch (sortMode) {
      case 'oldest':
        return list.reverse();
      case 'useful':
        return list.sort((a, b) => b.comment.likeCount - a.comment.likeCount);
      default:
        return list;
    }
  }, [comments, sortMode]);

  // Filter by search (#102)
  const searchedComments = useMemo(() => {
    if (!deferredSearch) return sortedComments;
    const q = deferredSearch.toLowerCase();
    return sortedComments.filter(
      (c) =>
        c.comment.text.toLowerCase().includes(q) ||
        (c.business?.name.toLowerCase().includes(q) ?? false),
    );
  }, [sortedComments, deferredSearch]);

  // Filter by business (#101)
  const filteredComments = useMemo(() => {
    if (!filterBusiness) return searchedComments;
    return searchedComments.filter((c) => c.comment.businessId === filterBusiness.id);
  }, [searchedComments, filterBusiness]);

  // Business options for autocomplete (#101)
  const businessOptions = useMemo(() => {
    const seen = new Set<string>();
    return comments
      .map((c) => c.business)
      .filter((b): b is Business => b !== null && !seen.has(b.id) && seen.add(b.id) && true)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [comments]);

  // Stats (#107)
  const stats = useMemo(() => {
    if (comments.length === 0) return null;
    const totalLikes = comments.reduce((sum, c) => sum + c.comment.likeCount, 0);
    const avgLikes = totalLikes / comments.length;
    const mostPopular = comments.reduce(
      (best, c) => (c.comment.likeCount > (best?.comment.likeCount ?? 0) ? c : best),
      comments[0],
    );
    return { total: comments.length, totalLikes, avgLikes, mostPopular };
  }, [comments]);

  // Edit handlers (#106)
  const handleStartEdit = useCallback((comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editText.trim() || !user) return;
    setIsSavingEdit(true);
    try {
      await editComment(editingId, user.uid, editText.trim());
      setEditingId(null);
      reload();
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingId, editText, user, reload]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleSelectBusiness = useCallback((business: Business | null, commentId?: string) => {
    if (!business) return;
    // Mark unread reply notifications for this comment as read
    if (commentId) {
      for (const n of notifications) {
        if (n.type === 'comment_reply' && !n.read && n.referenceId === commentId) {
          markRead(n.id);
        }
      }
    }
    onSelectBusiness(business);
  }, [notifications, markRead, onSelectBusiness]);

  const isFiltered = !!deferredSearch || !!filterBusiness;

  const showControls = comments.length >= 3;

  // Virtualization (#112)
  const shouldVirtualize = filteredComments.length >= VIRTUALIZE_THRESHOLD;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredComments.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 72,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  // Auto-loadMore when near the end of virtual list
  const lastVirtualItem = virtualizer.getVirtualItems().at(-1);
  const lastVirtualIndex = lastVirtualItem?.index ?? -1;
  useEffect(() => {
    if (!shouldVirtualize || lastVirtualIndex < 0 || !hasMore || isLoadingMore || searchInput) return;
    if (lastVirtualIndex >= filteredComments.length - 5) {
      loadMore();
    }
  }, [shouldVirtualize, lastVirtualIndex, filteredComments.length, hasMore, isLoadingMore, searchInput, loadMore]);

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
      {/* #107: Stats summary */}
      {stats && <CommentsStats stats={stats} />}

      {/* Sort + search + filter */}
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

      {/* Search results count + loading */}
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
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
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
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
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
