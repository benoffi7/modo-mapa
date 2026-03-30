import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, TextField,
  Select, MenuItem, FormControl, InputLabel, IconButton,
  Switch, FormControlLabel, CircularProgress, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { Special } from '../../types';
import { fetchSpecials, saveAllSpecials } from '../../services/specials';

const EMPTY_SPECIAL: Omit<Special, 'id' | 'order'> = {
  title: '',
  subtitle: '',
  icon: 'LocalFireDepartment',
  type: 'trending',
  referenceId: '',
  active: true,
};

const ICON_OPTIONS = [
  'LocalFireDepartment', 'Star', 'TrendingUp', 'Explore',
  'Restaurant', 'Favorite', 'EmojiEvents', 'NewReleases',
];

export default function SpecialsPanel() {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSpecials();
      setSpecials(data);
    } catch {
      setError('No se pudieron cargar los especiales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSpecial = () => {
    const newSpecial: Special = {
      ...EMPTY_SPECIAL,
      id: `special_${Date.now()}`,
      order: specials.length,
    };
    setSpecials((prev) => [...prev, newSpecial]);
  };

  const updateField = (id: string, field: keyof Special, value: string | boolean | number) => {
    setSpecials((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSpecial = (id: string) => {
    setSpecials((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setSpecials((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const moveDown = (index: number) => {
    if (index >= specials.length - 1) return;
    setSpecials((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveAllSpecials(specials);
      await load();
    } catch {
      setError('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Especiales (Inicio)</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<AddIcon />} onClick={addSpecial} variant="outlined" size="small">
            Agregar
          </Button>
          <Button onClick={saveAll} variant="contained" size="small" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar todo'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Los especiales aparecen en la pestaña Inicio de la app. Máximo recomendado: 3 items visibles.
      </Typography>

      {specials.map((special, index) => (
        <Card key={special.id} variant="outlined" sx={{ mb: 1.5 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: '16px !important' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">#{index + 1}</Typography>
              <TextField label="Título" value={special.title} onChange={(e) => updateField(special.id, 'title', e.target.value)} size="small" fullWidth />
              <TextField label="Subtítulo" value={special.subtitle} onChange={(e) => updateField(special.id, 'subtitle', e.target.value)} size="small" fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Icono</InputLabel>
                <Select value={special.icon} label="Icono" onChange={(e) => updateField(special.id, 'icon', e.target.value)}>
                  {ICON_OPTIONS.map((icon) => <MenuItem key={icon} value={icon}>{icon}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={special.type} label="Tipo" onChange={(e) => updateField(special.id, 'type', e.target.value)}>
                  <MenuItem value="featured_list">Lista destacada</MenuItem>
                  <MenuItem value="trending">Trending</MenuItem>
                  <MenuItem value="custom_link">Link custom</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Ref ID" value={special.referenceId} onChange={(e) => updateField(special.id, 'referenceId', e.target.value)} size="small" sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                control={<Switch checked={special.active} onChange={(e) => updateField(special.id, 'active', e.target.checked)} size="small" />}
                label="Activo"
              />
              <Box>
                <IconButton size="small" onClick={() => moveUp(index)} disabled={index === 0}><ArrowUpwardIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => moveDown(index)} disabled={index === specials.length - 1}><ArrowDownwardIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => removeSpecial(special.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}

      {specials.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No hay especiales configurados. Tocá "Agregar" para crear uno.
        </Typography>
      )}
    </Box>
  );
}
