import { Box, Typography, Chip } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import type { Business } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import FavoriteButton from './FavoriteButton';
import DirectionsButton from './DirectionsButton';

interface Props {
  business: Business;
}

export default function BusinessHeader({ business }: Props) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {business.name}
          </Typography>
          <Chip
            label={CATEGORY_LABELS[business.category]}
            size="small"
            sx={{ mt: 0.5, fontSize: '0.75rem', height: 24 }}
          />
        </Box>
        <FavoriteButton businessId={business.id} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, color: 'text.secondary' }}>
        <LocationOnIcon sx={{ fontSize: 18 }} />
        <Typography variant="body2">{business.address}</Typography>
      </Box>

      {business.phone && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: 'text.secondary' }}>
          <PhoneIcon sx={{ fontSize: 18 }} />
          <Typography
            variant="body2"
            component="a"
            href={`tel:${business.phone}`}
            sx={{ color: 'primary.main', textDecoration: 'none' }}
          >
            {business.phone}
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 1.5 }}>
        <DirectionsButton business={business} />
      </Box>
    </Box>
  );
}
