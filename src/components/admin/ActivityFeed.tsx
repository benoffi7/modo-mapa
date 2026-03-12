import { useState, useCallback } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import {
  fetchRecentComments,
  fetchRecentRatings,
  fetchRecentFavorites,
  fetchRecentUserTags,
  fetchRecentCustomTags,
} from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import { getBusinessName } from '../../utils/businessHelpers';
import type { Comment, Rating, Favorite, UserTag, CustomTag } from '../../types';
import AdminPanelWrapper from './AdminPanelWrapper';
import ActivityTable from './ActivityTable';

const PAGE_SIZE = 20;

function FlaggedChip() {
  return <Chip label="Flagged" color="error" size="small" />;
}

interface ActivityData {
  comments: Comment[];
  ratings: Rating[];
  favorites: Favorite[];
  userTags: UserTag[];
  customTags: CustomTag[];
}

export default function ActivityFeed() {
  const [tab, setTab] = useState(0);

  const fetcher = useCallback(async (): Promise<ActivityData> => {
    const [comments, ratings, favorites, userTags, customTags] = await Promise.all([
      fetchRecentComments(PAGE_SIZE),
      fetchRecentRatings(PAGE_SIZE),
      fetchRecentFavorites(PAGE_SIZE),
      fetchRecentUserTags(PAGE_SIZE),
      fetchRecentCustomTags(PAGE_SIZE),
    ]);
    return { comments, ratings, favorites, userTags, customTags };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const comments = data?.comments ?? [];
  const ratings = data?.ratings ?? [];
  const favorites = data?.favorites ?? [];
  const userTags = data?.userTags ?? [];
  const customTags = data?.customTags ?? [];

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando actividad.">
      <Box>
        <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
          <Tab label={`Comentarios (${comments.length})`} />
          <Tab label={`Ratings (${ratings.length})`} />
          <Tab label={`Favoritos (${favorites.length})`} />
          <Tab label={`Tags (${userTags.length + customTags.length})`} />
        </Tabs>

        {tab === 0 && (
          <ActivityTable
            items={comments}
            columns={[
              { label: 'Usuario', render: (c) => c.userName },
              { label: 'Comercio', render: (c) => getBusinessName(c.businessId) },
              { label: 'Texto', render: (c) => c.text.length > 50 ? `${c.text.slice(0, 50)}...` : c.text },
              { label: 'Fecha', render: (c) => formatDateShort(c.createdAt) },
              { label: 'Estado', render: (c) => c.flagged ? <FlaggedChip /> : null },
            ]}
          />
        )}

        {tab === 1 && (
          <ActivityTable
            items={ratings}
            columns={[
              { label: 'Usuario', render: (r) => r.userId.slice(0, 8) },
              { label: 'Comercio', render: (r) => getBusinessName(r.businessId) },
              { label: 'Score', render: (r) => '\u2605'.repeat(r.score) },
              { label: 'Fecha', render: (r) => formatDateShort(r.createdAt) },
            ]}
          />
        )}

        {tab === 2 && (
          <ActivityTable
            items={favorites}
            columns={[
              { label: 'Usuario', render: (f) => f.userId.slice(0, 8) },
              { label: 'Comercio', render: (f) => getBusinessName(f.businessId) },
              { label: 'Fecha', render: (f) => formatDateShort(f.createdAt) },
            ]}
          />
        )}

        {tab === 3 && (
          <ActivityTable
            items={[
              ...userTags.map((t) => ({ ...t, type: 'predefinido' as const, label: t.tagId })),
              ...customTags.map((t) => ({ ...t, type: 'custom' as const, label: t.label })),
            ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())}
            columns={[
              { label: 'Usuario', render: (t) => t.userId.slice(0, 8) },
              { label: 'Comercio', render: (t) => getBusinessName(t.businessId) },
              { label: 'Tag', render: (t) => t.label },
              { label: 'Tipo', render: (t) => <Chip label={t.type} size="small" color={t.type === 'custom' ? 'secondary' : 'default'} /> },
              { label: 'Fecha', render: (t) => formatDateShort(t.createdAt) },
            ]}
          />
        )}
      </Box>
    </AdminPanelWrapper>
  );
}
