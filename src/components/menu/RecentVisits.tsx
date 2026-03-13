import { Box, List, ListItemButton, ListItemText, Typography, Button } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSelection } from '../../context/MapContext';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { CATEGORY_LABELS } from '../../types';

interface Props {
  onNavigate: () => void;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hace un momento';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return `Hace más de un mes`;
}

export default function RecentVisits({ onNavigate }: Props) {
  const { setSelectedBusiness } = useSelection();
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
                setSelectedBusiness(visit.business);
                onNavigate();
              }
            }}
          >
            <ListItemText
              primary={visit.business!.name}
              secondary={
                <>
                  {CATEGORY_LABELS[visit.business!.category]}
                  {' · '}
                  {formatRelativeTime(visit.lastVisited)}
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
