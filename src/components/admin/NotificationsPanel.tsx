import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { fetchNotificationDetails } from '../../services/admin';
import { useAsyncData } from '../../hooks/useAsyncData';
import AdminPanelWrapper from './AdminPanelWrapper';
import StatCard from './StatCard';
import { NOTIFICATION_TYPE_LABELS } from '../../constants/admin';
import type { NotificationDetails } from '../../types/admin';

export default function NotificationsPanel() {
  const fetcher = useCallback(() => fetchNotificationDetails(), []);
  const { data, loading, error } = useAsyncData<NotificationDetails>(fetcher);

  const globalReadRate = data && data.total > 0
    ? Math.round((data.read / data.total) * 100)
    : 0;

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudieron cargar las notificaciones.">
      {data && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Total enviadas" value={data.total} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Leídas" value={data.read} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="No leídas" value={data.unread} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label={`Tasa de lectura (${globalReadRate}%)`} value={globalReadRate} />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom>Desglose por tipo</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Leídas</TableCell>
                  <TableCell align="right">No leídas</TableCell>
                  <TableCell>Tasa de lectura</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.byType.map((row) => (
                  <TableRow key={row.type}>
                    <TableCell>{NOTIFICATION_TYPE_LABELS[row.type] ?? row.type}</TableCell>
                    <TableCell align="right">{row.total}</TableCell>
                    <TableCell align="right">{row.read}</TableCell>
                    <TableCell align="right">{row.total - row.read}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={row.readRate}
                          color={row.readRate < 20 ? 'error' : row.readRate < 50 ? 'warning' : 'primary'}
                          sx={{ flex: 1, height: 8, borderRadius: 1 }}
                        />
                        <Chip
                          label={`${row.readRate}%`}
                          size="small"
                          color={row.readRate < 20 ? 'error' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </AdminPanelWrapper>
  );
}
