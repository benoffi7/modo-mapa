import { lazy, Suspense } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import SearchScreen from '../search/SearchScreen';
import TabBar from './TabBar';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useTab } from '../../context/TabContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useDeepLinks } from '../../hooks/useDeepLinks';
import type { TabId } from '../../types';

const NameDialog = lazy(() => import('../auth/NameDialog'));

function TabPlaceholder({ label }: { label: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
      <Typography variant="h6" color="text.secondary">{label}</Typography>
      <Typography variant="body2" color="text.disabled">Proximamente</Typography>
    </Box>
  );
}

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
          <TabPlaceholder label="Inicio" />
        ) : tab === 'social' ? (
          <TabPlaceholder label="Social" />
        ) : tab === 'listas' ? (
          <TabPlaceholder label="Listas" />
        ) : (
          <TabPlaceholder label="Perfil" />
        )}
      </Suspense>
    </Box>
  );
}

const ALL_TABS: TabId[] = ['inicio', 'social', 'buscar', 'listas', 'perfil'];

export default function TabShell() {
  const { activeTab } = useTab();
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Deep links
  useDeepLinks();

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        pb: '64px', // Space for TabBar
      }}
    >
      <OfflineIndicator />
      {ALL_TABS.map((tab) => (
        <TabContent key={tab} tab={tab} isActive={activeTab === tab} />
      ))}
      <Suspense fallback={null}>
        <NameDialog />
      </Suspense>
      <TabBar notificationBadge={unreadCount} />
    </Box>
  );
}
