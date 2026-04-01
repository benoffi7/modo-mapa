import { useState } from 'react';
import { Box, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import IcecreamIcon from '@mui/icons-material/Icecream';
import LocalPizzaIcon from '@mui/icons-material/LocalPizza';
import CasinoIcon from '@mui/icons-material/Casino';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HistoryIcon from '@mui/icons-material/History';
import PlaceIcon from '@mui/icons-material/Place';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { useTab } from '../../context/TabContext';
import { useSurpriseMe } from '../../hooks/useSurpriseMe';
import { useSelection } from '../../context/SelectionContext';
import { trackEvent } from '../../utils/analytics';
import { CATEGORY_COLORS } from '../../constants/business';
import { iconCircleSx } from '../../theme/cards';
import type { BusinessCategory } from '../../types';

interface QuickActionSlot {
  id: string;
  label: string;
  icon: React.ReactElement;
  type: 'category' | 'action' | 'shortcut';
}

const CATEGORY_ICONS: Record<BusinessCategory, React.ReactElement> = {
  restaurant: <RestaurantIcon />,
  cafe: <LocalCafeIcon />,
  bakery: <BakeryDiningIcon />,
  bar: <SportsBarIcon />,
  fastfood: <FastfoodIcon />,
  icecream: <IcecreamIcon />,
  pizza: <LocalPizzaIcon />,
};

const ALL_AVAILABLE_SLOTS: QuickActionSlot[] = [
  { id: 'restaurant', label: 'Restaurante', icon: CATEGORY_ICONS.restaurant, type: 'category' },
  { id: 'cafe', label: 'Café', icon: CATEGORY_ICONS.cafe, type: 'category' },
  { id: 'bar', label: 'Bar', icon: CATEGORY_ICONS.bar, type: 'category' },
  { id: 'pizza', label: 'Pizzería', icon: CATEGORY_ICONS.pizza, type: 'category' },
  { id: 'fastfood', label: 'Rápida', icon: CATEGORY_ICONS.fastfood, type: 'category' },
  { id: 'bakery', label: 'Panadería', icon: CATEGORY_ICONS.bakery, type: 'category' },
  { id: 'icecream', label: 'Heladería', icon: CATEGORY_ICONS.icecream, type: 'category' },
  { id: 'sorprendeme', label: 'Sorpresa', icon: <CasinoIcon />, type: 'action' },
  { id: 'favoritos', label: 'Favoritos', icon: <FavoriteIcon />, type: 'shortcut' },
  { id: 'recientes', label: 'Recientes', icon: <HistoryIcon />, type: 'shortcut' },
  { id: 'visitas', label: 'Visitas', icon: <PlaceIcon />, type: 'shortcut' },
];

const QUICK_ACTION_COLORS: Record<string, string> = {
  sorprendeme: '#00897b',
  favoritos: '#e53935',
  recientes: '#546e7a',
  visitas: '#1e88e5',
};

export function getSlotColor(slot: QuickActionSlot): string {
  if (slot.type === 'category') {
    return CATEGORY_COLORS[slot.id as BusinessCategory] ?? '#546e7a';
  }
  return QUICK_ACTION_COLORS[slot.id] ?? '#546e7a';
}

const DEFAULT_IDS = ['restaurant', 'cafe', 'bar', 'pizza', 'fastfood', 'bakery', 'icecream', 'sorprendeme'];
import { STORAGE_KEY_QUICK_ACTIONS as STORAGE_KEY } from '../../constants/storage';

const VALID_SLOT_IDS = new Set(ALL_AVAILABLE_SLOTS.map((s) => s.id));

function loadConfig(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        Array.isArray(parsed)
        && parsed.length === 8
        && parsed.every((id: unknown) => typeof id === 'string' && VALID_SLOT_IDS.has(id))
      ) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_IDS;
}

function saveConfig(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function QuickActions() {
  const { navigateToSearchWithFilter, navigateToListsSubTab } = useTabNavigation();
  const { setActiveTab } = useTab();
  const { setSelectedBusiness } = useSelection();
  const { handleSurprise } = useSurpriseMe({
    onSelect: (biz) => { setSelectedBusiness(biz); setActiveTab('buscar'); },
    onClose: () => {},
  });
  const [selectedIds, setSelectedIds] = useState(loadConfig);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<string[]>([]);

  const slots = selectedIds
    .map((id) => ALL_AVAILABLE_SLOTS.find((s) => s.id === id))
    .filter((s): s is QuickActionSlot => s !== undefined);

  const handleTap = (slot: QuickActionSlot) => {
    trackEvent('quick_action_tapped', { action_id: slot.id, type: slot.type });
    if (slot.type === 'category') {
      navigateToSearchWithFilter({ type: 'category', value: slot.id });
    } else if (slot.id === 'sorprendeme') {
      handleSurprise();
    } else if (slot.id === 'favoritos') {
      navigateToListsSubTab('favoritos');
    } else if (slot.id === 'recientes' || slot.id === 'visitas') {
      navigateToListsSubTab('recientes');
    }
  };

  const openEdit = () => {
    setEditDraft([...selectedIds]);
    setEditOpen(true);
  };

  const toggleSlot = (id: string) => {
    setEditDraft((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 8) return prev;
      return [...prev, id];
    });
  };

  const saveEdit = () => {
    if (editDraft.length === 8) {
      setSelectedIds(editDraft);
      saveConfig(editDraft);
      trackEvent('quick_actions_edited', { actions: editDraft.join(',') });
    }
    setEditOpen(false);
  };

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Acciones rapidas
        </Typography>
        <IconButton size="small" aria-label="Editar acciones rápidas" onClick={openEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {slots.map((slot) => (
          <Box key={slot.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              aria-label={slot.label}
              onClick={() => handleTap(slot)}
              sx={{ ...iconCircleSx(getSlotColor(slot), 48) }}
            >
              <Box sx={{ color: 'common.white', display: 'flex' }}>{slot.icon}</Box>
            </IconButton>
            <Typography variant="caption" noWrap sx={{ maxWidth: 64, textAlign: 'center' }}>
              {slot.label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Editar acciones ({editDraft.length}/8)
          <IconButton size="small" aria-label="Cerrar diálogo de edición" onClick={() => setEditOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {ALL_AVAILABLE_SLOTS.map((slot) => (
            <FormControlLabel
              key={slot.id}
              control={
                <Checkbox
                  checked={editDraft.includes(slot.id)}
                  onChange={() => toggleSlot(slot.id)}
                  disabled={!editDraft.includes(slot.id) && editDraft.length >= 8}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ ...iconCircleSx(getSlotColor(slot), 32), color: 'common.white' }}>
                    <Box sx={{ display: 'flex', fontSize: 18 }}>{slot.icon}</Box>
                  </Box>
                  <Typography variant="body2">{slot.label}</Typography>
                </Box>
              }
              sx={{ display: 'flex', width: '100%' }}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={saveEdit} variant="contained" disabled={editDraft.length !== 8}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
