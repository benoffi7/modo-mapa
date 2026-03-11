import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Rating } from '@mui/material';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

interface Props {
  businessId: string;
}

export default function BusinessRating({ businessId }: Props) {
  const { user } = useAuth();
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);

  const loadRatings = useCallback(async () => {
    const q = query(collection(db, 'ratings'), where('businessId', '==', businessId));
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
  }, [businessId, user]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  const handleRate = async (_: unknown, value: number | null) => {
    if (!user || !value) return;
    const docId = `${user.uid}__${businessId}`;
    await setDoc(doc(db, 'ratings', docId), {
      userId: user.uid,
      businessId,
      score: value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setMyRating(value);
    loadRatings();
  };

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
}
