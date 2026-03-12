import { useEffect, useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { httpsCallable } from 'firebase/functions';
import type { HttpsCallableResult } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { formatDateFull } from '../../utils/formatDate';

// ── Types ──────────────────────────────────────────────────────────────

interface BackupEntry {
  id: string;
  createdAt: string;
}

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

type ConfirmAction =
  | { type: 'restore'; backup: BackupEntry }
  | { type: 'delete'; backup: BackupEntry };

// ── Callable references ────────────────────────────────────────────────

const createBackupFn = httpsCallable<unknown, CreateBackupResponse>(functions, 'createBackup');
const listBackupsFn = httpsCallable<ListBackupsRequest, ListBackupsResponse>(functions, 'listBackups');
const restoreBackupFn = httpsCallable<RestoreBackupRequest, SuccessResponse>(functions, 'restoreBackup');
const deleteBackupFn = httpsCallable<DeleteBackupRequest, SuccessResponse>(functions, 'deleteBackup');

// ── Constants ──────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 5000;
const PAGE_SIZE = 20;

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function mapErrorToUserMessage(message: string, context: string): string {
  if (message.includes('internal') || message.includes('INTERNAL')) {
    return `${context}. Verifica que las Cloud Functions esten desplegadas y que el service account tenga permisos.`;
  }
  if (message.includes('permission-denied')) {
    return 'No tenes permisos para realizar esta accion.';
  }
  if (message.includes('not-found')) {
    return 'Backup no encontrado.';
  }
  if (message.includes('resource-exhausted')) {
    return 'Demasiadas solicitudes. Intenta de nuevo en un minuto.';
  }
  return `${context}: ${message}`;
}

function logError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`BackupsPanel: ${context}`, err);
  }
}

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
        result = await listBackupsFn({ pageSize: PAGE_SIZE, pageToken });
      } else {
        result = await listBackupsFn({ pageSize: PAGE_SIZE });
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

  const handleRefresh = async () => {
    setLoading(true);
    await fetchBackups();
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    await fetchBackups(nextPageToken);
  };

  const handleCreate = async () => {
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
  };

  const handleRestore = async () => {
    if (confirmAction?.type !== 'restore') return;
    const backup = confirmAction.backup;
    setConfirmAction(null);
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await restoreBackupFn({ backupId: backup.id });
      setSuccess(`Backup del ${formatDateFull(backup.createdAt)} restaurado exitosamente.`);
    } catch (err) {
      logError('error restoring backup', err);
      setError(mapErrorToUserMessage(extractErrorMessage(err), 'Error al restaurar el backup'));
    } finally {
      setOperating(false);
    }
  };

  const handleDelete = async () => {
    if (confirmAction?.type !== 'delete') return;
    const backup = confirmAction.backup;
    setConfirmAction(null);
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteBackupFn({ backupId: backup.id });
      setSuccess(`Backup del ${formatDateFull(backup.createdAt)} eliminado.`);
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      setTotalCount((prev) => prev - 1);
    } catch (err) {
      logError('error deleting backup', err);
      setError(mapErrorToUserMessage(extractErrorMessage(err), 'Error al eliminar el backup'));
    } finally {
      setOperating(false);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'restore') {
      void handleRestore();
    } else {
      void handleDelete();
    }
  };

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
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label="Lista de backups">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>{formatDateFull(backup.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Restaurar backup">
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => setConfirmAction({ type: 'restore', backup })}
                            disabled={operating}
                            aria-label={`Restaurar backup del ${formatDateFull(backup.createdAt)}`}
                          >
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Eliminar backup">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setConfirmAction({ type: 'delete', backup })}
                            disabled={operating}
                            aria-label={`Eliminar backup del ${formatDateFull(backup.createdAt)}`}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

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

      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {confirmAction?.type === 'restore' ? 'Restaurar backup' : 'Eliminar backup'}
        </DialogTitle>
        <DialogContent>
          {confirmAction?.type === 'restore' ? (
            <>
              <DialogContentText id="confirm-dialog-description">
                Esta accion sobrescribira los datos actuales con el backup del{' '}
                <strong>{confirmAction ? formatDateFull(confirmAction.backup.createdAt) : ''}</strong>.
              </DialogContentText>
              <DialogContentText sx={{ mt: 1 }}>
                Se creara un backup de seguridad automaticamente antes de restaurar.
              </DialogContentText>
            </>
          ) : (
            <>
              <DialogContentText id="confirm-dialog-description">
                Se eliminara permanentemente el backup del{' '}
                <strong>{confirmAction ? formatDateFull(confirmAction.backup.createdAt) : ''}</strong>.
              </DialogContentText>
              <DialogContentText sx={{ mt: 1, fontWeight: 'bold' }}>
                Esta operacion NO es reversible.
              </DialogContentText>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} autoFocus>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmAction?.type === 'restore' ? 'warning' : 'error'}
            variant="contained"
          >
            {confirmAction?.type === 'restore' ? 'Restaurar' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
