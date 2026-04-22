import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate } from 'react-router-dom';

interface Props {
  reason: 'invalid_id' | 'not_found' | 'offline_no_cache';
}

const MESSAGES: Record<Props['reason'], string> = {
  invalid_id: 'El link parece estar roto.',
  not_found: 'No encontramos este comercio.',
  offline_no_cache: 'Necesitás conexión para ver este comercio.',
};

export default function BusinessNotFound({ reason }: Props) {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        gap: 2,
        px: 3,
        textAlign: 'center',
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="body1" color="text.secondary">
        {MESSAGES[reason]}
      </Typography>
      <Button variant="outlined" onClick={() => navigate('/')}>
        Volver al mapa
      </Button>
    </Box>
  );
}
