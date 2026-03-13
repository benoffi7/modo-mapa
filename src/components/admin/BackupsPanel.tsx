import { useEffect, useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import { httpsCallable } from 'firebase/functions';
import type { HttpsCallableResult } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { BackupEntry, ConfirmAction } from './backupTypes';
import { formatBackupDate, extractErrorMessage, mapErrorToUserMessage, logError } from './backupUtils';
import BackupTable from './BackupTable';
import BackupConfirmDialog from './BackupConfirmDialog';

// ── Callable types ──────────────────────────────────────────────────────

interface ListBackupsRequest {
  pageSize?: number;
  pageToken?: string;
}

interface ListBackupsResponse {
  backups: BackupEntry[];
  nextPageToken: string | null;
  totalCount: number;
}

interface CreateBackupResponse {
  id: string;
  createdAt: string;
}

interface RestoreBackupRequest {
  backupId: string;
}

interface DeleteBackupRequest {
  backupId: string;
}

interface SuccessResponse {
  success: true;
}

// ── Callable references ────────────────────────────────────────────────

const createBackupFn = httpsCallable<unknown, CreateBackupResponse>(functions, 'createBackup');
const listBackupsFn = httpsCallable<ListBackupsRequest, ListBackupsResponse>(functions, 'listBackups');
const restoreBackupFn = httpsCallable<RestoreBackupRequest, SuccessResponse>(functions, 'restoreBackup');
const deleteBackupFn = httpsCallable<DeleteBackupRequest, SuccessResponse>(functions, 'deleteBackup');

import { ADMIN_PAGE_SIZE, AUTO_DISMISS_MS } from '../../constants';

// ── Component ──────────────────────────────────────────────────────────

export default function BackupsPanel() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Auto-dismiss success alerts
  useEffect(() => {
    if (success) {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSuccess(null);
        successTimerRef.current = null;
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [success]);

  const fetchBackups = useCallback(async (pageToken?: string) => {
    try {
      setError(null);
      let result: HttpsCallableResult<ListBackupsResponse>;
      if (pageToken) {
        result = await listBackupsFn({ pageSize: ADMIN_PAGE_SIZE, pageToken });
      } else {
        result = await listBackupsFn({ pageSize: ADMIN_PAGE_SIZE });
      }
      const { backups: newBackups, nextPageToken: token, totalCount: total } = result.data;

      if (pageToken) {
        setBackups((prev) => [...prev, ...newBackups]);
      } else {
        setBackups(newBackups);
      }
      setNextPageToken(token);
      setTotalCount(total);
    } catch (err) {
      logError('error listing backups', err);
      setError(mapErrorToUserMessage(extractErrorMessage(err), 'Error cargando backups'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await fetchBackups();
  }, [fetchBackups]);

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    await fetchBackups(nextPageToken);
  }, [nextPageToken, fetchBackups]);

  const handleCreate = useCallback(async () => {
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await createBackupFn({});
      setSuccess('Backup creado exitosamente.');
      setLoading(true);
      await fetchBackups();
    } catch (err) {
      logError('error creating backup', err);
      setError(mapErrorToUserMessage(extractErrorMessage(err), 'Error al crear el backup'));
    } finally {
      setOperating(false);
    }
  }, [fetchBackups]);

  const handleRestore = useCallback(async () => {
    if (confirmAction?.type !== 'restore') return;
    const backup = confirmAction.backup;
    setConfirmAction(null);
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await restoreBackupFn({ backupId: backup.id });
      setSuccess(`Backup del ${formatBackupDate(backup.createdAt)} restaurado exitosamente.`);
    } catch (err) {
      logError('error restoring backup', err);
      setError(mapErrorToUserMessage(extractErrorMessage(err), 'Error al restaurar el backup'));
    } finally {
      setOperating(false);
    }
  }, [confirmAction]);

  const handleDelete = useCallback(async () => {
    if (confirmAction?.type !== 'delete') return;
    const backup = confirmAction.backup;
    setConfirmAction(null);
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteBackupFn({ backupId: backup.id });
      setSuccess(`Backup del ${formatBackupDate(backup.createdAt)} eliminado.`);
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      setTotalCount((prev) => prev - 1);
    } catch (err) {
      logError('error deleting backup', err);
      setError(mapErrorToUserMessage(extractErrorMessage(err), 'Error al eliminar el backup'));
    } finally {
      setOperating(false);
    }
  }, [confirmAction]);

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;
    if (confirmAction.type === 'restore') {
      void handleRestore();
    } else {
      void handleDelete();
    }
  }, [confirmAction, handleRestore, handleDelete]);

  const handleCloseConfirm = useCallback(() => {
    setConfirmAction(null);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }} role="status" aria-label="Cargando backups">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={operating}
          startIcon={operating ? <CircularProgress size={18} color="inherit" /> : undefined}
          aria-busy={operating}
        >
          {operating ? 'Procesando...' : 'Crear backup'}
        </Button>
        <Tooltip title="Refrescar lista">
          <span>
            <IconButton onClick={handleRefresh} disabled={operating} aria-label="Refrescar lista de backups">
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
        {totalCount > 0 && (
          <Typography variant="body2" color="text.secondary">
            {totalCount} backup{totalCount !== 1 ? 's' : ''} en total
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} role="alert">
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)} role="status">
          {success}
        </Alert>
      )}

      {backups.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No hay backups disponibles.
        </Typography>
      ) : (
        <>
          <BackupTable
            backups={backups}
            operating={operating}
            onConfirmAction={setConfirmAction}
          />

          {nextPageToken && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleLoadMore}
                disabled={loadingMore}
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
              >
                {loadingMore ? 'Cargando...' : 'Cargar mas'}
              </Button>
            </Box>
          )}
        </>
      )}

      <BackupConfirmDialog
        confirmAction={confirmAction}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirmAction}
      />
    </Box>
  );
}
