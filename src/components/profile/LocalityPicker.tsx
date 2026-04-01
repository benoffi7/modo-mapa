import { useState, useRef, useEffect, useCallback } from 'react';
import { TextField, Box, Button, List, ListItemButton, ListItemText, Typography, IconButton, InputAdornment } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { logger } from '../../utils/logger';

interface Props {
  currentLocality?: string | undefined;
  onSelect: (name: string, lat: number, lng: number) => void;
  onClear: () => void;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export default function LocalityPicker({ currentLocality, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;

    const check = () => {
      if (cancelled) return;
      if (window.google?.maps?.places?.AutocompleteSuggestion) {
        geocoderRef.current = new google.maps.Geocoder();
        setReady(true);
      } else {
        attempts += 1;
        if (attempts >= MAX_ATTEMPTS) {
          setApiError(true);
          return;
        }
        setTimeout(check, 500);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = useCallback(async (input: string) => {
    setQuery(input);
    if (!ready || input.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const request = {
        input,
        includedRegionCodes: ['ar'],
        includedPrimaryTypes: ['locality', 'sublocality', 'administrative_area_level_2'],
      };
      const { suggestions: results } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      setSuggestions(
        results
          .filter((s): s is typeof s & { placePrediction: NonNullable<typeof s.placePrediction> } => s.placePrediction != null)
          .map((s) => ({
            placeId: s.placePrediction.placeId,
            mainText: s.placePrediction.mainText?.text ?? '',
            secondaryText: s.placePrediction.secondaryText?.text ?? '',
          })),
      );
    } catch {
      setSuggestions([]);
    }
  }, [ready]);

  const handleSelect = useCallback(async (suggestion: Suggestion) => {
    if (!geocoderRef.current) return;
    try {
      const { results } = await geocoderRef.current.geocode({ placeId: suggestion.placeId });
      if (!results?.[0]) return;
      const loc = results[0].geometry.location;
      onSelect(suggestion.mainText, loc.lat(), loc.lng());
      setQuery('');
      setSuggestions([]);
      setIsEditing(false);
    } catch (e) {
      logger.warn('[LocalityPicker] geocode failed', e);
    }
  }, [onSelect]);

  const handleClear = () => {
    onClear();
    setQuery('');
    setSuggestions([]);
    setIsEditing(false);
  };

  if (currentLocality && !isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <LocationOnIcon fontSize="small" color="primary" />
        <Typography variant="body2" sx={{ flex: 1 }}>
          {currentLocality}
        </Typography>
        <IconButton size="small" onClick={handleClear} aria-label="Quitar localidad">
          <ClearIcon fontSize="small" />
        </IconButton>
        <Button
          variant="text"
          size="small"
          onClick={() => setIsEditing(true)}
          sx={{ minWidth: 0, p: 0, fontSize: '0.75rem', textTransform: 'none' }}
        >
          Cambiar
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        size="small"
        fullWidth
        placeholder={apiError ? 'Servicio no disponible' : ready ? 'Buscar ciudad o barrio...' : 'Cargando...'}
        value={query}
        onChange={(e) => { void handleSearch(e.target.value); }}
        disabled={!ready || apiError}
        autoFocus={isEditing}
        error={apiError}
        helperText={apiError ? 'No se pudo cargar el buscador de localidades' : undefined}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <LocationOnIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {suggestions.length > 0 && (
        <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto', mt: 0.5 }}>
          {suggestions.map((s) => (
            <ListItemButton key={s.placeId} onClick={() => { void handleSelect(s); }} sx={{ py: 0.5 }}>
              <ListItemText
                primary={s.mainText}
                secondary={s.secondaryText}
                primaryTypographyProps={{ fontSize: '0.85rem' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
