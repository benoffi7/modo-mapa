import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import { useAuth } from '../../context/AuthContext';
import { fetchSharedWithMe } from '../../services/sharedLists';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import ListCardGrid from './ListCardGrid';
import ListDetailScreen from './ListDetailScreen';
import { MSG_LIST } from '../../constants/messages';
import type { SharedList } from '../../types';

interface Props {
  onRegisterBackHandler?: (handler: (() => boolean) | null) => void;
}

export default function CollaborativeTab({ onRegisterBackHandler }: Props = {}) {
  const { user } = useAuth();
  const [lists, setLists] = useState<SharedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedList, setSelectedList] = useState<SharedList | null>(null);

  useEffect(() => {
    onRegisterBackHandler?.(() => {
      if (selectedList) {
        setSelectedList(null);
        return true;
      }
      return false;
    });
    return () => onRegisterBackHandler?.(null);
  }, [selectedList, onRegisterBackHandler]);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      setLists(await fetchSharedWithMe(user.uid));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

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
          {MSG_LIST.emptyCollaborative}
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
