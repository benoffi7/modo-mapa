import { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip, IconButton } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getUserPendingPhotos } from '../../services/menuPhotos';
import { formatDateMedium } from '../../utils/formatDate';
import MenuPhotoUpload from './MenuPhotoUpload';
import MenuPhotoViewer from './MenuPhotoViewer';
import { SIX_MONTHS_MS } from '../../constants/timing';
import type { MenuPhoto } from '../../types';

interface Props {
  menuPhoto: MenuPhoto | null;
  businessId: string;
  isLoading: boolean;
  onPhotoChange: () => void;
}

export default function MenuPhotoSection({ menuPhoto, businessId, isLoading, onPhotoChange }: Props) {
  const { user } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(false);

  // Load photo URL from Storage
  useEffect(() => {
    if (!menuPhoto) {
      setPhotoUrl(null); // eslint-disable-line react-hooks/set-state-in-effect -- guard clause
      return;
    }
    const path = menuPhoto.thumbnailPath || menuPhoto.storagePath;
    if (!path) return;
    getDownloadURL(ref(storage, path))
      .then(setPhotoUrl)
      .catch(() => setPhotoUrl(null));
  }, [menuPhoto]);

  // Check if user has pending photos
  useEffect(() => {
    if (!user) {
      setHasPending(false); // eslint-disable-line react-hooks/set-state-in-effect -- guard clause
      return;
    }
    getUserPendingPhotos(user.uid, businessId)
      .then((photos) => setHasPending(photos.length > 0))
      .catch(() => setHasPending(false));
  }, [user, businessId]);

  // Staleness is based on reviewedAt which is stable per photo — safe to derive
  const isStale = menuPhoto?.reviewedAt
    ? menuPhoto.reviewedAt.getTime() < (new Date().getTime() - SIX_MONTHS_MS)
    : false;

  if (isLoading) return null;

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Foto del menú</Typography>

      {menuPhoto && photoUrl ? (
        <Box>
          <Box
            onClick={() => setViewerOpen(true)}
            sx={{ cursor: 'pointer', borderRadius: 1, overflow: 'hidden', mb: 0.5, position: 'relative' }}
          >
            <img
              src={photoUrl}
              alt="Menú"
              style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4 }}
            />
            {user && !hasPending && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setUploadOpen(true); }}
                sx={{
                  position: 'absolute',
                  bottom: 6,
                  right: 6,
                  bgcolor: 'rgba(0,0,0,0.55)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                }}
              >
                <CameraAltIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {menuPhoto.reviewedAt && (
              <Typography variant="caption" color="text.secondary">
                {`Menú actualizado: ${formatDateMedium(menuPhoto.reviewedAt)}`}
              </Typography>
            )}
            {isStale && (
              <Chip label="Posiblemente desactualizado" size="small" color="warning" variant="outlined" />
            )}
          </Box>
        </Box>
      ) : (
        <Box>
          {hasPending ? (
            <Typography variant="body2" color="text.secondary">
              Tu foto está en revisión
            </Typography>
          ) : user ? (
            <Button
              startIcon={<CameraAltIcon />}
              size="small"
              onClick={() => setUploadOpen(true)}
            >
              Subir foto del menú
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No hay foto del menú
            </Typography>
          )}
        </Box>
      )}

      <MenuPhotoUpload
        open={uploadOpen}
        businessId={businessId}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          setUploadOpen(false);
          setHasPending(true);
          onPhotoChange();
        }}
      />

      {photoUrl && menuPhoto && (
        <MenuPhotoViewer
          open={viewerOpen}
          photoUrl={photoUrl}
          photoId={menuPhoto.id}
          reviewedAt={menuPhoto.reviewedAt}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </Box>
  );
}
