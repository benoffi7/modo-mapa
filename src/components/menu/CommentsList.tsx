import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useMapContext } from '../../context/MapContext';
import type { Business } from '../../types';
import businessesData from '../../data/businesses.json';

const allBusinesses: Business[] = businessesData as Business[];

interface CommentItem {
  id: string;
  businessId: string;
  business: Business | null;
  text: string;
  createdAt: Date;
}

interface Props {
  onNavigate: () => void;
}

export default function CommentsList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useMapContext();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'comments'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items: CommentItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          businessId: data.businessId,
          business: allBusinesses.find((b) => b.id === data.businessId) || null,
          text: data.text,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setComments(items);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteDoc(doc(db, 'comments', confirmDeleteId));
    setComments((prev) => prev.filter((c) => c.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  const handleSelectBusiness = (business: Business | null) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
                    {formatDate(comment.createdAt)}
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
