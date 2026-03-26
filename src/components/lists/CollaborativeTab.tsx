import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import { useAuth } from '../../context/AuthContext';
import { fetchSharedWithMe } from '../../services/sharedLists';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import ListCardGrid from './ListCardGrid';
import ListDetailScreen from './ListDetailScreen';
import type { SharedList } from '../../types';

export default function CollaborativeTab() {
  const { user } = useAuth();
  const [lists, setLists] = useState<SharedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedList, setSelectedList] = useState<SharedList | null>(null);

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      setLists(await fetchSharedWithMe(user.uid));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedList) {
    return (
      <ListDetailScreen
        list={selectedList}
        onBack={() => { setSelectedList(null); load(); }}
        onDeleted={() => { setSelectedList(null); load(); }}
        readOnly
      />
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (lists.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          No participas en listas colaborativas todavia
        </Typography>
      </Box>
    );
  }

  return (
    <PullToRefreshWrapper onRefresh={load}>
      <ListCardGrid lists={lists} onListClick={setSelectedList} readOnly />
    </PullToRefreshWrapper>
  );
}
