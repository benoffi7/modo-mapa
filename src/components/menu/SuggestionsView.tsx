import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Typography,
  CircularProgress,
} from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useMapContext } from '../../context/MapContext';
import { useSuggestions } from '../../hooks/useSuggestions';
import { CATEGORY_LABELS } from '../../types';
import type { Business, SuggestionReason } from '../../types';

const REASON_LABELS: Record<SuggestionReason, string> = {
  category: 'Te gusta esta categoría',
  tags: 'Tags similares',
  nearby: 'Cerca tuyo',
};

const REASON_COLORS: Record<SuggestionReason, 'primary' | 'secondary' | 'success'> = {
  category: 'primary',
  tags: 'secondary',
  nearby: 'success',
};

interface Props {
  onNavigate: () => void;
}

export default function SuggestionsView({ onNavigate }: Props) {
  const { setSelectedBusiness } = useMapContext();
  const { suggestions, isLoading, error } = useSuggestions();

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusiness(business);
    onNavigate();
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Cargando...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No se pudieron cargar las sugerencias
        </Typography>
      </Box>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LightbulbOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Calificá y guardá favoritos para recibir sugerencias
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <List disablePadding>
        {suggestions.map((item) => (
          <ListItemButton
            key={item.business.id}
            onClick={() => handleSelectBusiness(item.business)}
          >
            <ListItemText
              primary={item.business.name}
              secondary={
                <>
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {CATEGORY_LABELS[item.business.category]}
                    {' · '}
                    {item.business.address}
                  </Typography>
                  <Box component="span" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {item.reasons.map((reason) => (
                      <Chip
                        key={reason}
                        label={REASON_LABELS[reason]}
                        size="small"
                        color={REASON_COLORS[reason]}
                        variant="outlined"
                        component="span"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    ))}
                  </Box>
                </>
              }
              primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
