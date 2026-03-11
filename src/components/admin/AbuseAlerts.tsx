import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { abuseLogConverter } from '../../config/adminConverters';
import type { AbuseLog } from '../../types/admin';
import ActivityTable from './ActivityTable';

const TYPE_COLORS: Record<AbuseLog['type'], 'warning' | 'error' | 'info'> = {
  rate_limit: 'warning',
  flagged: 'error',
  top_writers: 'info',
};

const TYPE_LABELS: Record<AbuseLog['type'], string> = {
  rate_limit: 'Rate Limit',
  flagged: 'Contenido Flaggeado',
  top_writers: 'Top Writer',
};

export default function AbuseAlerts() {
  const [logs, setLogs] = useState<AbuseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;

    getDocs(
      query(
        collection(db, COLLECTIONS.ABUSE_LOGS).withConverter(abuseLogConverter),
        orderBy('timestamp', 'desc'),
        limit(50),
      ),
    )
      .then((snap) => {
        if (ignore) return;
        setLogs(snap.docs.map((d) => d.data()));
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
    return <Alert severity="error">Error cargando alertas.</Alert>;
  }

  return (
    <ActivityTable
      items={logs}
      columns={[
        {
          label: 'Tipo',
          render: (log) => (
            <Chip
              label={TYPE_LABELS[log.type]}
              color={TYPE_COLORS[log.type]}
              size="small"
            />
          ),
        },
        { label: 'Usuario', render: (log) => log.userId.slice(0, 12) },
        { label: 'Colección', render: (log) => log.collection },
        {
          label: 'Detalle',
          render: (log) => log.detail.length > 80 ? `${log.detail.slice(0, 80)}...` : log.detail,
        },
        {
          label: 'Fecha',
          render: (log) => log.timestamp.toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          }),
        },
      ]}
      emptyMessage="Sin alertas de abuso."
    />
  );
}
