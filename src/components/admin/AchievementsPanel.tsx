import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, TextField,
  Select, MenuItem, FormControl, InputLabel, IconButton,
  Switch, FormControlLabel, CircularProgress, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { collection, getDocs, doc, setDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface AchievementCondition {
  metric: string;
  threshold: number;
}

interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  order: number;
  active: boolean;
}

const METRIC_OPTIONS = [
  { value: 'checkins_unique', label: 'Check-ins unicos' },
  { value: 'follows', label: 'Seguidos' },
  { value: 'recommendations_sent', label: 'Recomendaciones enviadas' },
  { value: 'ratings', label: 'Calificaciones' },
  { value: 'comments', label: 'Comentarios' },
  { value: 'localities', label: 'Localidades' },
  { value: 'favorites', label: 'Favoritos' },
  { value: 'photos', label: 'Fotos de menu' },
  { value: 'streak_days', label: 'Dias consecutivos' },
];

const ICON_OPTIONS = [
  'ExploreOutlined', 'PeopleOutlined', 'RateReviewOutlined', 'FlightOutlined',
  'BookmarkBorder', 'CameraAltOutlined', 'EmojiEventsOutlined', 'LocalFireDepartment',
  'Star', 'Favorite', 'TrendingUp', 'Public',
];

const EMPTY_ACHIEVEMENT: Omit<Achievement, 'id' | 'order'> = {
  label: '',
  description: '',
  icon: 'ExploreOutlined',
  condition: { metric: 'checkins_unique', threshold: 10 },
  active: true,
};

export default function AchievementsPanel() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'achievements'), orderBy('order')));
      setAchievements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Achievement)));
    } catch {
      setError('Error al cargar logros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addAchievement = () => {
    const newAch: Achievement = {
      ...EMPTY_ACHIEVEMENT,
      id: `ach_${Date.now()}`,
      order: achievements.length,
    };
    setAchievements((prev) => [...prev, newAch]);
  };

  const updateField = (id: string, field: string, value: string | boolean | number) => {
    setAchievements((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      if (field === 'metric') return { ...a, condition: { ...a.condition, metric: value as string } };
      if (field === 'threshold') return { ...a, condition: { ...a.condition, threshold: value as number } };
      return { ...a, [field]: value };
    }));
  };

  const removeAchievement = (id: string) => {
    setAchievements((prev) => prev.filter((a) => a.id !== id).map((a, i) => ({ ...a, order: i })));
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const existingSnap = await getDocs(collection(db, 'achievements'));
      const currentIds = new Set(achievements.map((a) => a.id));
      for (const d of existingSnap.docs) {
        if (!currentIds.has(d.id)) await deleteDoc(d.ref);
      }
      for (const a of achievements) {
        const { id, ...data } = a;
        await setDoc(doc(db, 'achievements', id), { ...data, updatedAt: new Date() });
      }
      await load();
    } catch {
      setError('Error al guardar');
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
        <Typography variant="h6">Motor de Logros</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<AddIcon />} onClick={addAchievement} variant="outlined" size="small">
            Agregar
          </Button>
          <Button onClick={saveAll} variant="contained" size="small" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar todo'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Defini logros con condiciones. El progreso se calcula automaticamente via Cloud Functions.
        Los usuarios ven su progreso en la pestana Perfil.
      </Typography>

      {achievements.map((ach, index) => (
        <Card key={ach.id} variant="outlined" sx={{ mb: 1.5 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: '16px !important' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip label={`#${index + 1}`} size="small" />
              <TextField label="Nombre" value={ach.label} onChange={(e) => updateField(ach.id, 'label', e.target.value)} size="small" sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Icono</InputLabel>
                <Select value={ach.icon} label="Icono" onChange={(e) => updateField(ach.id, 'icon', e.target.value)}>
                  {ICON_OPTIONS.map((icon) => <MenuItem key={icon} value={icon}>{icon}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Switch checked={ach.active} onChange={(e) => updateField(ach.id, 'active', e.target.checked)} size="small" />}
                label="Activo"
              />
            </Box>
            <TextField
              label="Descripcion (que ve el usuario)"
              value={ach.description}
              onChange={(e) => updateField(ach.id, 'description', e.target.value)}
              size="small"
              fullWidth
              placeholder="Ej: Hace check-in en 10 lugares diferentes"
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Condicion:</Typography>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Metrica</InputLabel>
                <Select value={ach.condition.metric} label="Metrica" onChange={(e) => updateField(ach.id, 'metric', e.target.value)}>
                  {METRIC_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">&gt;=</Typography>
              <TextField
                label="Meta"
                type="number"
                value={ach.condition.threshold}
                onChange={(e) => updateField(ach.id, 'threshold', parseInt(e.target.value, 10) || 0)}
                size="small"
                sx={{ width: 80 }}
              />
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" color="error" onClick={() => removeAchievement(ach.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      ))}

      {achievements.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No hay logros definidos. Toca "Agregar" para crear uno.
        </Typography>
      )}
    </Box>
  );
}
