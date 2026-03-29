import { useCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import { useMyCheckIns } from '../../hooks/useMyCheckIns';
import { allBusinesses } from '../../hooks/useBusinesses';
import { trackEvent } from '../../utils/analytics';
import { formatRelativeTime } from '../../utils/formatDate';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import { MSG_CHECKIN } from '../../constants/messages';
import type { Business } from '../../types';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function CheckInsView({ onSelectBusiness }: Props) {
  const { checkIns, stats, isLoading, refresh } = useMyCheckIns();

  const handleClick = useCallback((businessId: string) => {
    const business = allBusinesses.find((b) => b.id === businessId);
    if (business) {
      onSelectBusiness(business);
      trackEvent('checkin_navigate', { business_id: businessId });
    }
  }, [onSelectBusiness]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <PullToRefreshWrapper onRefresh={refresh}>
      {stats.totalCheckIns > 0 && (
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {stats.totalCheckIns} visita{stats.totalCheckIns !== 1 ? 's' : ''} a {stats.uniqueBusinesses} comercio{stats.uniqueBusinesses !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}

      {checkIns.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, px: 2 }}>
          <PlaceIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" align="center">
            {MSG_CHECKIN.emptyVisits}
          </Typography>
          <Typography variant="body2" color="text.disabled" align="center" sx={{ mt: 0.5 }}>
            Usá el botón "Hacer check-in" en un comercio para empezar
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {checkIns.map((ci) => (
            <ListItemButton key={ci.id} onClick={() => handleClick(ci.businessId)}>
              <ListItemText
                primary={ci.businessName}
                secondary={formatRelativeTime(ci.createdAt)}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </PullToRefreshWrapper>
  );
}
