import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../context/AuthContext';
import { useRankings } from '../../hooks/useRankings';
import { fetchUserLiveScore } from '../../services/rankings';
import RankingItem from './RankingItem';
import UserScoreCard from './UserScoreCard';
import { PERIOD_OPTIONS } from '../../constants/rankings';
import type { UserRankingEntry } from '../../types';

export default function RankingsView() {
  const { user, displayName } = useAuth();
  const { ranking, loading, error, periodType, setPeriodType } = useRankings();

  const maxScore = ranking?.rankings[0]?.score ?? 0;
  const currentUserEntry = ranking?.rankings.find((e) => e.userId === user?.uid);
  const currentUserPosition = ranking?.rankings.findIndex((e) => e.userId === user?.uid);
  const position = currentUserPosition != null && currentUserPosition >= 0 ? currentUserPosition + 1 : undefined;

  // Live score fallback when user is not in the pre-computed ranking
  const [liveEntry, setLiveEntry] = useState<UserRankingEntry | null>(null);
  const shouldFetchLive = !!user && !loading && !currentUserEntry;
  const uid = user?.uid;
  const name = displayName || 'Anónimo';

  useEffect(() => {
    if (!shouldFetchLive || !uid) return;

    let cancelled = false;
    fetchUserLiveScore(uid, name, periodType)
      .then((entry) => {
        if (!cancelled) setLiveEntry(entry.score > 0 ? entry : null);
      })
      .catch(() => {
        if (!cancelled) setLiveEntry(null);
      });

    return () => { cancelled = true; setLiveEntry(null); };
  }, [shouldFetchLive, uid, name, periodType]);

  const effectiveEntry = currentUserEntry ?? liveEntry ?? undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Period selector */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 2, py: 1.5, flexWrap: 'wrap' }}>
        {PERIOD_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            color={periodType === opt.value ? 'primary' : 'default'}
            variant={periodType === opt.value ? 'filled' : 'outlined'}
            onClick={() => setPeriodType(opt.value)}
          />
        ))}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="error">
              Error cargando el ranking.
            </Typography>
          </Box>
        )}

        {!loading && !error && !ranking && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No hay ranking disponible para este periodo.
            </Typography>
          </Box>
        )}

        {!loading && !error && ranking && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1.5 }}>
              {ranking.rankings.map((entry, i) => (
                <RankingItem
                  key={entry.userId}
                  entry={entry}
                  position={i + 1}
                  maxScore={maxScore}
                  isCurrentUser={entry.userId === user?.uid}
                />
              ))}
            </Box>

            {ranking.totalParticipants > ranking.rankings.length && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', pb: 1 }}>
                Mostrando top {ranking.rankings.length} de {ranking.totalParticipants} participantes
              </Typography>
            )}
          </>
        )}
      </Box>

      {/* Current user card */}
      {!loading && !error && (ranking || liveEntry) && (
        <UserScoreCard entry={effectiveEntry} position={position} isLive={!currentUserEntry && liveEntry != null} />
      )}
    </Box>
  );
}
