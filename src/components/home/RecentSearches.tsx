import { Box, Chip, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { trackEvent } from '../../utils/analytics';

export default function RecentSearches() {
  const { visits } = useVisitHistory();
  const { navigateToSearchWithFilter } = useTabNavigation();

  const recent = visits.filter((v) => v.business !== null).slice(0, 4);

  if (recent.length === 0) return null;

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Busquedas recientes
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
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
            sx={{ justifyContent: 'flex-start', maxWidth: '100%' }}
          />
        ))}
      </Box>
    </Box>
  );
}
