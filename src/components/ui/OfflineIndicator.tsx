import { useState, useEffect } from 'react';
import { Chip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Chip
      icon={<CloudOffIcon />}
      label="Sin conexión"
      color="warning"
      size="small"
      sx={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1400,
      }}
    />
  );
}
