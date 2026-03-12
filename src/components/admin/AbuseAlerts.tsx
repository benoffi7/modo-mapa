import { useCallback } from 'react';
import Chip from '@mui/material/Chip';
import { fetchAbuseLogs } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import type { AbuseLog } from '../../types/admin';
import AdminPanelWrapper from './AdminPanelWrapper';
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
  const fetcher = useCallback(() => fetchAbuseLogs(50), []);
  const { data: logs, loading, error } = useAsyncData(fetcher);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando alertas.">
      <ActivityTable
        items={logs ?? []}
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
            render: (log) => formatDateShort(log.timestamp),
          },
        ]}
        emptyMessage="Sin alertas de abuso."
      />
    </AdminPanelWrapper>
  );
}
