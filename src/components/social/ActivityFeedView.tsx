import { useCallback } from 'react';
import { Box, List } from '@mui/material';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import { useAuth } from '../../context/AuthContext';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { PaginatedListShell } from '../common/PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { MSG_SOCIAL } from '../../constants/messages';
import { ActivityFeedItemRow } from './ActivityFeedItem';
import { trackEvent } from '../../utils/analytics';
import { EVT_FEED_VIEWED, EVT_FEED_ITEM_CLICKED } from '../../constants/analyticsEvents';
import { useEffect } from 'react';
import { useSocialSubTabRefresh } from '../../hooks/useTabRefresh';

interface ActivityFeedViewProps {
  onBusinessClick: (businessId: string) => void;
}

export function ActivityFeedView({ onBusinessClick }: ActivityFeedViewProps) {
  const { user } = useAuth();
  const { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload } = useActivityFeed(user?.uid);

  useEffect(() => {
    trackEvent(EVT_FEED_VIEWED);
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reload on mount only

  // Reload when social > actividad becomes active
  useSocialSubTabRefresh('actividad', reload);

  const handleItemClick = useCallback((businessId: string) => {
    trackEvent(EVT_FEED_ITEM_CLICKED, { business_id: businessId });
    onBusinessClick(businessId);
  }, [onBusinessClick]);

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <PullToRefreshWrapper onRefresh={reload}>
        <PaginatedListShell
          isLoading={isLoading}
          error={error}
          isEmpty={items.length === 0}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          emptyIcon={<RssFeedIcon sx={{ fontSize: 48 }} />}
          emptyMessage={MSG_SOCIAL.emptyActivity}
          emptySubtext="Seguí a otros usuarios para ver su actividad acá"
          onRetry={reload}
          onLoadMore={loadMore}
        >
          <List dense disablePadding>
            {items.map((item) => (
              <ActivityFeedItemRow
                key={item.id}
                item={item}
                onClick={handleItemClick}
              />
            ))}
          </List>
        </PaginatedListShell>
      </PullToRefreshWrapper>
    </Box>
  );
}
