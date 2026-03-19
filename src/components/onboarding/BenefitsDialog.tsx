import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { trackEvent } from '../../utils/analytics';
import { STORAGE_KEY_BENEFITS_SHOWN } from '../../constants/storage';
import { EVT_BENEFITS_SCREEN_SHOWN, EVT_BENEFITS_SCREEN_CONTINUE } from '../../constants/analyticsEvents';

const BENEFITS = [
  { icon: SyncIcon, text: 'Sincronizá tus datos entre dispositivos' },
  { icon: EmojiEventsIcon, text: 'Participá en rankings y listas colaborativas' },
  { icon: PersonIcon, text: 'Tu perfil público con tus reseñas' },
  { icon: FavoriteIcon, text: 'Tus favoritos siempre disponibles' },
] as const;

interface Props {
  open: boolean;
  onContinue: () => void;
  onClose: () => void;
  source: 'banner' | 'menu' | 'settings';
}

/**
 * Shown to anonymous users before the account creation flow.
 * STORAGE_KEY_BENEFITS_SHOWN is a permanent flag: once set (on Continue or close),
 * the benefits screen is skipped on all future invocations — the user goes
 * directly to EmailPasswordDialog.
 */
export default function BenefitsDialog({ open, onContinue, onClose, source }: Props) {
  useEffect(() => {
    if (open) trackEvent(EVT_BENEFITS_SCREEN_SHOWN, { source });
  }, [open, source]);

  const handleContinue = () => {
    localStorage.setItem(STORAGE_KEY_BENEFITS_SHOWN, 'true');
    trackEvent(EVT_BENEFITS_SCREEN_CONTINUE);
    onContinue();
  };

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY_BENEFITS_SHOWN, 'true');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        ¿Por qué crear una cuenta?
      </DialogTitle>
      <DialogContent>
        <List disablePadding>
          {BENEFITS.map(({ icon: Icon, text }) => (
            <ListItem key={text} disablePadding sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon color="primary" />
              </ListItemIcon>
              <ListItemText primary={text} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Ahora no</Button>
        <Button variant="contained" onClick={handleContinue}>
          Continuar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
