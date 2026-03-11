import { useState, useEffect, useCallback } from 'react';
import { IconButton } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

interface Props {
  businessId: string;
}

export default function FavoriteButton({ businessId }: Props) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const docId = user ? `${user.uid}__${businessId}` : null;

  useEffect(() => {
    if (!docId) return;
    getDoc(doc(db, 'favorites', docId)).then((snap) => {
      setIsFavorite(snap.exists());
      setIsLoading(false);
    });
  }, [docId]);

  const toggleFavorite = useCallback(async () => {
    if (!user || !docId) return;
    setIsLoading(true);
    try {
      if (isFavorite) {
        await deleteDoc(doc(db, 'favorites', docId));
        setIsFavorite(false);
      } else {
        await setDoc(doc(db, 'favorites', docId), {
          userId: user.uid,
          businessId,
          createdAt: serverTimestamp(),
        });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
    setIsLoading(false);
  }, [user, docId, isFavorite, businessId]);

  return (
    <IconButton
      onClick={toggleFavorite}
      disabled={isLoading || !user}
      sx={{ color: isFavorite ? '#ea4335' : '#5f6368' }}
    >
      {isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
    </IconButton>
  );
}
