import { useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';

interface StaleBannerProps {
  businessId: string;
  onRefresh: () => void;
}

// Track dismissed banners per session (not persisted across reloads)
const dismissedThisSession = new Set<string>();

export default function StaleBanner({ businessId, onRefresh }: StaleBannerProps) {
  const [dismissed, setDismissed] = useState(() => dismissedThisSession.has(businessId));

  if (dismissed) return null;

  const handleDismiss = () => {
    dismissedThisSession.add(businessId);
    setDismissed(true);
  };

  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        mb: 1,
        borderRadius: 1,
        bgcolor: 'warning.main',
        color: 'warning.contrastText',
      }}
    >
      <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
        Datos pueden no estar actualizados
      </Typography>
      <IconButton
        size="small"
        onClick={onRefresh}
        aria-label="Actualizar datos"
        sx={{ color: 'inherit', p: 0.5 }}
      >
        <RefreshIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={handleDismiss}
        aria-label="Cerrar aviso"
        sx={{ color: 'inherit', p: 0.5 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
