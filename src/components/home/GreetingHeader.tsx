import { Box, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useUserSettings } from '../../hooks/useUserSettings';
import { ANONYMOUS_DISPLAY_NAME } from '../../constants/ui';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function GreetingHeader() {
  const { displayName, authMethod } = useAuth();
  const { settings } = useUserSettings();
  const locality = settings.locality || 'Oficina';
  const isAnonymous = authMethod === 'anonymous';
  const hasName = displayName && displayName !== ANONYMOUS_DISPLAY_NAME;

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Typography variant="h5" fontWeight={700}>
        {hasName ? `${getGreeting()}, ${displayName}` : getGreeting()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {locality}
      </Typography>
      {isAnonymous && !hasName && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
          Podés elegir tu nombre en la pestaña Perfil
        </Typography>
      )}
    </Box>
  );
}
