import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import type { Comment } from '../../types';

interface Props {
  businessId: string;
}

export default function BusinessComments({ businessId }: Props) {
  const { user, displayName } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const q = query(
      collection(db, 'comments'),
      where('businessId', '==', businessId)
    );
    try {
      const snapshot = await getDocs(q);
      const loaded: Comment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as Comment[];
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setComments(loaded);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    }
  }, [businessId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    setIsSubmitting(true);
    const text = newComment.trim();
    const userName = displayName || 'Anónimo';
    try {
      const docRef = await addDoc(collection(db, 'comments'), {
        userId: user.uid,
        userName,
        businessId,
        text,
        createdAt: serverTimestamp(),
      });
      // Optimistic update: add to local state immediately
      setComments((prev) => [
        { id: docRef.id, userId: user.uid, userName, businessId, text, createdAt: new Date() },
        ...prev,
      ]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
    setIsSubmitting(false);
  };

  const handleDeleteComment = async () => {
    if (!confirmDeleteId) return;
    await deleteDoc(doc(db, 'comments', confirmDeleteId));
    setComments((prev) => prev.filter((c) => c.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Comentarios ({comments.length})
      </Typography>

      {user && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Dejá tu comentario..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px',
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting || !newComment.trim()}
            sx={{ borderRadius: '20px', minWidth: 'auto', px: 2 }}
          >
            <SendIcon fontSize="small" />
          </Button>
        </Box>
      )}

      <List disablePadding>
        {comments.map((comment, index) => (
          <Box key={comment.id}>
            <ListItem alignItems="flex-start" disablePadding sx={{ py: 1 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  mr: 1.5,
                  mt: 0.5,
                  fontSize: '0.85rem',
                  bgcolor: '#1a73e8',
                }}
              >
                {(comment.userName || 'A').charAt(0).toUpperCase()}
              </Avatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {comment.userName || 'Anónimo'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(comment.createdAt)}
                    </Typography>
                  </Box>
                }
                secondary={comment.text}
              />
              {user && comment.userId === user.uid && (
                <IconButton
                  size="small"
                  onClick={() => setConfirmDeleteId(comment.id)}
                  sx={{ color: '#5f6368', mt: 0.5 }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </ListItem>
            {index < comments.length - 1 && <Divider />}
          </Box>
        ))}
        {comments.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Sé el primero en comentar
          </Typography>
        )}
      </List>

      <Dialog open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>Eliminar comentario</DialogTitle>
        <DialogContent>
          <Typography>¿Eliminar este comentario?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
          <Button onClick={handleDeleteComment} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
