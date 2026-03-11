import { useState, useCallback } from 'react';
import { IconButton } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { useAuth } from '../../context/AuthContext';
import { invalidateQueryCache } from '../../hooks/usePaginatedQuery';

interface Props {
  businessId: string;
  isFavorite: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export default function FavoriteButton({ businessId, isFavorite, isLoading, onToggle }: Props) {
  const { user } = useAuth();
  const [isToggling, setIsToggling] = useState(false);

  const toggleFavorite = useCallback(async () => {
    if (!user) return;
    const docId = `${user.uid}__${businessId}`;
    setIsToggling(true);
    try {
      if (isFavorite) {
        await deleteDoc(doc(db, COLLECTIONS.FAVORITES, docId));
      } else {
        await setDoc(doc(db, COLLECTIONS.FAVORITES, docId), {
          userId: user.uid,
          businessId,
          createdAt: serverTimestamp(),
        });
      }
      invalidateQueryCache(COLLECTIONS.FAVORITES, user.uid);
      onToggle();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
    setIsToggling(false);
  }, [user, businessId, isFavorite, onToggle]);

  return (
    <IconButton
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      onClick={toggleFavorite}
      disabled={isLoading || isToggling || !user}
      sx={{ color: isFavorite ? '#ea4335' : '#5f6368' }}
    >
      {isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
    </IconButton>
  );
}
