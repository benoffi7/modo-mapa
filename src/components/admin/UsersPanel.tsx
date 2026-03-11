import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { collection, getDocs } from 'firebase/firestore';
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
import { userProfileConverter } from '../../config/converters';
import { TopList } from '../stats';
import StatCard from './StatCard';

interface UserStats {
  comments: number;
  ratings: number;
  favorites: number;
  tags: number;
  feedback: number;
  total: number;
}

export default function UsersPanel() {
  const [userMap, setUserMap] = useState<Map<string, { name: string; stats: UserStats }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;

    Promise.all([
      getDocs(collection(db, COLLECTIONS.USERS).withConverter(userProfileConverter)),
      getDocs(collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter)),
      getDocs(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter)),
      getDocs(collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter)),
      getDocs(collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter)),
      getDocs(collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter)),
      getDocs(collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter)),
    ])
      .then(([usersSnap, commentsSnap, ratingsSnap, favoritesSnap, userTagsSnap, customTagsSnap, feedbackSnap]) => {
        if (ignore) return;

        const map = new Map<string, { name: string; stats: UserStats }>();

        const emptyStats = (): UserStats => ({ comments: 0, ratings: 0, favorites: 0, tags: 0, feedback: 0, total: 0 });

        const getOrCreate = (userId: string): { name: string; stats: UserStats } => {
          let entry = map.get(userId);
          if (!entry) {
            entry = { name: userId.slice(0, 8), stats: emptyStats() };
            map.set(userId, entry);
          }
          return entry;
        };

        for (const d of usersSnap.docs) {
          const user = d.data();
          const entry = getOrCreate(d.id);
          entry.name = user.displayName || d.id.slice(0, 8);
        }

        for (const d of commentsSnap.docs) {
          const c = d.data();
          const entry = getOrCreate(c.userId);
          entry.stats.comments++;
          entry.stats.total++;
        }

        for (const d of ratingsSnap.docs) {
          const r = d.data();
          const entry = getOrCreate(r.userId);
          entry.stats.ratings++;
          entry.stats.total++;
        }

        for (const d of favoritesSnap.docs) {
          const f = d.data();
          const entry = getOrCreate(f.userId);
          entry.stats.favorites++;
          entry.stats.total++;
        }

        for (const d of userTagsSnap.docs) {
          const t = d.data();
          const entry = getOrCreate(t.userId);
          entry.stats.tags++;
          entry.stats.total++;
        }

        for (const d of customTagsSnap.docs) {
          const t = d.data();
          const entry = getOrCreate(t.userId);
          entry.stats.tags++;
          entry.stats.total++;
        }

        for (const d of feedbackSnap.docs) {
          const f = d.data();
          const entry = getOrCreate(f.userId);
          entry.stats.feedback++;
          entry.stats.total++;
        }

        setUserMap(map);
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
    return <Alert severity="error">Error cargando datos de usuarios.</Alert>;
  }

  const users = [...userMap.entries()].map(([id, { name, stats }]) => ({ id, name, ...stats }));

  const topBy = (key: keyof UserStats, limit = 10) =>
    [...users]
      .sort((a, b) => b[key] - a[key])
      .filter((u) => u[key] > 0)
      .slice(0, limit)
      .map((u) => ({ label: u.name, value: u[key] }));

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.total > 0).length;
  const avgActions = totalUsers > 0
    ? Math.round(users.reduce((s, u) => s + u.total, 0) / totalUsers)
    : 0;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <StatCard label="Total usuarios" value={totalUsers} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <StatCard label="Usuarios activos" value={activeUsers} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <StatCard label="Promedio acciones/usuario" value={avgActions} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopList title="Más comentarios" items={topBy('comments')} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopList title="Más ratings" items={topBy('ratings')} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopList title="Más favoritos" items={topBy('favorites')} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopList title="Más tags" items={topBy('tags')} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopList title="Más feedback" items={topBy('feedback')} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopList title="Más activos (total)" items={topBy('total')} />
        </Grid>
      </Grid>
    </Box>
  );
}
