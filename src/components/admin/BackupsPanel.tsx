import { useEffect, useState, useCallback } from 'react';
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
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

interface BackupEntry {
  id: string;
  uri: string;
  createdAt: string;
}

interface ListBackupsResponse {
  backups: BackupEntry[];
}

const createBackupFn = httpsCallable(functions, 'createBackup');
const listBackupsFn = httpsCallable<void, ListBackupsResponse>(functions, 'listBackups');
const restoreBackupFn = httpsCallable(functions, 'restoreBackup');

function formatDate(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return createdAt;
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return createdAt;
  }
}

export default function BackupsPanel() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const result = await listBackupsFn();
      setBackups(result.data.backups);
    } catch (err) {
      setError(`Error cargando backups: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  const handleCreate = async () => {
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await createBackupFn();
      setSuccess('Backup creado exitosamente.');
      setLoading(true);
      await fetchBackups();
    } catch (err) {
      setError(`Error creando backup: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOperating(false);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore) return;
    setConfirmRestore(null);
    setOperating(true);
    setError(null);
    setSuccess(null);
    try {
      await restoreBackupFn({ backupUri: confirmRestore.uri });
      setSuccess(`Backup ${formatDate(confirmRestore.createdAt)} restaurado exitosamente.`);
    } catch (err) {
      setError(`Error restaurando backup: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOperating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
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
        >
          {operating ? 'Procesando...' : 'Crear backup'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {backups.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No hay backups disponibles.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>{formatDate(backup.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="warning"
                      onClick={() => setConfirmRestore(backup)}
                      disabled={operating}
                    >
                      Restaurar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={confirmRestore !== null} onClose={() => setConfirmRestore(null)}>
        <DialogTitle>Restaurar backup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta accion sobrescribira los datos actuales con el backup del{' '}
            <strong>{confirmRestore ? formatDate(confirmRestore.createdAt) : ''}</strong>.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontWeight: 'bold' }}>
            Esta operacion NO es reversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRestore(null)}>Cancelar</Button>
          <Button onClick={handleRestore} color="warning" variant="contained">
            Restaurar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
