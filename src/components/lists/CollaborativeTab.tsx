import { useState, useEffect, useCallback } from 'react';
import { useListsSubTabRefresh } from '../../hooks/useTabRefresh';
import { Box, Typography, CircularProgress, List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import { useAuth } from '../../context/AuthContext';
import { fetchSharedWithMe } from '../../services/sharedLists';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { trackEvent } from '../../utils/analytics';
import type { SharedList } from '../../types';

export default function CollaborativeTab() {
  const { user } = useAuth();
  const [lists, setLists] = useState<SharedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const result = await fetchSharedWithMe(user.uid);
      setLists(result);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(async () => { await load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useListsSubTabRefresh('colaborativas', handleRefresh);

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
      <List disablePadding>
        {lists.map((list) => (
          <ListItemButton key={list.id} onClick={() => {
            trackEvent('collaborative_list_opened', { list_id: list.id });
            // TODO: navigate to list detail view when available
          }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {list.isPublic ? (
                <PublicIcon fontSize="small" color="info" />
              ) : (
                <LockIcon fontSize="small" color="warning" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={list.name}
              secondary={`${list.itemCount} comercio${list.itemCount !== 1 ? 's' : ''}`}
            />
          </ListItemButton>
        ))}
      </List>
    </PullToRefreshWrapper>
  );
}
