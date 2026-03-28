import { useState, useMemo, useCallback } from 'react';
import { useListsSubTabRefresh } from '../../hooks/useTabRefresh';
import {
  Box, List, ListItemButton, ListItemText, ListItemIcon,
  Typography, CircularProgress, Button, Dialog, DialogTitle, DialogActions,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import PlaceIcon from '@mui/icons-material/Place';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useMyCheckIns } from '../../hooks/useMyCheckIns';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { formatRelativeTime } from '../../utils/formatDate';
import { CATEGORY_LABELS } from '../../types';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import type { Business, BusinessCategory } from '../../types';

interface UnifiedEntry {
  id: string;
  business: Business;
  timestamp: Date;
  type: 'visit' | 'checkin';
}

export default function RecentsUnifiedTab() {
  const { visits, clearHistory } = useVisitHistory();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const { checkIns, isLoading, refresh } = useMyCheckIns();
  const { navigateToBusiness } = useNavigateToBusiness();

  const handleRefresh = useCallback(async () => { await refresh(); }, [refresh]);
  useListsSubTabRefresh('recientes', handleRefresh);

  const entries = useMemo(() => {
    const result: UnifiedEntry[] = [];
    const seen = new Set<string>();

    for (const ci of checkIns) {
      if (!seen.has(ci.businessId)) {
        seen.add(ci.businessId);
        // Business object not in checkIn, resolve from allBusinesses via navigateToBusiness
        result.push({
          id: `ci-${ci.id}`,
          business: { id: ci.businessId, name: ci.businessName } as Business,
          timestamp: ci.createdAt instanceof Date ? ci.createdAt : new Date(ci.createdAt),
          type: 'checkin',
        });
      }
    }

    for (const v of visits) {
      if (v.business && !seen.has(v.businessId)) {
        seen.add(v.businessId);
        result.push({
          id: `v-${v.businessId}`,
          business: v.business,
          timestamp: new Date(v.lastVisited),
          type: 'visit',
        });
      }
    }

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return result;
  }, [visits, checkIns]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          No visitaste comercios todavia
        </Typography>
      </Box>
    );
  }

  return (
    <>
    <PullToRefreshWrapper onRefresh={refresh}>
      <List disablePadding>
        {entries.map((entry) => (
          <ListItemButton
            key={entry.id}
            onClick={() => navigateToBusiness(entry.type === 'visit' ? entry.business : entry.business.id)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {entry.type === 'checkin' ? (
                <PlaceIcon color="success" fontSize="small" />
              ) : (
                <HistoryIcon color="warning" fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={entry.business.name}
              secondary={
                <>
                  {entry.business.category && CATEGORY_LABELS[entry.business.category as BusinessCategory]}
                  {' · '}
                  {formatRelativeTime(entry.timestamp)}
                  {entry.type === 'checkin' && ' · Check-in'}
                </>
              }
            />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Button
          size="small"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => setConfirmClearOpen(true)}
          color="inherit"
        >
          Limpiar historial
        </Button>
      </Box>
    </PullToRefreshWrapper>

    <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)}>
      <DialogTitle>&iquest;Limpiar todo el historial?</DialogTitle>
      <DialogActions>
        <Button onClick={() => setConfirmClearOpen(false)}>Cancelar</Button>
        <Button onClick={() => { clearHistory(); setConfirmClearOpen(false); }} color="error" variant="contained">Limpiar</Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
