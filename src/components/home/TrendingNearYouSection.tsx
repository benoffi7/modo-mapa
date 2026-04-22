import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Button, IconButton } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import CloseIcon from '@mui/icons-material/Close';
import { useLocalTrending } from '../../hooks/useLocalTrending';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { getBusinessMap } from '../../utils/businessMap';
import { trackEvent } from '../../utils/analytics';
import { STORAGE_KEY_DISMISS_LOCALITY_HINT } from '../../constants/storage';
import {
  EVT_TRENDING_NEAR_VIEWED,
  EVT_TRENDING_NEAR_TAPPED,
  EVT_TRENDING_NEAR_CONFIGURE_TAPPED,
} from '../../constants/analyticsEvents';
import TrendingBusinessCard from './TrendingBusinessCard';
import type { Business } from '../../types';

export default function TrendingNearYouSection() {
  const { businesses, source, localityName, radiusKm, loading } = useLocalTrending();
  const { navigateToBusiness } = useNavigateToBusiness();
  const [hintDismissed, setHintDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY_DISMISS_LOCALITY_HINT) === 'true',
  );

  const businessMap = getBusinessMap();

  // Track section view
  useEffect(() => {
    if (!loading && businesses.length > 0) {
      trackEvent(EVT_TRENDING_NEAR_VIEWED, {
        source,
        radius_km: radiusKm,
        count: businesses.length,
      });
    }
  }, [loading, businesses.length, source, radiusKm]);

  const handleSelectBusiness = (business: Business) => {
    const biz = businesses.find((b) => b.businessId === business.id);
    trackEvent(EVT_TRENDING_NEAR_TAPPED, {
      business_id: business.id,
      rank: biz?.rank ?? 0,
      source,
    });
    navigateToBusiness(business);
  };

  const handleConfigureTap = () => {
    trackEvent(EVT_TRENDING_NEAR_CONFIGURE_TAPPED, { source: 'office' });
    // Navigate to settings — user will find locality config there
  };

  const handleDismissHint = () => {
    setHintDismissed(true);
    localStorage.setItem(STORAGE_KEY_DISMISS_LOCALITY_HINT, 'true');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (businesses.length === 0) return null;

  const subtitle =
    source === 'gps'
      ? 'Cerca tuyo'
      : source === 'locality'
        ? `En ${localityName}`
        : 'En tu zona';

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <PlaceIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="subtitle2" color="text.secondary">
          Trending cerca tuyo
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {subtitle}
      </Typography>

      {source === 'office' && !hintDismissed && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Button
            variant="text"
            size="small"
            onClick={handleConfigureTap}
            sx={{ minWidth: 44, minHeight: 44, textAlign: 'left', textTransform: 'none', fontSize: '0.75rem', px: 1 }}
          >
            Configurá tu localidad para resultados más precisos
          </Button>
          <IconButton
            size="small"
            onClick={handleDismissHint}
            aria-label="Cerrar sugerencia de localidad"
            sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, overflow: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        {businesses.map((biz) => (
          <Box key={biz.businessId} sx={{ minWidth: 260, maxWidth: 300, flexShrink: 0 }}>
            <TrendingBusinessCard
              business={biz}
              fullBusiness={businessMap.get(biz.businessId)}
              rank={biz.rank}
              onSelectBusiness={handleSelectBusiness}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
