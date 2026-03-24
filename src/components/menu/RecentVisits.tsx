import { Box, List, ListItemButton, ListItemText, Typography, Button } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { formatRelativeTime } from '../../utils/formatDate';
import { CATEGORY_LABELS } from '../../types';
import type { Business } from '../../types';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function RecentVisits({ onSelectBusiness }: Props) {
  const { visits, clearHistory } = useVisitHistory();

  const validVisits = visits.filter((v) => v.business !== null);

  if (validVisits.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          No visitaste comercios todavía
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <List disablePadding>
        {validVisits.map((visit) => (
          <ListItemButton
            key={visit.businessId}
            onClick={() => {
              if (visit.business) {
                onSelectBusiness(visit.business);
              }
            }}
          >
            <ListItemText
              primary={visit.business!.name}
              secondary={
                <>
                  {CATEGORY_LABELS[visit.business!.category]}
                  {' · '}
                  {formatRelativeTime(new Date(visit.lastVisited))}
                  {visit.visitCount > 1 && ` · ${visit.visitCount} visitas`}
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
          onClick={clearHistory}
          color="inherit"
        >
          Limpiar historial
        </Button>
      </Box>
    </Box>
  );
}
