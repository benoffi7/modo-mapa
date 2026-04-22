import { useMemo } from 'react';
import { List, ListItemButton, ListItemText, Typography, Chip, Box } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { useBusinesses } from '../../hooks/useBusinesses';
import { useSelection } from '../../context/SelectionContext';
import { useSortLocation } from '../../hooks/useSortLocation';
import { distanceKm, formatDistance } from '../../utils/distance';
import { CATEGORY_LABELS } from '../../constants/business';
import { trackEvent } from '../../utils/analytics';
import type { Business, BusinessCategory } from '../../types';

interface BusinessRowProps {
  business: Business;
  distance: string;
  onSelect: (business: Business) => void;
}

function BusinessRow({ business, distance, onSelect }: BusinessRowProps) {
  return (
    <ListItemButton
      onClick={() => {
        trackEvent('search_list_item_clicked', { business_id: business.id });
        onSelect(business);
      }}
      sx={{ py: 1.5, px: 2, gap: 1 }}
    >
      <ListItemText
        primary={business.name}
        secondary={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Chip
              label={CATEGORY_LABELS[business.category as BusinessCategory] ?? business.category}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
            <Typography variant="caption" color="text.secondary">
              {distance}
            </Typography>
          </Box>
        }
        slotProps={{ primary: { sx: { fontWeight: 500, fontSize: '0.95rem' } } }}
      />
      <StarIcon sx={{ color: 'warning.main', fontSize: 18 }} />
    </ListItemButton>
  );
}

export default function SearchListView() {
  const { businesses } = useBusinesses();
  const { setSelectedBusiness } = useSelection();
  const sortLocation = useSortLocation();

  const sorted = useMemo(() =>
    [...businesses].sort((a, b) => {
      const dA = distanceKm(sortLocation.lat, sortLocation.lng, a.lat, a.lng);
      const dB = distanceKm(sortLocation.lat, sortLocation.lng, b.lat, b.lng);
      return dA - dB;
    }),
  [businesses, sortLocation.lat, sortLocation.lng]);

  if (sorted.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Typography color="text.secondary">No se encontraron comercios</Typography>
      </Box>
    );
  }

  return (
    <List disablePadding sx={{ overflow: 'auto', flex: 1 }}>
      {sorted.map((biz) => {
        const dist = distanceKm(sortLocation.lat, sortLocation.lng, biz.lat, biz.lng);
        return (
          <BusinessRow
            key={biz.id}
            business={biz}
            distance={formatDistance(dist)}
            onSelect={setSelectedBusiness}
          />
        );
      })}
    </List>
  );
}
