import type { ReactNode } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import type { Business } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import DirectionsButton from './DirectionsButton';

interface Props {
  business: Business;
  favoriteButton: ReactNode;
  shareButton?: ReactNode;
  addToListButton?: ReactNode;
  isTrending?: boolean;
}

export default function BusinessHeader({ business, favoriteButton, shareButton, addToListButton, isTrending }: Props) {

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {business.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={CATEGORY_LABELS[business.category]}
              size="small"
              sx={{ fontSize: '0.75rem', height: 24 }}
            />
            {isTrending && (
              <Chip
                label="Tendencia"
                size="small"
                color="secondary"
                icon={<TrendingUpIcon />}
                sx={{ fontSize: '0.75rem', height: 24 }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {addToListButton}
          {shareButton}
          {favoriteButton}
        </Box>
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
