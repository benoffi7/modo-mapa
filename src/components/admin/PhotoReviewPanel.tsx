import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import RefreshIcon from '@mui/icons-material/Refresh';
import { fetchAllPhotos } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { MenuPhoto, MenuPhotoStatus } from '../../types';
import AdminPanelWrapper from './AdminPanelWrapper';
import PhotoReviewCard from './PhotoReviewCard';

type StatusFilter = 'all' | MenuPhotoStatus;

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  pending: 'Pendientes',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
};

export default function PhotoReviewPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const fetcher = useCallback(() => fetchAllPhotos(), [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: photos, loading, error } = useAsyncData<MenuPhoto[]>(fetcher);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const filtered = useMemo(() => {
    if (!photos) return [];
    if (filter === 'all') return photos;
    return photos.filter((p) => p.status === filter);
  }, [photos, filter]);

  const counts = useMemo(() => {
    if (!photos) return { all: 0, pending: 0, approved: 0, rejected: 0 };
    return {
      all: photos.length,
      pending: photos.filter((p) => p.status === 'pending').length,
      approved: photos.filter((p) => p.status === 'approved').length,
      rejected: photos.filter((p) => p.status === 'rejected').length,
    };
  }, [photos]);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando fotos.">
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {`Fotos (${filtered.length})`}
        </Typography>
        <Button startIcon={<RefreshIcon />} onClick={handleRefresh} size="small">
          Refrescar
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
          <Chip
            key={status}
            label={`${STATUS_LABELS[status]} (${counts[status]})`}
            color={filter === status ? 'primary' : 'default'}
            variant={filter === status ? 'filled' : 'outlined'}
            onClick={() => setFilter(status)}
          />
        ))}
      </Box>
      {filtered.length === 0 && (
        <Typography color="text.secondary">No hay fotos en esta categoría.</Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {filtered.map((photo) => (
          <PhotoReviewCard key={photo.id} photo={photo} onAction={handleRefresh} />
        ))}
      </Box>
    </AdminPanelWrapper>
  );
}
