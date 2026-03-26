import { useState, lazy, Suspense } from 'react';
import { Box, Chip, Badge, Typography } from '@mui/material';
import TabLoader from '../ui/TabLoader';


import { useTab } from '../../context/TabContext';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { useUnreadRecommendations } from '../../hooks/useUnreadRecommendations';
import { trackEvent } from '../../utils/analytics';
import { EVT_SUB_TAB_SWITCHED } from '../../constants/analyticsEvents';
import { NAV_CHIP_SX } from '../../constants/ui';
import type { SocialSubTab, Business } from '../../types';

const ActivityFeedView = lazy(() => import('../menu/ActivityFeedView').then((m) => ({ default: m.ActivityFeedView })));
const FollowedList = lazy(() => import('../menu/FollowedList').then((m) => ({ default: m.FollowedList })));
const ReceivedRecommendations = lazy(() => import('../menu/ReceivedRecommendations'));
const RankingsView = lazy(() => import('../menu/RankingsView'));
const UserProfileSheet = lazy(() => import('../user/UserProfileSheet'));

const SUB_TABS: { id: SocialSubTab; label: string }[] = [
  { id: 'actividad', label: 'Actividad' },
  { id: 'seguidos', label: 'Seguidos' },
  { id: 'recomendaciones', label: 'Recomendaciones' },
  { id: 'rankings', label: 'Rankings' },
];

export default function SocialScreen() {
  const { socialSubTab, setSocialSubTab } = useTab();
  const { navigateToBusiness } = useNavigateToBusiness();
  const { unreadCount } = useUnreadRecommendations();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const handleChipClick = (tab: SocialSubTab) => {
    trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'social', sub_tab: tab });
    setSocialSubTab(tab);
  };

  const handleSelectBusiness = (biz: Business) => navigateToBusiness(biz);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
        <Typography variant="h6" fontWeight={700}>Social</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1, overflow: 'auto' }}>
        {SUB_TABS.map((t) => (
          <Badge
            key={t.id}
            badgeContent={t.id === 'recomendaciones' ? unreadCount : 0}
            color="error"
            max={9}
            sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}
          >
            <Chip
              label={t.label}
              onClick={() => handleChipClick(t.id)}
              variant={socialSubTab === t.id ? 'filled' : 'outlined'}
              color={socialSubTab === t.id ? 'primary' : 'default'}
              sx={{ ...NAV_CHIP_SX, fontWeight: socialSubTab === t.id ? 600 : 400 }}
            />
          </Badge>
        ))}
      </Box>

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
          {socialSubTab === 'rankings' && <RankingsView />}
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
