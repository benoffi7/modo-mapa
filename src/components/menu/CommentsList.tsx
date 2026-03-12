import { useMemo, useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const collectionRef = useMemo(() => getCommentsCollection(), []);

  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, reload } =
    usePaginatedQuery<Comment>(collectionRef, user?.uid, 'createdAt');

  const comments = useMemo(() => {
    return rawItems.map((data) => ({
      id: data.id,
      businessId: data.businessId,
      business: allBusinesses.find((b) => b.id === data.businessId) || null,
      text: data.text,
      createdAt: data.createdAt,
    }));
  }, [rawItems]);

  const handleDelete = async () => {
    if (!confirmDeleteId || !user) return;
    await deleteComment(confirmDeleteId, user.uid);
    setConfirmDeleteId(null);
    reload();
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

  if (comments.length === 0) {
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
                setConfirmDeleteId(comment.id);
              }}
              sx={{ color: '#5f6368' }}
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

      <Dialog open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>Eliminar comentario</DialogTitle>
        <DialogContent>
          <Typography>¿Eliminar este comentario?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
