import { useState, useRef, useEffect, useCallback } from 'react';
import { TextField, Box, List, ListItemButton, ListItemText, Typography, IconButton, InputAdornment } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import LocationOnIcon from '@mui/icons-material/LocationOn';

interface Props {
  currentLocality?: string | undefined;
  onSelect: (name: string, lat: number, lng: number) => void;
  onClear: () => void;
}

interface Prediction {
  place_id: string;
  main_text: string;
  secondary_text: string;
}

export default function LocalityPicker({ currentLocality, onSelect, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    const check = () => {
      if (window.google?.maps?.places) {
        serviceRef.current = new google.maps.places.AutocompleteService();
        geocoderRef.current = new google.maps.Geocoder();
        setReady(true);
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  }, []);

  const handleSearch = useCallback((input: string) => {
    setQuery(input);
    if (!serviceRef.current || input.length < 3) {
      setPredictions([]);
      return;
    }
    serviceRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: 'ar' }, types: ['(cities)'] },
      (results) => {
        setPredictions(
          (results ?? []).map((r) => ({
            place_id: r.place_id,
            main_text: r.structured_formatting.main_text,
            secondary_text: r.structured_formatting.secondary_text,
          })),
        );
      },
    );
  }, []);

  const handleSelect = useCallback((prediction: Prediction) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ placeId: prediction.place_id }, (results) => {
      if (!results?.[0]) return;
      const loc = results[0].geometry.location;
      onSelect(prediction.main_text, loc.lat(), loc.lng());
      setQuery('');
      setPredictions([]);
      setIsEditing(false);
    });
  }, [onSelect]);

  const handleClear = () => {
    onClear();
    setQuery('');
    setPredictions([]);
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
        <Typography
          variant="caption"
          color="primary"
          sx={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => setIsEditing(true)}
        >
          Cambiar
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        size="small"
        fullWidth
        placeholder={ready ? 'Buscar ciudad o barrio...' : 'Cargando...'}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        disabled={!ready}
        autoFocus={isEditing}
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
      {predictions.length > 0 && (
        <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto', mt: 0.5 }}>
          {predictions.map((p) => (
            <ListItemButton key={p.place_id} onClick={() => handleSelect(p)} sx={{ py: 0.5 }}>
              <ListItemText
                primary={p.main_text}
                secondary={p.secondary_text}
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
