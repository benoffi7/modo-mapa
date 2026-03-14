import { useMemo, useCallback } from 'react';
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
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { allBusinesses } from '../../hooks/useBusinesses';
import { deleteComment, getCommentsCollection } from '../../services/comments';
import { formatDateMedium } from '../../utils/formatDate';
import { truncate } from '../../utils/text';
import type { Business, Comment } from '../../types';

interface Props {
  onNavigate: () => void;
}

export default function CommentsList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useSelection();

  const collectionRef = useMemo(() => getCommentsCollection(), []);

  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, reload } =
    usePaginatedQuery<Comment>(collectionRef, user?.uid, 'createdAt');

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

  const comments = useMemo(() => {
    return rawItems
      .filter((data) => !isPendingDelete(data.id))
      .map((data) => ({
        id: data.id,
        comment: data,
        business: allBusinesses.find((b) => b.id === data.businessId) || null,
      }));
  }, [rawItems, isPendingDelete]);

  const handleSelectBusiness = (business: Business | null) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Cargando...
        </Typography>
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

  if (comments.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No dejaste comentarios todavía
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <List disablePadding>
        {comments.map(({ id, comment, business }) => (
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
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'block' }}>
                    {truncate(comment.text, 80)}
                  </Typography>
                  <Typography component="span" variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                    {formatDateMedium(comment.createdAt)}
                  </Typography>
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

      {hasMore && (
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
