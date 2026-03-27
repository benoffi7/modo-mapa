import { lazy, Suspense, useState } from 'react';
import { Box, Chip, Typography, IconButton } from '@mui/material';
import TabLoader from '../ui/TabLoader';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import AddIcon from '@mui/icons-material/Add';
import CreateListDialog from '../menu/CreateListDialog';
import { useTab } from '../../context/TabContext';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { trackEvent } from '../../utils/analytics';
import { EVT_SUB_TAB_SWITCHED } from '../../constants/analyticsEvents';
import { NAV_CHIP_SX } from '../../constants/ui';
import type { ListsSubTab } from '../../types';

const FavoritesList = lazy(() => import('../menu/FavoritesList'));
const SharedListsView = lazy(() => import('../menu/SharedListsView'));
const RecentsUnifiedTab = lazy(() => import('./RecentsUnifiedTab'));
const CollaborativeTab = lazy(() => import('./CollaborativeTab'));

const SUB_TABS: { id: ListsSubTab; label: string; icon: React.ReactElement }[] = [
  { id: 'favoritos', label: 'Favoritos', icon: <FavoriteBorderIcon sx={{ fontSize: 18 }} /> },
  { id: 'listas', label: 'Listas', icon: <FolderOutlinedIcon sx={{ fontSize: 18 }} /> },
  { id: 'recientes', label: 'Recientes', icon: <HistoryOutlinedIcon sx={{ fontSize: 18 }} /> },
  { id: 'colaborativas', label: 'Social', icon: <GroupOutlinedIcon sx={{ fontSize: 18 }} /> },
];

export default function ListsScreen() {
  const { listsSubTab, setListsSubTab } = useTab();
  const { navigateToBusiness } = useNavigateToBusiness();
  const [createOpen, setCreateOpen] = useState(false);

  const handleChipClick = (tab: ListsSubTab) => {
    trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'listas', sub_tab: tab });
    setListsSubTab(tab);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2, pb: 0.5 }}>
        <Typography variant="h6" fontWeight={700}>Mis Listas</Typography>
        <IconButton
          size="small"
          onClick={() => setCreateOpen(true)}
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          <AddIcon />
        </IconButton>
      </Box>

      {/* Chip tabs */}
      <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1, overflow: 'auto' }}>
        {SUB_TABS.map((t) => (
          <Chip
            key={t.id}
            icon={t.icon}
            label={t.label}
            onClick={() => handleChipClick(t.id)}
            variant={listsSubTab === t.id ? 'filled' : 'outlined'}
            color={listsSubTab === t.id ? 'primary' : 'default'}
            sx={{
              ...NAV_CHIP_SX,
              fontWeight: listsSubTab === t.id ? 600 : 400,
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
        ))}
      </Box>

      {/* Content */}
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
      <CreateListDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setListsSubTab('listas');
        }}
      />
    </Box>
  );
}
