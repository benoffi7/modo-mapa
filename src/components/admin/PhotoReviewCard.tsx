import { useState, useEffect } from 'react';
import { Card, CardMedia, CardContent, CardActions, Typography, Button, TextField, Box, Chip } from '@mui/material';
import ReportIcon from '@mui/icons-material/Report';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functions } from '../../config/firebase';
import { allBusinesses } from '../../hooks/useBusinesses';
import { formatDateShort } from '../../utils/formatDate';
import type { MenuPhoto } from '../../types';

const STATUS_CHIP: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'Pendiente', color: 'warning' },
  approved: { label: 'Aprobada', color: 'success' },
  rejected: { label: 'Rechazada', color: 'error' },
};

interface Props {
  photo: MenuPhoto;
  onAction: () => void;
}

export default function PhotoReviewCard({ photo, onAction }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const businessName = allBusinesses.find((b) => b.id === photo.businessId)?.name ?? photo.businessId;
  const chipInfo = STATUS_CHIP[photo.status] ?? { label: photo.status, color: 'default' as const };

  useEffect(() => {
    const path = photo.thumbnailPath || photo.storagePath;
    if (!path) return;
    getDownloadURL(ref(storage, path))
      .then(setImageUrl)
      .catch(() => setImageUrl(null));
  }, [photo]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const approve = httpsCallable(functions, 'approveMenuPhoto');
      await approve({ photoId: photo.id });
      onAction();
    } catch (err) {
      console.error('Error approving photo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const reject = httpsCallable(functions, 'rejectMenuPhoto');
      await reject({ photoId: photo.id, reason });
      onAction();
    } catch (err) {
      console.error('Error rejecting photo:', err);
    } finally {
      setLoading(false);
      setRejecting(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const del = httpsCallable(functions, 'deleteMenuPhoto');
      await del({ photoId: photo.id });
      onAction();
    } catch (err) {
      console.error('Error deleting photo:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => {
    if (rejecting) {
      return (
        <Box sx={{ width: '100%', px: 1, pb: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Motivo de rechazo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => setRejecting(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button size="small" color="error" variant="contained" onClick={handleReject} disabled={loading}>
              Confirmar rechazo
            </Button>
          </Box>
        </Box>
      );
    }

    switch (photo.status) {
      case 'pending':
        return (
          <>
            <Button size="small" color="success" variant="contained" onClick={handleApprove} disabled={loading}>
              Aprobar
            </Button>
            <Button size="small" color="error" onClick={() => setRejecting(true)} disabled={loading}>
              Rechazar
            </Button>
          </>
        );
      case 'rejected':
        return (
          <>
            <Button size="small" color="success" variant="contained" onClick={handleApprove} disabled={loading}>
              Aprobar
            </Button>
            <Button size="small" color="error" onClick={handleDelete} disabled={loading}>
              Eliminar
            </Button>
          </>
        );
      case 'approved':
        return (
          <>
            <Button size="small" color="error" onClick={() => setRejecting(true)} disabled={loading}>
              Rechazar
            </Button>
            <Button size="small" color="error" variant="outlined" onClick={handleDelete} disabled={loading}>
              Eliminar
            </Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card sx={{ maxWidth: 345 }}>
      {imageUrl && (
        <CardMedia
          component="img"
          height="200"
          image={imageUrl}
          alt={`Menú de ${businessName}`}
          sx={{ objectFit: 'cover' }}
        />
      )}
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{businessName}</Typography>
          <Chip label={chipInfo.label} color={chipInfo.color} size="small" />
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {`Usuario: ${photo.userId.slice(0, 8)}...`}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {`Subida: ${formatDateShort(photo.createdAt)}`}
        </Typography>
        {photo.reviewedAt && (
          <Typography variant="caption" color="text.secondary" display="block">
            {`Revisada: ${formatDateShort(photo.reviewedAt)}`}
          </Typography>
        )}
        {photo.rejectionReason && (
          <Typography variant="caption" color="error" display="block">
            {`Motivo: ${photo.rejectionReason}`}
          </Typography>
        )}
        {photo.reportCount > 0 && (
          <Chip
            icon={<ReportIcon />}
            label={`${photo.reportCount} reporte${photo.reportCount > 1 ? 's' : ''}`}
            color="warning"
            size="small"
            sx={{ mt: 0.5 }}
          />
        )}
      </CardContent>
      <CardActions>
        {renderActions()}
      </CardActions>
    </Card>
  );
}
