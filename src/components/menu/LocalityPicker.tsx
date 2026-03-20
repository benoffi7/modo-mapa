import { useState, useRef, useEffect, useCallback } from 'react';
import { TextField, Box, List, ListItemButton, ListItemText, Typography, IconButton, InputAdornment } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface Props {
  currentLocality?: string | undefined;
  onSelect: (name: string, lat: number, lng: number) => void;
  onClear: () => void;
}

export default function LocalityPicker({ currentLocality, onSelect, onClear }: Props) {
  const places = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (!places) return;
    serviceRef.current = new places.AutocompleteService();
    geocoderRef.current = new google.maps.Geocoder();
  }, [places]);

  const handleSearch = useCallback((input: string) => {
    setQuery(input);
    if (!serviceRef.current || input.length < 3) {
      setPredictions([]);
      return;
    }
    serviceRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: 'ar' }, types: ['(cities)'] },
      (results) => setPredictions(results ?? []),
    );
  }, []);

  const handleSelect = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ placeId: prediction.place_id }, (results) => {
      if (!results?.[0]) return;
      const loc = results[0].geometry.location;
      onSelect(prediction.structured_formatting.main_text, loc.lat(), loc.lng());
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
        placeholder="Buscar ciudad o barrio..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
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
                primary={p.structured_formatting.main_text}
                secondary={p.structured_formatting.secondary_text}
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
