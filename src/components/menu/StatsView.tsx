import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { usePublicMetrics } from '../../hooks/usePublicMetrics';
import { getBusinessName, getTagLabel } from '../../utils/businessHelpers';
import { PieChartCard, TopList } from '../stats';

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
          Error cargando estadísticas.
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
      <PieChartCard title="Distribución de Ratings" data={ratingPieData} />
      <PieChartCard title="Tags más usados" data={tagsPieData} />
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
