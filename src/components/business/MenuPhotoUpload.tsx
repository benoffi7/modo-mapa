import { useState, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, LinearProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { uploadMenuPhoto } from '../../services/menuPhotos';
import { logger } from '../../utils/logger';

interface Props {
  open: boolean;
  businessId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MenuPhotoUpload({ open, businessId, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!user || !selectedFile) return;
    setUploading(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(selectedFile, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2048,
        useWebWorker: false,
      });

      await uploadMenuPhoto(user.uid, businessId, compressed, setProgress, abort.signal);
      onSuccess();
      handleReset();
    } catch (err) {
      if (import.meta.env.DEV) logger.error('MenuPhotoUpload error:', err);
      if (!abort.signal.aborted) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la foto');
      }
    } finally {
      setUploading(false);
      setProgress(0);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    handleReset();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Subir foto del menú</DialogTitle>
      <DialogContent>
        {!preview && (
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Typography color="text.secondary">
              Tocá para seleccionar una imagen
            </Typography>
            <Typography variant="caption" color="text.secondary">
              JPG, PNG o WebP. Máximo 5 MB.
            </Typography>
          </Box>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={handleFileSelect}
        />
        {preview && (
          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <img
              src={preview}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }}
            />
          </Box>
        )}
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {`Subiendo... ${Math.round(progress)}%`}
            </Typography>
          </Box>
        )}
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedFile || uploading || isOffline}
          title={isOffline ? 'Requiere conexion' : undefined}
        >
          Enviar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
