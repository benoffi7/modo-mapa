import { useState, useCallback, memo } from 'react';
import { IconButton } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { addFavorite, removeFavorite } from '../../services/favorites';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { MSG_BUSINESS } from '../../constants/messages';
import { logger } from '../../utils/logger';

interface Props {
  businessId: string;
  businessName?: string;
  isFavorite: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export default memo(function FavoriteButton({ businessId, businessName, isFavorite, isLoading, onToggle }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [isToggling, setIsToggling] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [prevIsFavorite, setPrevIsFavorite] = useState(isFavorite);

  // Clear optimistic state when server state catches up (React pattern for derived state)
  if (isFavorite !== prevIsFavorite) {
    setPrevIsFavorite(isFavorite);
    setOptimistic(null);
  }

  const shown = optimistic ?? isFavorite;

  const toggleFavorite = useCallback(async () => {
    if (!user) return;
    const wasFavorite = isFavorite;
    setOptimistic(!wasFavorite);
    setIsToggling(true);
    try {
      if (wasFavorite) {
        await withOfflineSupport(
          isOffline, 'favorite_remove',
          { userId: user.uid, businessId, businessName },
          { action: 'remove' },
          () => removeFavorite(user.uid, businessId),
          toast,
        );
        if (!isOffline) toast.info(MSG_BUSINESS.favoriteRemoved);
      } else {
        await withOfflineSupport(
          isOffline, 'favorite_add',
          { userId: user.uid, businessId, businessName },
          { action: 'add' },
          () => addFavorite(user.uid, businessId),
          toast,
        );
        if (!isOffline) toast.success(MSG_BUSINESS.favoriteAdded);
      }
      onToggle();
    } catch (error) {
      setOptimistic(null);
      if (import.meta.env.DEV) logger.error('Error toggling favorite:', error);
      toast.error(MSG_BUSINESS.favoriteError);
    }
    setIsToggling(false);
  }, [user, businessId, businessName, isFavorite, isOffline, onToggle, toast]);

  return (
    <IconButton
      aria-label={shown ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      onClick={toggleFavorite}
      disabled={isLoading || isToggling || !user}
      sx={{ color: shown ? 'error.main' : 'text.secondary' }}
    >
      {shown ? <FavoriteIcon /> : <FavoriteBorderIcon />}
    </IconButton>
  );
});
