import { lazy, Suspense, useMemo } from 'react';
import { Box } from '@mui/material';
import TabBar from './TabBar';
import TabLoader from '../ui/TabLoader';
import { useTab } from '../../context/TabContext';
import { useNavLayout } from '../../hooks/useNavLayout';
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

function TabContent({ tab, isActive, navLayout }: { tab: TabId; isActive: boolean; navLayout: { position: 'bottom' | 'left'; offset: number } }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: navLayout.position === 'left' ? `${navLayout.offset}px` : 0,
        right: 0,
        bottom: navLayout.position === 'bottom' ? `${navLayout.offset}px` : 0,
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
  const navLayout = useNavLayout();
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
      {ALL_TAB_IDS.map((tab) => (
        <TabContent key={tab} tab={tab} isActive={activeTab === tab} navLayout={navLayout} />
      ))}
      <TabBar notificationBadge={unreadCount} recommendationBadge={recoUnread} />
    </Box>
  );
}
