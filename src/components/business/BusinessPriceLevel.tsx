import { useMemo, useState, memo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { upsertPriceLevel, deletePriceLevel } from '../../services/priceLevels';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { PRICE_LEVEL_LABELS } from '../../constants/business';
import { LEVELS, LEVEL_SYMBOLS } from '../../constants/business';
import type { PriceLevel } from '../../types';

interface Props {
  businessId: string;
  businessName?: string;
  priceLevels: PriceLevel[];
  isLoading: boolean;
  onPriceLevelChange: () => void;
}

export default memo(function BusinessPriceLevel({ businessId, businessName, priceLevels, isLoading, onPriceLevelChange }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();

  const { averageLevel, totalVotes, serverMyLevel } = useMemo(() => {
    let sum = 0;
    let myLevel: number | null = null;
    for (const pl of priceLevels) {
      sum += pl.level;
      if (user && pl.userId === user.uid) {
        myLevel = pl.level;
      }
    }
    return {
      averageLevel: priceLevels.length > 0 ? Math.round(sum / priceLevels.length) : 0,
      totalVotes: priceLevels.length,
      serverMyLevel: myLevel,
    };
  }, [priceLevels, user]);

  // pendingLevel: number = voting, 0 = pending delete, null = no change
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const myLevel = pendingLevel === 0 ? null : (pendingLevel ?? serverMyLevel);

  const handleVote = async (level: number) => {
    if (!user) return;
    // Toggle: click same level = remove vote
    if (myLevel === level) {
      setPendingLevel(0);
      try {
        await withOfflineSupport(
          isOffline, 'price_level_delete',
          { userId: user.uid, businessId, businessName },
          { _type: 'price_level_delete' },
          () => deletePriceLevel(user.uid, businessId),
          toast,
        );
        onPriceLevelChange();
      } catch {
        setPendingLevel(null);
      }
    } else {
      setPendingLevel(level);
      try {
        await withOfflineSupport(
          isOffline, 'price_level_upsert',
          { userId: user.uid, businessId, businessName },
          { level },
          () => upsertPriceLevel(user.uid, businessId, level),
          toast,
        );
        onPriceLevelChange();
      } catch {
        setPendingLevel(null);
      }
    }
  };

  if (!isLoading && priceLevels.length === 0 && !user) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">Sin votos de nivel de gasto</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Nivel de gasto</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {averageLevel > 0 ? (
          <>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {LEVEL_SYMBOLS[averageLevel]}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {PRICE_LEVEL_LABELS[averageLevel]}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">{'\u2014'}</Typography>
        )}
        <Typography variant="body2">
          ({totalVotes} {totalVotes === 1 ? 'voto' : 'votos'})
        </Typography>
      </Box>
      {user && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tu voto:
          </Typography>
          {LEVELS.map((level) => (
            <Button
              key={level}
              size="small"
              variant={myLevel === level ? 'contained' : 'outlined'}
              onClick={() => handleVote(level)}
              sx={{ minWidth: 'auto', px: 1.5 }}
            >
              {LEVEL_SYMBOLS[level]}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
});
