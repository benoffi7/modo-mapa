import { useState, useEffect, useCallback, memo } from 'react';
import { Box, Typography, Rating, Button } from '@mui/material';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { ratingConverter } from '../../config/converters';
import { useAuth } from '../../context/AuthContext';

interface Props {
  businessId: string;
}

export default memo(function BusinessRating({ businessId }: Props) {
  const { user } = useAuth();
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const loadRatings = useCallback(async () => {
    const q = query(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter), where('businessId', '==', businessId));
    try {
      setError(false);
      const snapshot = await getDocs(q);

      let sum = 0;
      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        sum += data.score;
        count++;
        if (user && data.userId === user.uid) {
          setMyRating(data.score);
        }
      });

      setTotalRatings(count);
      setAverageRating(count > 0 ? sum / count : 0);
    } catch (err) {
      console.error('Error loading ratings:', err);
      setError(true);
    }
  }, [businessId, user]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  const handleRate = async (_: unknown, value: number | null) => {
    if (!user || !value) return;
    const docId = `${user.uid}__${businessId}`;
    await setDoc(doc(db, COLLECTIONS.RATINGS, docId), {
      userId: user.uid,
      businessId,
      score: value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setMyRating(value);
    loadRatings();
  };

  if (error) {
    return (
      <Box sx={{ py: 1, textAlign: 'center' }}>
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          Error al cargar calificaciones
        </Typography>
        <Button size="small" onClick={loadRatings}>Reintentar</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {averageRating > 0 ? averageRating.toFixed(1) : '—'}
        </Typography>
        <Rating value={averageRating} precision={0.1} readOnly size="small" />
        <Typography variant="body2">
          ({totalRatings} {totalRatings === 1 ? 'opinión' : 'opiniones'})
        </Typography>
      </Box>
      {user && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tu calificación:
          </Typography>
          <Rating
            value={myRating}
            onChange={handleRate}
            size="medium"
          />
        </Box>
      )}
    </Box>
  );
});
