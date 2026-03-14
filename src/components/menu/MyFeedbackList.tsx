import { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Typography,
  Collapse,
  CircularProgress,
  Divider,
} from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { useAuth } from '../../context/AuthContext';
import { fetchUserFeedback, markFeedbackViewed } from '../../services/feedback';
import { FEEDBACK_STATUSES } from '../../constants/feedback';
import { formatDateMedium } from '../../utils/formatDate';
import type { Feedback, FeedbackStatus, FeedbackCategory } from '../../types';

function categoryColor(cat: FeedbackCategory): 'error' | 'primary' | 'info' | 'warning' | 'default' {
  if (cat === 'bug') return 'error';
  if (cat === 'sugerencia') return 'primary';
  if (cat === 'datos_usuario') return 'info';
  if (cat === 'datos_comercio') return 'warning';
  return 'default';
}

function statusColor(status: FeedbackStatus) {
  return FEEDBACK_STATUSES[status]?.color ?? 'default';
}

function statusLabel(status: FeedbackStatus) {
  return FEEDBACK_STATUSES[status]?.label ?? status;
}

export default function MyFeedbackList() {
  const { user } = useAuth();
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchUserFeedback(user.uid)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleToggle = async (fb: Feedback) => {
    const isExpanding = expandedId !== fb.id;
    setExpandedId(isExpanding ? fb.id : null);

    if (isExpanding && fb.adminResponse && !fb.viewedByUser) {
      try {
        await markFeedbackViewed(fb.id);
        setItems((prev) => prev.map((f) => f.id === fb.id ? { ...f, viewedByUser: true } : f));
      } catch {
        // silent
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
        <InboxOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No enviaste feedback todavía
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {items.map((fb) => (
        <Box key={fb.id}>
          <ListItemButton onClick={() => handleToggle(fb)} sx={{ py: 1.5 }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={fb.category} size="small" color={categoryColor(fb.category)} />
                  <Chip label={statusLabel(fb.status)} size="small" color={statusColor(fb.status)} />
                  {fb.adminResponse && !fb.viewedByUser && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                  )}
                </Box>
              }
              secondary={
                <Box component="span">
                  <Typography variant="body2" color="text.primary" noWrap component="span" sx={{ display: 'block' }}>
                    {fb.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    {formatDateMedium(fb.createdAt)}
                  </Typography>
                </Box>
              }
            />
          </ListItemButton>
          <Collapse in={expandedId === fb.id}>
            <Box sx={{ px: 2, pb: 2 }}>
              {fb.mediaUrl && (
                <Box
                  component="img"
                  src={fb.mediaUrl}
                  alt="Adjunto"
                  sx={{ maxHeight: 150, maxWidth: '100%', borderRadius: 1, objectFit: 'cover', mb: 1, display: 'block' }}
                />
              )}
              {fb.adminResponse && (
                <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Respuesta del equipo
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                    {fb.adminResponse}
                  </Typography>
                  {fb.respondedAt && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {formatDateMedium(fb.respondedAt)}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Collapse>
          <Divider />
        </Box>
      ))}
    </List>
  );
}
