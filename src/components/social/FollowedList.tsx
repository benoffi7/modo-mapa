import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useSocialSubTabRefresh } from '../../hooks/useTabRefresh';
import {
  Avatar, Typography, Box, CircularProgress,
} from '@mui/material';
import { cardSx } from '../../theme/cards';
import PeopleIcon from '@mui/icons-material/People';
import { useAuth } from '../../context/AuthContext';
import { fetchFollowing } from '../../services/follows';
import { fetchUserDisplayNames } from '../../services/users';
import { PaginatedListShell } from '../common/PaginatedListShell';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { MSG_SOCIAL } from '../../constants/messages';
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

  useSocialSubTabRefresh('seguidos', handleRefresh);

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
          emptyMessage={MSG_SOCIAL.emptyFollowed}
          emptySubtext="Busca usuarios arriba para empezar"
          onRetry={handleRefresh}
          onLoadMore={() => loadPage(lastDoc)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {items.map((item) => (
              <Box
                key={item.userId}
                onClick={() => onUserClick(item.userId)}
                sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.5 }}
              >
                <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.dark', fontSize: 16 }}>
                  {item.displayName.substring(0, 2).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{item.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary">Siguiendo</Typography>
                </Box>
                <Box
                  component="span"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 4,
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    color: 'text.primary',
                  }}
                >
                  Siguiendo
                </Box>
              </Box>
            ))}
          </Box>
        </PaginatedListShell>
      </PullToRefreshWrapper>
    </Box>
  );
}
