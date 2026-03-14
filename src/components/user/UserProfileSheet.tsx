import { SwipeableDrawer, Box, Typography, Avatar, Chip, Divider, Skeleton, List, ListItemButton, ListItemText } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useSelection } from '../../context/MapContext';
import { allBusinesses } from '../../hooks/useBusinesses';
import { formatDateMedium } from '../../utils/formatDate';
import { MEDALS } from '../../constants/rankings';
import { truncate } from '../../utils/text';
import UserStatsRow from './UserStatsRow';
import type { Business } from '../../types';

interface Props {
  userId: string | null;
  userName?: string;
  onClose: () => void;
}

export default function UserProfileSheet({ userId, userName, onClose }: Props) {
  const isOpen = userId !== null;
  const { profile, loading } = useUserProfile(userId, userName);
  const { setSelectedBusiness } = useSelection();

  const handleOpen = () => {};

  const handleCommentClick = (businessId: string) => {
    const business: Business | undefined = allBusinesses.find((b) => b.id === businessId);
    if (business) {
      onClose();
      setSelectedBusiness(business);
    }
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      onOpen={handleOpen}
      disableSwipeToOpen
      swipeAreaWidth={0}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '75dvh',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', maxHeight: '75dvh' }}>
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'divider',
            }}
          />
        </Box>

        <Box sx={{ px: 2, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {loading ? (
            <ProfileSkeleton />
          ) : profile ? (
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
                          primaryTypographyProps={{ variant: 'body2', sx: { fontStyle: 'italic' } }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </>
              )}
            </>
          ) : null}
        </Box>
      </Box>
    </SwipeableDrawer>
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
