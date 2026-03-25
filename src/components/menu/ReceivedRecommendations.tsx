import { useEffect, useCallback, useMemo } from 'react';
import {
  List, ListItemButton, ListItemAvatar, ListItemText,
  Avatar, Typography, Box,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { where } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { getRecommendationsCollection, markRecommendationAsRead, markAllRecommendationsAsRead } from '../../services/recommendations';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { PaginatedListShell } from './PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { formatRelativeTime } from '../../utils/formatDate';
import { trackEvent } from '../../utils/analytics';
import { EVT_RECOMMENDATION_OPENED, EVT_RECOMMENDATION_LIST_VIEWED } from '../../constants/analyticsEvents';
import { allBusinesses } from '../../hooks/useBusinesses';
import type { Business, Recommendation } from '../../types';
import { logger } from '../../utils/logger';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function ReceivedRecommendations({ onSelectBusiness }: Props) {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const userId = user?.uid;

  const collectionRef = useMemo(() => getRecommendationsCollection(), []);
  const constraints = useMemo(
    (): QueryConstraint[] => (userId ? [where('recipientId', '==', userId)] : []),
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
        if (import.meta.env.DEV) logger.error('markAllRead failed:', err);
      });
    }
  }, [userId]);

  const handleClick = useCallback((rec: Recommendation) => {
    const business = allBusinesses.find((b) => b.id === rec.businessId);
    if (business) {
      if (!rec.read && userId) {
        withOfflineSupport(
          isOffline,
          'recommendation_read',
          { userId, businessId: rec.businessId, referenceId: rec.id },
          {},
          () => markRecommendationAsRead(rec.id),
        ).catch((err) => {
          if (import.meta.env.DEV) logger.error('markRead failed:', err);
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
          emptyMessage="Todavia no recibiste recomendaciones"
          emptySubtext="Segui a otros usuarios para empezar!"
          onRetry={reload}
          onLoadMore={loadMore}
        >
          <List dense disablePadding>
            {items.map((rec) => (
              <ListItemButton
                key={rec.id}
                onClick={() => handleClick(rec)}
                sx={{
                  bgcolor: rec.read ? 'transparent' : 'action.hover',
                  borderLeft: rec.read ? 'none' : '3px solid',
                  borderLeftColor: rec.read ? 'transparent' : 'secondary.main',
                  py: 1,
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ width: 36, height: 36, fontSize: 16, bgcolor: 'secondary.main' }}>
                    {rec.senderName.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2">
                      <strong>{rec.senderName}</strong> te recomienda{' '}
                      <strong>{rec.businessName}</strong>
                    </Typography>
                  }
                  secondary={
                    <>
                      {rec.message && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>
                          &ldquo;{rec.message}&rdquo;
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatRelativeTime(rec.createdAt)}
                      </Typography>
                    </>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </PaginatedListShell>
      </PullToRefreshWrapper>
    </Box>
  );
}
