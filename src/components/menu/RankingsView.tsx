import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../context/AuthContext';
import { useRankings } from '../../hooks/useRankings';
import { fetchUserLiveScore } from '../../services/rankings';
import RankingItem from './RankingItem';
import RankingsEmptyState from './RankingsEmptyState';
import UserProfileModal from './UserProfileModal';
import UserScoreCard from './UserScoreCard';
import { PERIOD_OPTIONS } from '../../constants/rankings';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import type { UserRankingEntry } from '../../types';

export default function RankingsView() {
  const { user, displayName } = useAuth();
  const { ranking, loading, error, periodType, setPeriodType, refetch, positionChanges } = useRankings();
  const [selectedProfile, setSelectedProfile] = useState<{ entry: UserRankingEntry; position: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('onboarding_ranking_viewed', 'true');
  }, []);

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
      .catch((err) => {
        console.error('[RankingsView] fetchUserLiveScore failed:', err);
        if (!cancelled) setLiveEntry(null);
      });

    return () => { cancelled = true; setLiveEntry(null); };
  }, [shouldFetchLive, uid, name, periodType]);

  const effectiveEntry = currentUserEntry ?? liveEntry ?? undefined;
  const handleRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Period selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, flexWrap: 'wrap' }}>
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
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Tooltip title="Filtro por zona (próximamente)">
            <span>
              <IconButton size="small" disabled>
                <PublicIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton size="small" onClick={refetch} disabled={loading} aria-label="Actualizar ranking">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <PullToRefreshWrapper onRefresh={handleRefresh}>
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
          <RankingsEmptyState noRankingData />
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
                  animationIndex={i}
                  positionChange={positionChanges.get(entry.userId)}
                  onClick={() => setSelectedProfile({ entry, position: i + 1 })}
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
      </PullToRefreshWrapper>

      {/* Current user card */}
      {!loading && !error && (ranking || liveEntry) && (
        <UserScoreCard
          entry={effectiveEntry}
          position={position}
          isLive={!currentUserEntry && liveEntry != null}
          periodLabel={PERIOD_OPTIONS.find((o) => o.value === periodType)?.label ?? 'semanal'}
          periodType={periodType}
        />
      )}

      {/* User profile modal */}
      {selectedProfile && (
        <UserProfileModal
          entry={selectedProfile.entry}
          position={selectedProfile.position}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </Box>
  );
}
