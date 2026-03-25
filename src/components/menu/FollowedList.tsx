import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  List, ListItemButton, ListItemText, ListItemAvatar,
  Avatar, Typography, Box, CircularProgress,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import { useAuth } from '../../context/AuthContext';
import { fetchFollowing } from '../../services/follows';
import { fetchUserDisplayNames } from '../../services/users';
import { PaginatedListShell } from './PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import type { Follow } from '../../types';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

const UserSearchField = lazy(() =>
  import('../UserSearchField').then((m) => ({ default: m.UserSearchField })),
);

interface FollowedListProps {
  onUserClick: (userId: string) => void;
}

export function FollowedList({ onUserClick }: FollowedListProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<Follow> | null>(null);

  const userId = user?.uid;

  const loadPage = useCallback(async (cursor?: QueryDocumentSnapshot | null) => {
    if (!userId) return;
    const isFirst = !cursor;
    if (isFirst) setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);

    try {
      const result = await fetchFollowing(userId, 20, cursor ?? undefined);
      const followedIds = result.docs.map((d) => d.data().followedId);
      const names = await fetchUserDisplayNames(followedIds);
      const newItems = result.docs.map((d) => {
        const followedId = d.data().followedId;
        return { userId: followedId, displayName: names.get(followedId) ?? followedId };
      });

      setHasMore(result.hasMore);
      setLastDoc(result.docs[result.docs.length - 1] ?? null);
      if (isFirst) setItems(newItems);
      else setItems((prev) => [...prev, ...newItems]);
    } catch {
      setError('Error al cargar seguidos');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const handleRefresh = useCallback(async () => {
    setLastDoc(null);
    await loadPage();
  }, [loadPage]);

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Suspense fallback={<CircularProgress size={20} />}>
        <UserSearchField
          onSelect={(uid) => onUserClick(uid)}
          placeholder="Buscar usuarios..."
          excludeUserId={userId}
        />
      </Suspense>

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        Seguidos
      </Typography>

      <PullToRefreshWrapper onRefresh={handleRefresh}>
        <PaginatedListShell
          isLoading={isLoading}
          error={error}
          isEmpty={items.length === 0}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          emptyIcon={<PeopleIcon sx={{ fontSize: 48 }} />}
          emptyMessage="No seguis a nadie todavia"
          emptySubtext="Busca usuarios arriba para empezar"
          onRetry={handleRefresh}
          onLoadMore={() => loadPage(lastDoc)}
        >
          <List dense disablePadding>
            {items.map((item) => (
              <ListItemButton key={item.userId} onClick={() => onUserClick(item.userId)}>
                <ListItemAvatar>
                  <Avatar sx={{ width: 36, height: 36, fontSize: 16 }}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={item.displayName} />
              </ListItemButton>
            ))}
          </List>
        </PaginatedListShell>
      </PullToRefreshWrapper>
    </Box>
  );
}
