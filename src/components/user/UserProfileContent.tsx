import { Box, Typography, Avatar, Chip, Divider, Skeleton, List, ListItemButton, ListItemText } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { useUserProfile } from '../../hooks/useUserProfile';
import { getBusinessById } from '../../utils/businessMap';
import { formatDateMedium } from '../../utils/formatDate';
import { MEDALS } from '../../constants/rankings';
import { truncate } from '../../utils/text';
import UserStatsRow from './UserStatsRow';
import { FollowButton } from '../FollowButton';
import type { Business } from '../../types';

interface UserProfileContentProps {
  userId: string;
  userName?: string | undefined;
  onClose: () => void;
  onNavigateToBusiness: (business: Business) => void;
}

export default function UserProfileContent({ userId, userName, onClose, onNavigateToBusiness }: UserProfileContentProps) {
  const { profile, loading } = useUserProfile(userId, userName);

  const handleCommentClick = (businessId: string) => {
    const business: Business | undefined = getBusinessById(businessId);
    if (business) {
      onClose();
      onNavigateToBusiness(business);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return null;
  }

  return (
    <>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            fontSize: '1.2rem',
            bgcolor: 'primary.main',
          }}
        >
          {profile.displayName.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              {profile.displayName}
            </Typography>
            {profile.rankingPosition !== null && profile.rankingPosition <= 3 && (
              <Chip
                label={`${MEDALS[profile.rankingPosition]} #${profile.rankingPosition}`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Miembro desde {formatDateMedium(profile.createdAt)}
          </Typography>
        </Box>
      </Box>

      {/* Follow button */}
      <Box sx={{ mt: 1, mb: 1 }}>
        <FollowButton targetUserId={userId} />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Stats */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Actividad
      </Typography>
      <Box sx={{ px: 0.5 }}>
        <UserStatsRow icon={<ChatBubbleOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label="Comentarios" count={profile.stats.comments} />
        <UserStatsRow icon={<StarOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label="Calificaciones" count={profile.stats.ratings} />
        <UserStatsRow icon={<FavoriteBorderIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label="Favoritos" count={profile.stats.favorites} />
        <UserStatsRow icon={<ThumbUpAltOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label="Likes recibidos" count={profile.stats.likesReceived} />
        <UserStatsRow icon={<LocalOfferOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label="Tags creados" count={profile.stats.customTags} />
        <UserStatsRow icon={<PhotoCameraOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />} label="Fotos aprobadas" count={profile.stats.photos} />
        {profile.rankingPosition !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEventsOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2">Ranking mensual</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {profile.rankingPosition <= 3 ? MEDALS[profile.rankingPosition] : ''} #{profile.rankingPosition}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Recent comments */}
      {profile.recentComments.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Últimos comentarios
          </Typography>
          <List disablePadding>
            {profile.recentComments.map((comment) => (
              <ListItemButton
                key={comment.id}
                onClick={() => handleCommentClick(comment.businessId)}
                sx={{ px: 0.5, borderRadius: 1 }}
              >
                <ListItemText
                  primary={truncate(comment.text, 100)}
                  secondary={`${comment.businessName} — ${formatDateMedium(comment.createdAt)}`}
                  slotProps={{
                    primary: { variant: 'body2', sx: { fontStyle: 'italic' } },
                    secondary: { variant: 'caption' },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </>
      )}
    </>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" height={16} />
        </Box>
      </Box>
      <Divider sx={{ my: 1.5 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} width="100%" height={28} sx={{ my: 0.25 }} />
      ))}
    </>
  );
}
