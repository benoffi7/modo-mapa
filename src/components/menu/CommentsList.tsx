import { useMemo, useState, useCallback, useDeferredValue, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  Snackbar,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useSwipeActions } from '../../hooks/useSwipeActions';
import { allBusinesses } from '../../hooks/useBusinesses';
import { deleteComment, editComment, getCommentsCollection } from '../../services/comments';
import { PaginatedListShell } from './PaginatedListShell';
import { MAX_COMMENT_LENGTH } from '../../constants/validation';
import { formatRelativeTime } from '../../utils/formatDate';
import { truncate } from '../../utils/text';
import type { Business, Comment } from '../../types';

type SortMode = 'recent' | 'oldest' | 'useful';

interface Props {
  onNavigate: () => void;
}

export default function CommentsList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useSelection();

  // Data loading
  const collectionRef = useMemo(() => getCommentsCollection(), []);
  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, reload } =
    usePaginatedQuery<Comment>(collectionRef, user?.uid, 'createdAt');

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
  const [statsExpanded, setStatsExpanded] = useState(false);

  // Swipe actions (#109)
  const swipe = useSwipeActions();

  // "Load all" when search is active
  useEffect(() => {
    if (!searchInput || !hasMore || isLoadingMore) return;
    loadMore();
  }, [searchInput, hasMore, isLoadingMore, loadMore]);

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

  const handleSelectBusiness = (business: Business | null) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();
  };

  const isFiltered = !!deferredSearch || !!filterBusiness;

  const showControls = comments.length >= 3;

  return (
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
      {stats && (
        <Box sx={{ mx: 2, mb: 1 }}>
          <Box
            role="button"
            tabIndex={0}
            aria-expanded={statsExpanded}
            aria-label="Resumen de comentarios"
            onClick={() => setStatsExpanded(!statsExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setStatsExpanded(!statsExpanded);
              }
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Resumen
            </Typography>
            {statsExpanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
          </Box>
          <Collapse in={statsExpanded}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, pb: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Comentarios</Typography>
                <Typography variant="body2" fontWeight={600}>{stats.total}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Likes recibidos</Typography>
                <Typography variant="body2" fontWeight={600}>{stats.totalLikes}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Promedio likes</Typography>
                <Typography variant="body2" fontWeight={600}>{stats.avgLikes.toFixed(1)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Más popular</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {truncate(stats.mostPopular?.business?.name ?? '—', 20)}
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </Box>
      )}

      {/* #103: Sorting chips (>= 3 items) */}
      {showControls && (
        <ToggleButtonGroup
          value={sortMode}
          exclusive
          onChange={(_, v) => v && setSortMode(v as SortMode)}
          size="small"
          aria-label="Ordenar comentarios"
          sx={{ display: 'flex', gap: 0.5, px: 2, py: 1 }}
        >
          {(['recent', 'oldest', 'useful'] as const).map((mode) => (
            <ToggleButton
              key={mode}
              value={mode}
              sx={{
                height: 24,
                fontSize: '0.7rem',
                borderRadius: '16px !important',
                border: '1px solid',
                borderColor: 'divider',
                textTransform: 'none',
                px: 1.5,
              }}
            >
              {mode === 'recent' ? 'Recientes' : mode === 'oldest' ? 'Antiguos' : 'Más likes'}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      {/* #102: Search */}
      {showControls && (
        <Box sx={{ px: 2, mb: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar comentarios..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar comentarios"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />
                ),
                endAdornment: searchInput ? (
                  <IconButton
                    size="small"
                    onClick={() => setSearchInput('')}
                    aria-label="Limpiar búsqueda"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                ) : null,
              },
            }}
          />
        </Box>
      )}

      {/* #101: Filter by business */}
      {showControls && businessOptions.length > 1 && (
        <Box sx={{ px: 2, mb: 1 }}>
          <Autocomplete
            size="small"
            options={businessOptions}
            getOptionLabel={(b) => b.name}
            value={filterBusiness}
            onChange={(_, v) => setFilterBusiness(v)}
            renderInput={(params) => (
              <TextField {...params} placeholder="Filtrar por comercio..." size="small" />
            )}
          />
        </Box>
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

      {filteredComments.length > 0 && (
        <List disablePadding>
          {filteredComments.map(({ id, comment, business }) => {
            const handlers = swipe.getHandlers(id);
            const style = swipe.getStyle(id);
            const isSwiped = swipe.swipedId === id;

            return (
              <Box
                key={id}
                sx={{ position: 'relative', overflow: 'hidden' }}
                onClick={() => isSwiped && swipe.reset()}
              >
                {/* #109: Revealed swipe actions behind the item */}
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
                      sx={{ color: '#fff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (swipe.direction === 'left') {
                          markForDelete(id, comment);
                        } else {
                          handleStartEdit(comment);
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

                {/* Swipeable list item */}
                <Box
                  {...handlers}
                  sx={{
                    position: 'relative',
                    bgcolor: 'background.paper',
                    zIndex: 1,
                    '@media (pointer: fine)': { touchAction: 'none' },
                  }}
                  style={style}
                >
                  <ListItemButton
                    onClick={() => editingId !== id && !isSwiped && handleSelectBusiness(business)}
                    disabled={!business && editingId !== id}
                    sx={{ pr: 1, alignItems: 'flex-start' }}
                  >
                    <ListItemText
                      primary={business?.name || 'Comercio desconocido'}
                      secondary={
                        editingId === id ? (
                          // #106: Edit inline
                          <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              maxRows={4}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              disabled={isSavingEdit}
                              slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
                              helperText={`${editText.length}/${MAX_COMMENT_LENGTH}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Box component="span" sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                                disabled={isSavingEdit || !editText.trim()}
                                aria-label="Guardar edición"
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                disabled={isSavingEdit}
                                aria-label="Cancelar edición"
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        ) : (
                          <>
                            {/* Comment text */}
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'block' }}>
                              {truncate(comment.text, 80)}
                            </Typography>
                            {/* #108 + #104: Metadata row */}
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
                    {/* Action buttons: edit + delete (visible fallback for accessibility) */}
                    {editingId !== id && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(comment); }}
                          sx={{ color: 'text.secondary' }}
                          aria-label="Editar comentario"
                        >
                          <EditOutlinedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); markForDelete(id, comment); }}
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
          })}
        </List>
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
  );
}
