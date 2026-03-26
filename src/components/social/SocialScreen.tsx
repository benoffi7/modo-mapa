import { useState, lazy, Suspense } from 'react';
import { Box, Tabs, Tab, Badge, Typography, CircularProgress } from '@mui/material';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import PeopleIcon from '@mui/icons-material/People';
import SendIcon from '@mui/icons-material/Send';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { useTab } from '../../context/TabContext';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { useUnreadRecommendations } from '../../hooks/useUnreadRecommendations';
import { trackEvent } from '../../utils/analytics';
import { EVT_SUB_TAB_SWITCHED } from '../../constants/analyticsEvents';
import type { SocialSubTab } from '../../types';
import type { Business } from '../../types';

const ActivityFeedView = lazy(() => import('../menu/ActivityFeedView').then((m) => ({ default: m.ActivityFeedView })));
const FollowedList = lazy(() => import('../menu/FollowedList').then((m) => ({ default: m.FollowedList })));
const ReceivedRecommendations = lazy(() => import('../menu/ReceivedRecommendations'));
const RankingsView = lazy(() => import('../menu/RankingsView'));
const UserProfileSheet = lazy(() => import('../user/UserProfileSheet'));

const SUB_TABS: { id: SocialSubTab; label: string; icon: React.ReactElement }[] = [
  { id: 'actividad', label: 'Actividad', icon: <RssFeedIcon fontSize="small" /> },
  { id: 'seguidos', label: 'Seguidos', icon: <PeopleIcon fontSize="small" /> },
  { id: 'recomendaciones', label: 'Recos', icon: <SendIcon fontSize="small" /> },
  { id: 'rankings', label: 'Rankings', icon: <LeaderboardIcon fontSize="small" /> },
];

function TabLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export default function SocialScreen() {
  const { socialSubTab, setSocialSubTab } = useTab();
  const { navigateToBusiness } = useNavigateToBusiness();
  const { unreadCount } = useUnreadRecommendations();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const handleChange = (_: unknown, newValue: number) => {
    const tab = SUB_TABS[newValue].id;
    trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'social', sub_tab: tab });
    setSocialSubTab(tab);
  };

  const handleSelectBusiness = (biz: Business) => navigateToBusiness(biz);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
        <Typography variant="h6" fontWeight={700}>Social</Typography>
      </Box>
      <Tabs
        value={SUB_TABS.findIndex((t) => t.id === socialSubTab)}
        onChange={handleChange}
        variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5 } }}
      >
        {SUB_TABS.map((t) => (
          <Tab
            key={t.id}
            icon={
              t.id === 'recomendaciones' ? (
                <Badge badgeContent={unreadCount} color="error" max={9}>
                  {t.icon}
                </Badge>
              ) : t.icon
            }
            label={t.label}
            iconPosition="start"
          />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={<TabLoader />}>
          {socialSubTab === 'actividad' && (
            <ActivityFeedView onBusinessClick={(bizId) => navigateToBusiness(bizId)} />
          )}
          {socialSubTab === 'seguidos' && (
            <FollowedList onUserClick={setProfileUserId} />
          )}
          {socialSubTab === 'recomendaciones' && (
            <ReceivedRecommendations onSelectBusiness={handleSelectBusiness} />
          )}
          {socialSubTab === 'rankings' && (
            <RankingsView />
          )}
        </Suspense>
      </Box>
      <Suspense fallback={null}>
        {profileUserId && (
          <UserProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />
        )}
      </Suspense>
    </Box>
  );
}
