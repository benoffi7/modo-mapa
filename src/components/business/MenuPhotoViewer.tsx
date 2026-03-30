import { useState } from 'react';
import { Dialog, IconButton, Typography, Box, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReportIcon from '@mui/icons-material/Report';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { formatDateMedium } from '../../utils/formatDate';
import { logger } from '../../utils/logger';

interface Props {
  open: boolean;
  photoUrl: string;
  photoId: string;
  reviewedAt: Date | undefined;
  onClose: () => void;
}

export default function MenuPhotoViewer({ open, photoUrl, photoId, reviewedAt, onClose }: Props) {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);

  const handleReport = async () => {
    setReporting(true);
    try {
      const report = httpsCallable(functions, 'reportMenuPhoto');
      await report({ photoId });
      setReported(true);
    } catch (err) {
      if (import.meta.env.DEV) logger.error('Error reporting photo:', err);
    } finally {
      setReporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box sx={{ position: 'relative', height: '100%', bgcolor: 'black', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1 }}>
          {reviewedAt && (
            <Typography variant="body2" sx={{ color: 'white', pl: 1 }}>
              {`Menú actualizado: ${formatDateMedium(reviewedAt)}`}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto', gap: 0.5 }}>
            {user && (
              <Button
                size="small"
                startIcon={<ReportIcon />}
                onClick={handleReport}
                disabled={reported || reporting || isOffline}
                title={isOffline ? 'Requiere conexión' : undefined}
                sx={{ color: reported ? 'grey.500' : 'warning.main' }}
              >
                {reported ? 'Reportada' : 'Reportar'}
              </Button>
            )}
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
          <img
            src={photoUrl}
            alt="Foto del menú"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </Box>
      </Box>
    </Dialog>
  );
}
