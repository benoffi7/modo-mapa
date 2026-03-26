import { Box, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useUserSettings } from '../../hooks/useUserSettings';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function GreetingHeader() {
  const { displayName } = useAuth();
  const { settings } = useUserSettings();
  const name = displayName || 'Anonimo';
  const locality = settings.locality || 'Oficina';

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Typography variant="h5" fontWeight={700}>
        {getGreeting()}, {name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {locality}
      </Typography>
    </Box>
  );
}
