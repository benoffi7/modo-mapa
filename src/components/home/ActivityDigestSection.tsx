import { useEffect } from 'react';
import { Box, Typography, Button, Skeleton } from '@mui/material';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FeedbackIcon from '@mui/icons-material/Feedback';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNotificationDigest } from '../../hooks/useNotificationDigest';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { sectionTitleSx } from '../../theme/cards';
import { trackEvent } from '../../utils/analytics';
import { useTab } from '../../context/TabContext';
import type { DigestGroup } from '../../types';

const ICON_MAP: Record<string, React.ReactElement> = {
  ChatBubble: <ChatBubbleIcon fontSize="small" color="primary" />,
  ThumbUp: <ThumbUpIcon fontSize="small" color="primary" />,
  PersonAdd: <PersonAddIcon fontSize="small" color="primary" />,
  EmojiEvents: <EmojiEventsIcon fontSize="small" color="primary" />,
  CardGiftcard: <CardGiftcardIcon fontSize="small" color="primary" />,
  CheckCircle: <CheckCircleIcon fontSize="small" color="primary" />,
  Cancel: <CancelIcon fontSize="small" color="primary" />,
  Feedback: <FeedbackIcon fontSize="small" color="primary" />,
};

function DigestItem({ group }: { group: DigestGroup }) {
  const { setActiveTab } = useTab();

  const handleTap = () => {
    trackEvent('digest_item_tapped', { type: group.type, count: group.count });
    setActiveTab('perfil');
  };

  return (
    <Box
      onClick={handleTap}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.75,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        borderRadius: 1,
        px: 1,
      }}
    >
      {ICON_MAP[group.icon] ?? <NotificationsNoneIcon fontSize="small" color="primary" />}
      <Typography variant="body2" sx={{ flex: 1 }}>
        {group.label}
      </Typography>
    </Box>
  );
}

export default function ActivityDigestSection() {
  const { groups, hasActivity, loading } = useNotificationDigest();
  const { navigateToSearch } = useTabNavigation();
  const { setActiveTab } = useTab();

  useEffect(() => {
    if (!loading) {
      trackEvent('digest_section_viewed', {
        group_count: groups.length,
        has_activity: hasActivity,
      });
    }
  }, [loading, groups.length, hasActivity]);

  if (loading) {
    return (
      <Box sx={{ px: 2, py: 1.5 }}>
        <Skeleton width={120} height={24} sx={{ mb: 1 }} />
        <Skeleton width="80%" height={32} />
        <Skeleton width="60%" height={32} />
      </Box>
    );
  }

  if (!hasActivity) {
    return (
      <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
        <NotificationsNoneIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          No hay novedades recientes
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Calificá y comentá comercios para recibir actividad
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            trackEvent('digest_cta_tapped');
            navigateToSearch();
          }}
        >
          Explorar comercios
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...sectionTitleSx }}>
        <Typography variant="subtitle2">Tu actividad</Typography>
        <Typography
          variant="caption"
          color="primary"
          sx={{ cursor: 'pointer' }}
          onClick={() => {
            trackEvent('digest_item_tapped', { type: 'view_all', count: 0 });
            setActiveTab('perfil');
          }}
        >
          Ver todas
        </Typography>
      </Box>
      {groups.map((g) => (
        <DigestItem key={g.type} group={g} />
      ))}
    </Box>
  );
}
