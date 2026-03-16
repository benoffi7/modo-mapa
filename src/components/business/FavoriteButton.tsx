import { useState, useCallback } from 'react';
import { IconButton } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { addFavorite, removeFavorite } from '../../services/favorites';

interface Props {
  businessId: string;
  isFavorite: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export default function FavoriteButton({ businessId, isFavorite, isLoading, onToggle }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [isToggling, setIsToggling] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const shown = optimistic ?? isFavorite;

  const toggleFavorite = useCallback(async () => {
    if (!user) return;
    const wasFavorite = isFavorite;
    setOptimistic(!wasFavorite);
    setIsToggling(true);
    try {
      if (wasFavorite) {
        await removeFavorite(user.uid, businessId);
        toast.info('Removido de favoritos');
      } else {
        await addFavorite(user.uid, businessId);
        toast.success('Agregado a favoritos');
      }
      onToggle();
    } catch (error) {
      setOptimistic(null);
      if (import.meta.env.DEV) console.error('Error toggling favorite:', error);
      toast.error('No se pudo actualizar favoritos');
    }
    setIsToggling(false);
  }, [user, businessId, isFavorite, onToggle, toast]);

  return (
    <IconButton
      aria-label={shown ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      onClick={toggleFavorite}
      disabled={isLoading || isToggling || !user}
      sx={{ color: shown ? '#ea4335' : 'text.secondary' }}
    >
      {shown ? <FavoriteIcon /> : <FavoriteBorderIcon />}
    </IconButton>
  );
}
