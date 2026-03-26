import { Box, Chip, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { trackEvent } from '../../utils/analytics';

export default function RecentSearches() {
  const { visits, clearHistory } = useVisitHistory();
  const { navigateToSearchWithFilter } = useTabNavigation();

  const recent = visits.filter((v) => v.business !== null).slice(0, 4);

  if (recent.length === 0) return null;

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Busquedas Recientes
        </Typography>
        <Typography
          variant="caption"
          color="text.disabled"
          onClick={clearHistory}
          sx={{ cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
        >
          Borrar
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {recent.map((v) => (
          <Chip
            key={v.businessId}
            icon={<HistoryIcon />}
            label={v.business!.name}
            size="small"
            variant="outlined"
            onClick={() => {
              trackEvent('recent_search_tapped', { business_id: v.businessId });
              navigateToSearchWithFilter({ type: 'text', value: v.business!.name });
            }}
            sx={{ maxWidth: '100%' }}
          />
        ))}
      </Box>
    </Box>
  );
}
