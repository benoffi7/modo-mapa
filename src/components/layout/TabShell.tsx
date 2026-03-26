import { lazy, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import TabBar, { TAB_BAR_HEIGHT } from './TabBar';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useTab } from '../../context/TabContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useUnreadRecommendations } from '../../hooks/useUnreadRecommendations';
import { useDeepLinks } from '../../hooks/useDeepLinks';
import { ALL_TAB_IDS } from '../../types';
import type { TabId } from '../../types';

const SearchScreen = lazy(() => import('../search/SearchScreen'));
const NameDialog = lazy(() => import('../auth/NameDialog'));
const ListsScreen = lazy(() => import('../lists/ListsScreen'));
const SocialScreen = lazy(() => import('../social/SocialScreen'));
const ProfileScreen = lazy(() => import('../profile/ProfileScreen'));
const HomeScreen = lazy(() => import('../home/HomeScreen'));

function TabLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <CircularProgress size={28} />
    </Box>
  );
}

function TabContent({ tab, isActive }: { tab: TabId; isActive: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
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

// Uses ALL_TAB_IDS from types/index.ts

export default function TabShell() {
  const { activeTab } = useTab();
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;
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
        pb: `${TAB_BAR_HEIGHT}px`,
      }}
    >
      <OfflineIndicator />
      {ALL_TAB_IDS.map((tab) => (
        <TabContent key={tab} tab={tab} isActive={activeTab === tab} />
      ))}
      <Suspense fallback={null}>
        <NameDialog />
      </Suspense>
      <TabBar notificationBadge={unreadCount} recommendationBadge={recoUnread} />
    </Box>
  );
}
