import { useState, useEffect, useCallback } from 'react';
import { useSocialSubTabRefresh } from '../../hooks/useTabRefresh';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import PlaceIcon from '@mui/icons-material/Place';
import RefreshIcon from '@mui/icons-material/Refresh';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../context/AuthContext';
import { useRankings } from '../../hooks/useRankings';
import { fetchUserLiveScore } from '../../services/rankings';
import { useLocalTrending } from '../../hooks/useLocalTrending';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { allBusinesses } from '../../hooks/useBusinesses';
import { trackEvent } from '../../utils/analytics';
import { EVT_RANKINGS_ZONE_FILTER, EVT_TRENDING_NEAR_TAPPED } from '../../constants/analyticsEvents';
import RankingItem from './RankingItem';
import RankingsEmptyState from './RankingsEmptyState';
import UserProfileModal from './UserProfileModal';
import UserScoreCard from './UserScoreCard';
import TrendingBusinessCard from '../home/TrendingBusinessCard';
import { PERIOD_OPTIONS } from '../../constants/rankings';
import { STORAGE_KEY_ONBOARDING_RANKING_VIEWED } from '../../constants/storage';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { NAV_CHIP_SX } from '../../constants/ui';
import type { UserRankingEntry, Business } from '../../types';
import { logger } from '../../utils/logger';

export default function RankingsView() {
  const { user, displayName } = useAuth();
  const { ranking, loading, error, periodType, setPeriodType, refetch, positionChanges } = useRankings();
  const [selectedProfile, setSelectedProfile] = useState<{ entry: UserRankingEntry; position: number } | null>(null);
  const [zoneFilter, setZoneFilter] = useState(false);
  const { businesses: zoneTrending, source: zoneSource, loading: zoneLoading } = useLocalTrending();
  const { navigateToBusiness } = useNavigateToBusiness();

  const businessMap = new Map(allBusinesses.map((b) => [b.id, b]));

  const handleToggleZone = () => {
    const next = !zoneFilter;
    setZoneFilter(next);
    trackEvent(EVT_RANKINGS_ZONE_FILTER, { enabled: next });
  };

  const handleZoneBusinessSelect = (business: Business) => {
    const biz = zoneTrending.find((b) => b.businessId === business.id);
    trackEvent(EVT_TRENDING_NEAR_TAPPED, {
      business_id: business.id,
      rank: biz?.rank ?? 0,
      source: zoneSource,
    });
    navigateToBusiness(business);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ONBOARDING_RANKING_VIEWED, 'true');
  }, []);

  const handleRefreshRankings = useCallback(async () => { await refetch(); }, [refetch]);
  useSocialSubTabRefresh('rankings', handleRefreshRankings);

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
        logger.error('[RankingsView] fetchUserLiveScore failed:', err);
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
            sx={NAV_CHIP_SX}
          />
        ))}
        <Chip
          icon={<PlaceIcon sx={{ fontSize: 16 }} />}
          label="Mi zona"
          size="small"
          color={zoneFilter ? 'primary' : 'default'}
          variant={zoneFilter ? 'filled' : 'outlined'}
          onClick={handleToggleZone}
          sx={NAV_CHIP_SX}
        />
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton size="small" onClick={refetch} disabled={loading} aria-label="Actualizar ranking">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <PullToRefreshWrapper onRefresh={handleRefresh}>
        {zoneFilter ? (
          // Zone trending view
          <>
            {zoneLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={32} />
              </Box>
            )}
            {!zoneLoading && zoneTrending.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No hay comercios en tendencia en tu zona.
                </Typography>
              </Box>
            )}
            {!zoneLoading && zoneTrending.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', pb: 1.5 }}>
                {zoneTrending.map((biz) => (
                  <TrendingBusinessCard
                    key={biz.businessId}
                    business={biz}
                    fullBusiness={businessMap.get(biz.businessId)}
                    rank={biz.rank}
                    onSelectBusiness={handleZoneBusinessSelect}
                  />
                ))}
              </Box>
            )}
          </>
        ) : (
          // Standard user rankings view
          <>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={32} />
              </Box>
            )}

            {error && (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="error">
                  No se pudo cargar el ranking.
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
