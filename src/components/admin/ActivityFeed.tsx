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
  fetchRecentPriceLevels,
  fetchRecentCommentLikes,
} from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import { getBusinessName } from '../../utils/businessHelpers';
import { PRICE_LEVEL_LABELS } from '../../constants/business';
import type { Comment, Rating, Favorite, UserTag, CustomTag, PriceLevel, CommentLike } from '../../types';
import { ADMIN_PAGE_SIZE } from '../../constants/admin';
import AdminPanelWrapper from './AdminPanelWrapper';
import ActivityTable from './ActivityTable';

function FlaggedChip() {
  return <Chip label="Flagged" color="error" size="small" />;
}

const PRICE_SYMBOLS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$' };

interface ActivityData {
  comments: Comment[];
  ratings: Rating[];
  favorites: Favorite[];
  userTags: UserTag[];
  customTags: CustomTag[];
  priceLevels: PriceLevel[];
  commentLikes: CommentLike[];
}

export default function ActivityFeed() {
  const [tab, setTab] = useState(0);

  const fetcher = useCallback(async (): Promise<ActivityData> => {
    const [comments, ratings, favorites, userTags, customTags, priceLevels, commentLikes] = await Promise.all([
      fetchRecentComments(ADMIN_PAGE_SIZE),
      fetchRecentRatings(ADMIN_PAGE_SIZE),
      fetchRecentFavorites(ADMIN_PAGE_SIZE),
      fetchRecentUserTags(ADMIN_PAGE_SIZE),
      fetchRecentCustomTags(ADMIN_PAGE_SIZE),
      fetchRecentPriceLevels(ADMIN_PAGE_SIZE),
      fetchRecentCommentLikes(ADMIN_PAGE_SIZE),
    ]);
    return { comments, ratings, favorites, userTags, customTags, priceLevels, commentLikes };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const comments = data?.comments ?? [];
  const ratings = data?.ratings ?? [];
  const favorites = data?.favorites ?? [];
  const userTags = data?.userTags ?? [];
  const customTags = data?.customTags ?? [];
  const priceLevels = data?.priceLevels ?? [];
  const commentLikes = data?.commentLikes ?? [];

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando actividad.">
      <Box>
        <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
          <Tab label={`Comentarios (${comments.length})`} />
          <Tab label={`Ratings (${ratings.length})`} />
          <Tab label={`Favoritos (${favorites.length})`} />
          <Tab label={`Tags (${userTags.length + customTags.length})`} />
          <Tab label={`Precios (${priceLevels.length})`} />
          <Tab label={`Likes (${commentLikes.length})`} />
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

        {tab === 4 && (
          <ActivityTable
            items={priceLevels}
            columns={[
              { label: 'Usuario', render: (p) => p.userId.slice(0, 8) },
              { label: 'Comercio', render: (p) => getBusinessName(p.businessId) },
              { label: 'Nivel', render: (p) => `${PRICE_SYMBOLS[p.level] ?? p.level} (${PRICE_LEVEL_LABELS[p.level] ?? ''})` },
              { label: 'Fecha', render: (p) => formatDateShort(p.createdAt) },
            ]}
          />
        )}

        {tab === 5 && (
          <ActivityTable
            items={commentLikes}
            columns={[
              { label: 'Usuario', render: (l) => l.userId.slice(0, 8) },
              { label: 'Comment ID', render: (l) => l.commentId.slice(0, 12) },
              { label: 'Fecha', render: (l) => formatDateShort(l.createdAt) },
            ]}
          />
        )}
      </Box>
    </AdminPanelWrapper>
  );
}
