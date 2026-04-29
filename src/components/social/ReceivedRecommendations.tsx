import { useEffect, useCallback, useMemo } from 'react';
import { useSocialSubTabRefresh } from '../../hooks/useTabRefresh';
import {
  Typography, Box,
} from '@mui/material';
import { cardSx } from '../../theme/cards';
import SendIcon from '@mui/icons-material/Send';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { getRecommendationsCollection, getReceivedRecommendationsConstraints, markRecommendationAsRead, markAllRecommendationsAsRead } from '../../services/recommendations';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { PaginatedListShell } from '../common/PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { MSG_SOCIAL } from '../../constants/messages';


import { trackEvent } from '../../utils/analytics';
import { EVT_RECOMMENDATION_OPENED, EVT_RECOMMENDATION_LIST_VIEWED } from '../../constants/analyticsEvents';
import { getBusinessById } from '../../utils/businessMap';
import { useSortLocation } from '../../hooks/useSortLocation';
import { distanceKm, formatDistance } from '../../utils/distance';
import { CATEGORY_LABELS } from '../../constants/business';
import type { Business, BusinessCategory, Recommendation } from '../../types';
import { logger } from '../../utils/logger';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function ReceivedRecommendations({ onSelectBusiness }: Props) {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const userId = user?.uid;
  const sortLocation = useSortLocation();

  const collectionRef = useMemo(() => getRecommendationsCollection(), []);
  const constraints = useMemo(
    () => (userId ? getReceivedRecommendationsConstraints(userId) : []),
    [userId],
  );

  const { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload } = usePaginatedQuery<Recommendation>(
    userId ? collectionRef : null,
    constraints,
    'createdAt',
    20,
    userId,
  );

  useEffect(() => {
    trackEvent(EVT_RECOMMENDATION_LIST_VIEWED);
    if (userId) {
      markAllRecommendationsAsRead(userId).catch((err) => {
        logger.error('markAllRead failed:', err);
      });
    }
  }, [userId]);

  // Reload when social > recomendaciones becomes active
  useSocialSubTabRefresh('recomendaciones', reload);

  const handleClick = useCallback((rec: Recommendation) => {
    const business = getBusinessById(rec.businessId);
    if (business) {
      if (!rec.read && userId) {
        withOfflineSupport(
          isOffline,
          'recommendation_read',
          { userId, businessId: rec.businessId, referenceId: rec.id },
          {},
          () => markRecommendationAsRead(rec.id),
        ).catch((err) => {
          logger.error('markRead failed:', err);
        });
      }
      trackEvent(EVT_RECOMMENDATION_OPENED, { business_id: rec.businessId, sender_id: rec.senderId });
      onSelectBusiness(business);
    }
  }, [onSelectBusiness, isOffline, userId]);

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <PullToRefreshWrapper onRefresh={reload}>
        <PaginatedListShell
          isLoading={isLoading}
          error={error}
          isEmpty={items.length === 0}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          emptyIcon={<SendIcon sx={{ fontSize: 48 }} />}
          emptyMessage={MSG_SOCIAL.emptyRecommendations}
          emptySubtext="Seguí a otros usuarios para empezar!"
          onRetry={reload}
          onLoadMore={loadMore}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {items.map((rec) => {
              const biz = getBusinessById(rec.businessId);
              const dist = biz ? formatDistance(distanceKm(sortLocation.lat, sortLocation.lng, biz.lat, biz.lng)) : '';
              const cat = biz ? (CATEGORY_LABELS[biz.category as BusinessCategory] ?? biz.category) : '';
              return (
                <Box
                  key={rec.id}
                  onClick={() => handleClick(rec)}
                  sx={{ ...cardSx, borderColor: rec.read ? 'divider' : 'primary.main' }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{rec.businessName}</Typography>
                      <Typography variant="caption" color="primary.main">{cat}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Typography sx={{ fontSize: 14, color: 'warning.main' }}>&#9733;</Typography>
                      <Typography variant="caption" fontWeight={600}>--</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 1, pt: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                    {dist && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <PlaceOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{dist}</Typography>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Recomendado por {rec.senderName}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </PaginatedListShell>
      </PullToRefreshWrapper>
    </Box>
  );
}
