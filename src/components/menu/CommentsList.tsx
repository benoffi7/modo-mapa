import { useMemo, useState, useCallback, useDeferredValue, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  CircularProgress,
  Snackbar,
  Skeleton,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { allBusinesses } from '../../hooks/useBusinesses';
import { deleteComment, getCommentsCollection } from '../../services/comments';
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

  // "Load all" when search is active (workaround — replaced by loadAll in Fase 2)
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
  const filteredComments = useMemo(() => {
    if (!deferredSearch) return sortedComments;
    const q = deferredSearch.toLowerCase();
    return sortedComments.filter(
      (c) =>
        c.comment.text.toLowerCase().includes(q) ||
        (c.business?.name.toLowerCase().includes(q) ?? false),
    );
  }, [sortedComments, deferredSearch]);

  const handleSelectBusiness = (business: Business | null) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();
  };

  // --- Render states ---

  // #110: Skeleton loader
  if (isLoading) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="90%" height={16} sx={{ mt: 0.5 }} />
              <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
            </Box>
            <Skeleton variant="circular" width={32} height={32} />
          </Box>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          Error al cargar comentarios
        </Typography>
        <Button size="small" onClick={reload}>Reintentar</Button>
      </Box>
    );
  }

  // #111: Empty state mejorado
  if (comments.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" gutterBottom>
          No dejaste comentarios todavía
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Tocá un comercio en el mapa para dejar tu opinión
        </Typography>
      </Box>
    );
  }

  const showControls = comments.length >= 3;

  return (
    <>
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

      {/* No results for search */}
      {deferredSearch && filteredComments.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No se encontraron resultados para &quot;{truncate(deferredSearch, 30)}&quot;
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {filteredComments.map(({ id, comment, business }) => (
            <ListItemButton
              key={id}
              onClick={() => handleSelectBusiness(business)}
              disabled={!business}
              sx={{ pr: 1 }}
            >
              <ListItemText
                primary={business?.name || 'Comercio desconocido'}
                secondary={
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
                }
                primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
              />
              <IconButton
                edge="end"
                onClick={(e) => {
                  e.stopPropagation();
                  markForDelete(id, comment);
                }}
                sx={{ color: 'text.secondary' }}
                aria-label="Eliminar comentario"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
        </List>
      )}

      {hasMore && !searchInput && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Button size="small" onClick={loadMore} disabled={isLoadingMore} aria-label="Cargar más comentarios">
            {isLoadingMore ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Cargar más
          </Button>
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
    </>
  );
}
