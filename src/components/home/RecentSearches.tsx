import { Box, Chip, Typography, Button } from '@mui/material';
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
          Búsquedas recientes
        </Typography>
        <Button
          variant="text"
          size="small"
          onClick={clearHistory}
          sx={{ minWidth: 0, p: 0, color: 'text.disabled', fontSize: '0.75rem', textTransform: 'none', '&:hover': { color: 'text.secondary', bgcolor: 'transparent' } }}
        >
          Borrar
        </Button>
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
