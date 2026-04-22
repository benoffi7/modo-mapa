import { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip, IconButton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { useAuth } from '../../context/AuthContext';
import { useBusinessScope } from '../../context/BusinessScopeContext';
import { getUserPendingPhotos, getMenuPhotoUrl } from '../../services/menuPhotos';
import { formatDateMedium } from '../../utils/formatDate';
import MenuPhotoUpload from './MenuPhotoUpload';
import MenuPhotoViewer from './MenuPhotoViewer';
import { SIX_MONTHS_MS } from '../../constants/timing';
import type { MenuPhoto } from '../../types';
import { logger } from '../../utils/logger';

interface Props {
  menuPhoto: MenuPhoto | null;
  isLoading: boolean;
  onPhotoChange: () => void;
}

export default function MenuPhotoSection({ menuPhoto, isLoading, onPhotoChange }: Props) {
  const { user } = useAuth();
  const { businessId } = useBusinessScope();
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
    let cancelled = false;
    getMenuPhotoUrl(path)
      .then((url) => { if (!cancelled) setPhotoUrl(url); })
      .catch((err) => { logger.error('[MenuPhotoSection] getDownloadURL failed:', err); if (!cancelled) setPhotoUrl(null); });
    return () => { cancelled = true; };
  }, [menuPhoto]);

  // Check if user has pending photos
  useEffect(() => {
    if (!user) {
      setHasPending(false); // eslint-disable-line react-hooks/set-state-in-effect -- guard clause
      return;
    }
    let cancelled = false;
    getUserPendingPhotos(user.uid, businessId)
      .then((photos) => { if (!cancelled) setHasPending(photos.length > 0); })
      .catch((err) => { logger.error('[MenuPhotoSection] getUserPendingPhotos failed:', err); if (!cancelled) setHasPending(false); });
    return () => { cancelled = true; };
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
            role="button"
            tabIndex={0}
            onClick={() => setViewerOpen(true)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setViewerOpen(true);
              }
            }}
            sx={{ cursor: 'pointer', borderRadius: 1, overflow: 'hidden', mb: 0.5, position: 'relative' }}
          >
            <img
              src={photoUrl}
              alt="Menú"
              style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 4 }}
              onError={() => setPhotoUrl(null)}
            />
            {user && !hasPending && (
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setUploadOpen(true); }}
                sx={{
                  position: 'absolute',
                  bottom: 6,
                  right: 6,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'light'
                      ? alpha(theme.palette.common.black, 0.55)
                      : alpha(theme.palette.common.white, 0.15),
                  color: 'common.white',
                  '&:hover': {
                    bgcolor: (theme) =>
                      theme.palette.mode === 'light'
                        ? alpha(theme.palette.common.black, 0.75)
                        : alpha(theme.palette.common.white, 0.25),
                  },
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
