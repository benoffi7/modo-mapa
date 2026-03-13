import { useCallback } from 'react';
import Chip from '@mui/material/Chip';
import { fetchAbuseLogs } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS, TRUNCATE_DETAIL_PREVIEW } from '../../constants';
import AdminPanelWrapper from './AdminPanelWrapper';
import ActivityTable from './ActivityTable';

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
                label={ABUSE_TYPE_LABELS[log.type]}
                color={ABUSE_TYPE_COLORS[log.type]}
                size="small"
              />
            ),
          },
          { label: 'Usuario', render: (log) => log.userId.slice(0, 12) },
          { label: 'Colección', render: (log) => log.collection },
          {
            label: 'Detalle',
            render: (log) => log.detail.length > TRUNCATE_DETAIL_PREVIEW ? `${log.detail.slice(0, TRUNCATE_DETAIL_PREVIEW)}...` : log.detail,
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
