import { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Alert, CircularProgress, Box,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { UserSearchField } from '../UserSearchField';
import { createRecommendation, countRecommendationsSentToday } from '../../services/recommendations';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { MAX_RECOMMENDATION_MESSAGE_LENGTH, MAX_RECOMMENDATIONS_PER_DAY } from '../../constants/validation';
import { logger } from '../../utils/logger';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}

export default function RecommendDialog({ open, onClose, businessId, businessName }: Props) {
  const { user, displayName } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [selectedUser, setSelectedUser] = useState<{ userId: string; displayName: string } | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentToday, setSentToday] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const userId = user?.uid;
  const limitReached = sentToday >= MAX_RECOMMENDATIONS_PER_DAY;

  useEffect(() => {
    if (!open || !userId) return;
    setLoadingCount(true);
    countRecommendationsSentToday(userId)
      .then(setSentToday)
      .catch((err) => { if (import.meta.env.DEV) logger.error('count failed:', err); })
      .finally(() => setLoadingCount(false));
  }, [open, userId]);

  const handleSubmit = useCallback(async () => {
    if (!userId || !selectedUser || submitting) return;

    setSubmitting(true);
    try {
      await withOfflineSupport(
        isOffline,
        'recommendation_create',
        { userId, businessId, businessName },
        { recipientId: selectedUser.userId, businessName, senderName: displayName ?? 'Alguien', message: message.trim() },
        () => createRecommendation(
          userId, displayName ?? 'Alguien',
          selectedUser.userId, businessId, businessName,
          message.trim(),
        ),
        toast,
      );
      setSentToday((prev) => prev + 1);
      toast.success('Recomendacion enviada');
      onClose();
      setSelectedUser(null);
      setMessage('');
    } catch (err) {
      if (import.meta.env.DEV) logger.error('Recommend failed:', err);
      toast.error(err instanceof Error ? err.message : 'Error al enviar recomendacion');
    } finally {
      setSubmitting(false);
    }
  }, [userId, selectedUser, submitting, isOffline, businessId, businessName, displayName, message, toast, onClose]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Recomendar {businessName}</DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        {limitReached && !loadingCount ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Alcanzaste el limite de {MAX_RECOMMENDATIONS_PER_DAY} recomendaciones por dia
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Busca un usuario para recomendarle este comercio
            </Typography>

            {selectedUser ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, p: 1, bgcolor: 'action.selected', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedUser.displayName}
                </Typography>
                <Button size="small" onClick={() => setSelectedUser(null)}>Cambiar</Button>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <UserSearchField
                  onSelect={(uid, name) => setSelectedUser({ userId: uid, displayName: name })}
                  placeholder="Buscar usuario..."
                  excludeUserId={userId}
                />
              </Box>
            )}

            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="Mensaje opcional..."
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_RECOMMENDATION_MESSAGE_LENGTH))}
              helperText={`${message.length}/${MAX_RECOMMENDATION_MESSAGE_LENGTH}`}
              disabled={!selectedUser}
            />

            {!loadingCount && sentToday > 0 && !limitReached && (
              <Typography variant="caption" color={sentToday >= MAX_RECOMMENDATIONS_PER_DAY - 3 ? 'warning.main' : 'text.secondary'} sx={{ mt: 0.5, display: 'block' }}>
                {sentToday}/{MAX_RECOMMENDATIONS_PER_DAY} recomendaciones hoy
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedUser || submitting || limitReached || loadingCount}
          startIcon={submitting ? <CircularProgress size={16} /> : null}
        >
          Recomendar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
