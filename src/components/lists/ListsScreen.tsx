import { lazy, Suspense } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import TabLoader from '../ui/TabLoader';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ListAltIcon from '@mui/icons-material/ListAlt';
import HistoryIcon from '@mui/icons-material/History';
import GroupIcon from '@mui/icons-material/Group';
import { useTab } from '../../context/TabContext';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { trackEvent } from '../../utils/analytics';
import { EVT_SUB_TAB_SWITCHED } from '../../constants/analyticsEvents';
import type { ListsSubTab } from '../../types';

const FavoritesList = lazy(() => import('../menu/FavoritesList'));
const SharedListsView = lazy(() => import('../menu/SharedListsView'));
const RecentsUnifiedTab = lazy(() => import('./RecentsUnifiedTab'));
const CollaborativeTab = lazy(() => import('./CollaborativeTab'));

const SUB_TABS: { id: ListsSubTab; label: string; icon: React.ReactElement }[] = [
  { id: 'favoritos', label: 'Favoritos', icon: <FavoriteIcon fontSize="small" /> },
  { id: 'listas', label: 'Listas', icon: <ListAltIcon fontSize="small" /> },
  { id: 'recientes', label: 'Recientes', icon: <HistoryIcon fontSize="small" /> },
  { id: 'colaborativas', label: 'Colab.', icon: <GroupIcon fontSize="small" /> },
];

export default function ListsScreen() {
  const { listsSubTab, setListsSubTab } = useTab();
  const { navigateToBusiness } = useNavigateToBusiness();

  const handleChange = (_: unknown, newValue: number) => {
    const tab = SUB_TABS[newValue].id;
    trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'listas', sub_tab: tab });
    setListsSubTab(tab);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
        <Typography variant="h6" fontWeight={700}>Mis Listas</Typography>
      </Box>
      <Tabs
        value={SUB_TABS.findIndex((t) => t.id === listsSubTab)}
        onChange={handleChange}
        variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5 } }}
      >
        {SUB_TABS.map((t) => (
          <Tab key={t.id} icon={t.icon} label={t.label} iconPosition="start" />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={<TabLoader />}>
          {listsSubTab === 'favoritos' && (
            <FavoritesList onSelectBusiness={(biz) => navigateToBusiness(biz)} />
          )}
          {listsSubTab === 'listas' && (
            <SharedListsView onSelectBusiness={(biz) => navigateToBusiness(biz)} />
          )}
          {listsSubTab === 'recientes' && <RecentsUnifiedTab />}
          {listsSubTab === 'colaborativas' && <CollaborativeTab />}
        </Suspense>
      </Box>
    </Box>
  );
}
