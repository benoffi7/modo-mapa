import { useMemo, useState, useRef } from 'react';
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
import { useMapContext } from '../../context/MapContext';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { allBusinesses } from '../../hooks/useBusinesses';
import { deleteComment, getCommentsCollection } from '../../services/comments';
import { formatDateMedium } from '../../utils/formatDate';
import type { Business, Comment } from '../../types';

interface Props {
  onNavigate: () => void;
}

export default function CommentsList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useMapContext();

  // Undo delete
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collectionRef = useMemo(() => getCommentsCollection(), []);

  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, reload } =
    usePaginatedQuery<Comment>(collectionRef, user?.uid, 'createdAt');

  const comments = useMemo(() => {
    return rawItems
      .filter((data) => data.id !== pendingDeleteId)
      .map((data) => ({
        id: data.id,
        businessId: data.businessId,
        business: allBusinesses.find((b) => b.id === data.businessId) || null,
        text: data.text,
        createdAt: data.createdAt,
      }));
  }, [rawItems, pendingDeleteId]);

  const handleDelete = (commentId: string) => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    setPendingDeleteId(commentId);
    deleteTimerRef.current = setTimeout(async () => {
      if (!user) return;
      try {
        await deleteComment(commentId, user.uid);
        reload();
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error deleting comment:', err);
      }
      setPendingDeleteId(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDeleteId(null);
  };

  const handleSelectBusiness = (business: Business | null) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();
  };

  const truncate = (text: string, max: number) => {
    return text.length > max ? text.slice(0, max) + '...' : text;
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

  if (comments.length === 0 && !pendingDeleteId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No dejaste comentarios todavía
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <List disablePadding>
        {comments.map((comment) => (
          <ListItemButton
            key={comment.id}
            onClick={() => handleSelectBusiness(comment.business)}
            disabled={!comment.business}
            sx={{ pr: 1 }}
          >
            <ListItemText
              primary={comment.business?.name || 'Comercio desconocido'}
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
                handleDelete(comment.id);
              }}
              sx={{ color: '#5f6368' }}
              aria-label="Eliminar comentario"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
      </List>

      {hasMore && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Button size="small" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Cargar más
          </Button>
        </Box>
      )}

      <Snackbar
        open={pendingDeleteId !== null}
        message="Comentario eliminado"
        action={
          <Button color="primary" size="small" onClick={handleUndoDelete}>
            Deshacer
          </Button>
        }
      />
    </>
  );
}
