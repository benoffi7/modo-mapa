import { lazy, Suspense } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { usePublicMetrics } from '../../hooks/usePublicMetrics';
import { getBusinessName, getTagLabel } from '../../utils/businessHelpers';
import { TopList } from '../stats';

// recharts (~374KB) se baja solo cuando se renderiza esta vista.
const PieChartCard = lazy(() => import('../stats/PieChartCard'));

function PieChartFallback() {
  return (
    <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress size={24} />
    </Box>
  );
}

export default function StatsView() {
  const { metrics, loading, error } = usePublicMetrics();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          No se pudieron cargar las estadísticas.
        </Typography>
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No hay estadísticas disponibles.
        </Typography>
      </Box>
    );
  }

  const ratingPieData = Object.entries(metrics.ratingDistribution).map(([key, value]) => ({
    name: `${key} estrella${key === '1' ? '' : 's'}`,
    value,
  }));

  const tagsPieData = metrics.topTags.map((t) => ({
    name: getTagLabel(t.tagId),
    value: t.count,
  }));

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Suspense fallback={<PieChartFallback />}>
        <PieChartCard title="Distribución de Ratings" data={ratingPieData} />
        <PieChartCard title="Tags más usados" data={tagsPieData} />
      </Suspense>
      <TopList
        title="Más favoriteados"
        items={metrics.topFavorited.map((t) => ({
          label: getBusinessName(t.businessId),
          value: t.count,
        }))}
      />
      <TopList
        title="Más comentados"
        items={metrics.topCommented.map((t) => ({
          label: getBusinessName(t.businessId),
          value: t.count,
        }))}
      />
      <TopList
        title="Mejor calificados"
        items={metrics.topRated.map((t) => ({
          label: getBusinessName(t.businessId),
          value: t.avgScore,
          secondary: `${t.count} votos`,
        }))}
      />
    </Box>
  );
}
