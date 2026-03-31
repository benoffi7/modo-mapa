import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import { fetchActivityFeedDiag } from '../../../services/admin/config';
import { trackEvent } from '../../../utils/analytics';
import { ADMIN_ACTIVITY_FEED_DIAG } from '../../../constants/analyticsEvents';
import type { ActivityFeedDiagItem } from '../../../types/admin';

const TYPE_COLOR_MAP: Record<string, 'info' | 'success' | 'secondary'> = {
  rating: 'info',
  comment: 'success',
  favorite: 'secondary',
};

export default function ActivityFeedDiag() {
  const [userId, setUserId] = useState('');
  const [items, setItems] = useState<ActivityFeedDiagItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const trimmed = userId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setItems(null);

    try {
      const result = await fetchActivityFeedDiag(trimmed);
      setItems(result.items);
      trackEvent(ADMIN_ACTIVITY_FEED_DIAG, { userId: trimmed, count: result.total });
    } catch {
      setError('No se pudo obtener el activity feed');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Diagnóstico de Activity Feed
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          label="ID de usuario"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleSearch}
          disabled={loading || !userId.trim() || !navigator.onLine}
        >
          Buscar
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {items !== null && items.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary">
          Sin resultados para este usuario
        </Typography>
      )}

      {items !== null && items.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Negocio</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Chip
                      label={item.type}
                      size="small"
                      color={TYPE_COLOR_MAP[item.type] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>{item.actorName}</TableCell>
                  <TableCell>{item.businessName}</TableCell>
                  <TableCell>
                    {new Date(item.createdAt).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.isExpired ? 'Expirado' : 'Activo'}
                      size="small"
                      color={item.isExpired ? 'error' : 'success'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
