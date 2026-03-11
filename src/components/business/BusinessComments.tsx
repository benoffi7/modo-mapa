import { useState, memo } from 'react';
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
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { useAuth } from '../../context/AuthContext';
import { invalidateQueryCache } from '../../hooks/usePaginatedQuery';
import type { Comment } from '../../types';

interface Props {
  businessId: string;
  comments: Comment[];
  isLoading: boolean;
  onCommentsChange: () => void;
}

export default memo(function BusinessComments({ businessId, comments, isLoading, onCommentsChange }: Props) {
  const { user, displayName } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const MAX_COMMENTS_PER_DAY = 20;

  const userCommentsToday = comments.filter((c) => {
    if (c.userId !== user?.uid) return false;
    const today = new Date();
    return c.createdAt.toDateString() === today.toDateString();
  }).length;

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    const text = newComment.trim();
    const userName = displayName || 'Anónimo';
    try {
      await addDoc(collection(db, COLLECTIONS.COMMENTS), {
        userId: user.uid,
        userName,
        businessId,
        text,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
      invalidateQueryCache(COLLECTIONS.COMMENTS, user.uid);
      onCommentsChange();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
    setIsSubmitting(false);
  };

  const handleDeleteComment = async () => {
    if (!confirmDeleteId || !user) return;
    await deleteDoc(doc(db, COLLECTIONS.COMMENTS, confirmDeleteId));
    setConfirmDeleteId(null);
    invalidateQueryCache(COLLECTIONS.COMMENTS, user.uid);
    onCommentsChange();
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
        Comentarios ({isLoading ? '...' : comments.length})
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
        {!isLoading && comments.length === 0 && (
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
});
