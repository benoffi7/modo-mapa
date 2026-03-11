import { useEffect, useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import {
  commentConverter,
  ratingConverter,
  favoriteConverter,
  userTagConverter,
  customTagConverter,
  feedbackConverter,
} from '../../config/converters';
import { allBusinesses } from '../../hooks/useBusinesses';
import type { Comment, Rating, Favorite, UserTag, CustomTag, Feedback } from '../../types';
import ActivityTable from './ActivityTable';

const PAGE_SIZE = 20;

function getBusinessName(id: string): string {
  return allBusinesses.find((b) => b.id === id)?.name ?? id;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function FlaggedChip() {
  return <Chip label="Flagged" color="error" size="small" />;
}

export default function ActivityFeed() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  useEffect(() => {
    let ignore = false;

    const queries = [
      getDocs(query(collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))),
      getDocs(query(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))),
      getDocs(query(collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))),
      getDocs(query(collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))),
      getDocs(query(collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))),
      getDocs(query(collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))),
    ] as const;

    Promise.all(queries)
      .then(([commentsSnap, ratingsSnap, favoritesSnap, userTagsSnap, customTagsSnap, feedbackSnap]) => {
        if (ignore) return;
        setComments(commentsSnap.docs.map((d) => d.data()));
        setRatings(ratingsSnap.docs.map((d) => d.data()));
        setFavorites(favoritesSnap.docs.map((d) => d.data()));
        setUserTags(userTagsSnap.docs.map((d) => d.data()));
        setCustomTags(customTagsSnap.docs.map((d) => d.data()));
        setFeedback(feedbackSnap.docs.map((d) => d.data()));
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError(true);
        setLoading(false);
      });

    return () => { ignore = true; };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Error cargando actividad.</Alert>;
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab label={`Comentarios (${comments.length})`} />
        <Tab label={`Ratings (${ratings.length})`} />
        <Tab label={`Favoritos (${favorites.length})`} />
        <Tab label={`Tags (${userTags.length + customTags.length})`} />
        <Tab label={`Feedback (${feedback.length})`} />
      </Tabs>

      {tab === 0 && (
        <ActivityTable
          items={comments}
          columns={[
            { label: 'Usuario', render: (c) => c.userName },
            { label: 'Comercio', render: (c) => getBusinessName(c.businessId) },
            { label: 'Texto', render: (c) => c.text.length > 50 ? `${c.text.slice(0, 50)}...` : c.text },
            { label: 'Fecha', render: (c) => formatDate(c.createdAt) },
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
            { label: 'Score', render: (r) => '★'.repeat(r.score) },
            { label: 'Fecha', render: (r) => formatDate(r.createdAt) },
          ]}
        />
      )}

      {tab === 2 && (
        <ActivityTable
          items={favorites}
          columns={[
            { label: 'Usuario', render: (f) => f.userId.slice(0, 8) },
            { label: 'Comercio', render: (f) => getBusinessName(f.businessId) },
            { label: 'Fecha', render: (f) => formatDate(f.createdAt) },
          ]}
        />
      )}

      {tab === 3 && (
        <ActivityTable
          items={feedback}
          columns={[
            { label: 'Usuario', render: (f) => f.userId.slice(0, 8) },
            { label: 'Categoría', render: (f) => <Chip label={f.category} size="small" color={f.category === 'bug' ? 'error' : f.category === 'sugerencia' ? 'primary' : 'default'} /> },
            { label: 'Mensaje', render: (f) => f.message.length > 60 ? `${f.message.slice(0, 60)}...` : f.message },
            { label: 'Fecha', render: (f) => formatDate(f.createdAt) },
            { label: 'Estado', render: (f) => f.flagged ? <FlaggedChip /> : null },
          ]}
        />
      )}

      {tab === 4 && (
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
            { label: 'Fecha', render: (t) => formatDate(t.createdAt) },
          ]}
        />
      )}
    </Box>
  );
}
