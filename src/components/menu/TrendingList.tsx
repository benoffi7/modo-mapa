import { useEffect, useMemo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useTrending } from '../../hooks/useTrending';
import { trackEvent } from '../../utils/analytics';
import { EVT_TRENDING_VIEWED } from '../../constants/analyticsEvents';
import { allBusinesses } from '../../hooks/useBusinesses';
import TrendingBusinessCard from './TrendingBusinessCard';

interface Props {
  onNavigate: () => void;
}

export default function TrendingList({ onNavigate }: Props) {
  const { data, loading, error } = useTrending();
  const businessMap = useMemo(() => new Map(allBusinesses.map((b) => [b.id, b])), []);

  useEffect(() => {
    trackEvent(EVT_TRENDING_VIEWED);
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress size={32} />
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="body2" color="error">
        Error cargando tendencias.
      </Typography>
    </Box>
  );

  if (!data || data.businesses.length === 0) return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <TrendingUpIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
      <Typography variant="body2" color="text.secondary">
        No hay comercios en tendencia esta semana.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', pb: 1.5 }}>
      {data.businesses.map((biz) => (
        <TrendingBusinessCard key={biz.businessId} business={biz} fullBusiness={businessMap.get(biz.businessId)} rank={biz.rank} onNavigate={onNavigate} />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
        Actualizado: {data.computedAt.toLocaleDateString('es-AR')}
      </Typography>
    </Box>
  );
}
