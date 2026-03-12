import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { feedbackConverter } from '../../config/converters';
import type { Feedback, FeedbackCategory } from '../../types';
import ActivityTable from './ActivityTable';

export default function FeedbackList() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;

    getDocs(query(
      collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter),
      orderBy('createdAt', 'desc'),
      limit(50),
    ))
      .then((snap) => {
        if (ignore) return;
        setFeedback(snap.docs.map((d) => d.data()));
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
    return <Alert severity="error">Error cargando feedback.</Alert>;
  }

  function categoryColor(cat: FeedbackCategory): 'error' | 'primary' | 'default' {
    if (cat === 'bug') return 'error';
    if (cat === 'sugerencia') return 'primary';
    return 'default';
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Box>
      <ActivityTable
        items={feedback}
        columns={[
          { label: 'Usuario', render: (f) => f.userId.slice(0, 8) },
          { label: 'Categoría', render: (f) => <Chip label={f.category} size="small" color={categoryColor(f.category)} /> },
          { label: 'Mensaje', render: (f) => f.message },
          { label: 'Fecha', render: (f) => formatDate(f.createdAt) },
          { label: 'Estado', render: (f) => f.flagged ? <Chip label="Flagged" color="error" size="small" /> : null },
        ]}
      />
    </Box>
  );
}
