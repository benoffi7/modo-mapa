import { lazy, Suspense, useMemo } from 'react';
import { Box } from '@mui/material';
import TabBar, { TAB_BAR_HEIGHT } from './TabBar';
import TabLoader from '../ui/TabLoader';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useTab } from '../../context/TabContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useUnreadRecommendations } from '../../hooks/useUnreadRecommendations';
import { useDeepLinks } from '../../hooks/useDeepLinks';
import { ALL_TAB_IDS } from '../../types';
import type { TabId } from '../../types';

const SearchScreen = lazy(() => import('../search/SearchScreen'));
const ListsScreen = lazy(() => import('../lists/ListsScreen'));
const SocialScreen = lazy(() => import('../social/SocialScreen'));
const ProfileScreen = lazy(() => import('../profile/ProfileScreen'));
const HomeScreen = lazy(() => import('../home/HomeScreen'));

function TabContent({ tab, isActive }: { tab: TabId; isActive: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: `${TAB_BAR_HEIGHT}px`,
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
      }}
      role="tabpanel"
      aria-hidden={!isActive}
    >
      <Suspense fallback={<TabLoader />}>
        {tab === 'buscar' ? (
          <SearchScreen />
        ) : tab === 'inicio' ? (
          <HomeScreen />
        ) : tab === 'social' ? (
          <SocialScreen />
        ) : tab === 'listas' ? (
          <ListsScreen />
        ) : (
          <ProfileScreen />
        )}
      </Suspense>
    </Box>
  );
}

export default function TabShell() {
  const { activeTab } = useTab();
  const { notifications } = useNotifications();
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const { unreadCount: recoUnread } = useUnreadRecommendations();

  // Deep links
  useDeepLinks();

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <OfflineIndicator />
      {ALL_TAB_IDS.map((tab) => (
        <TabContent key={tab} tab={tab} isActive={activeTab === tab} />
      ))}
      <TabBar notificationBadge={unreadCount} recommendationBadge={recoUnread} />
    </Box>
  );
}
