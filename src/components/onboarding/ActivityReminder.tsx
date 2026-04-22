import { Snackbar, Alert, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { trackEvent } from '../../utils/analytics';
import { EVT_ACTIVITY_REMINDER_CLICKED } from '../../constants/analyticsEvents';

interface Props {
  open: boolean;
  onCreateAccount: () => void;
  onDismiss: () => void;
}

export default function ActivityReminder({ open, onCreateAccount, onDismiss }: Props) {
  if (!open) return null;

  const handleClick = () => {
    trackEvent(EVT_ACTIVITY_REMINDER_CLICKED);
    onDismiss();
    onCreateAccount();
  };

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: 7 }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <>
            <Button color="inherit" size="small" onClick={handleClick} sx={{ fontWeight: 600 }}>
              Crear cuenta
            </Button>
            <IconButton size="small" color="inherit" aria-label="Cerrar recordatorio" onClick={onDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      >
        ¿Querés guardar tu progreso? Creá una cuenta
      </Alert>
    </Snackbar>
  );
}
