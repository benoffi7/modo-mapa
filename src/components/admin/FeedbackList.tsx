import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { fetchRecentFeedback } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDateShort } from '../../utils/formatDate';
import type { Feedback, FeedbackCategory } from '../../types';
import AdminPanelWrapper from './AdminPanelWrapper';
import ActivityTable from './ActivityTable';

function categoryColor(cat: FeedbackCategory): 'error' | 'primary' | 'info' | 'warning' | 'default' {
  if (cat === 'bug') return 'error';
  if (cat === 'sugerencia') return 'primary';
  if (cat === 'datos_usuario') return 'info';
  if (cat === 'datos_comercio') return 'warning';
  return 'default';
}

export default function FeedbackList() {
  const fetcher = useCallback(() => fetchRecentFeedback(50), []);
  const { data: feedback, loading, error } = useAsyncData<Feedback[]>(fetcher);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando feedback.">
      <Box>
        <ActivityTable
          items={feedback ?? []}
          columns={[
            { label: 'Usuario', render: (f) => f.userId.slice(0, 8) },
            { label: 'Categoría', render: (f) => <Chip label={f.category} size="small" color={categoryColor(f.category)} /> },
            { label: 'Mensaje', render: (f) => f.message },
            { label: 'Fecha', render: (f) => formatDateShort(f.createdAt) },
            { label: 'Estado', render: (f) => f.flagged ? <Chip label="Flagged" color="error" size="small" /> : null },
          ]}
        />
      </Box>
    </AdminPanelWrapper>
  );
}
