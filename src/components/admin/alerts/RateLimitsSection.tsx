/**
 * RateLimitsSection — admin subtab inside Alertas tab (#327).
 *
 * Inspector + reset for `_rateLimits/{key}` docs. All writes go through
 * the `adminResetRateLimit` callable (assertAdmin + abuseLog + per-admin
 * rate limit + App Check enforced server-side). The component is purely a
 * UI shell over the wrappers in `services/admin/rateLimits.ts`.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { listAdminRateLimits, resetAdminRateLimit } from '../../../services/admin';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useToast } from '../../../context/ToastContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { trackEvent } from '../../../utils/analytics';
import {
  EVT_ADMIN_RATE_LIMIT_RESET,
  EVT_ADMIN_RATE_LIMIT_VIEWED,
} from '../../../constants/analyticsEvents/admin';
import { MSG_ADMIN, MSG_OFFLINE } from '../../../constants/messages';
import { CHIP_SMALL_SX } from '../../../theme/cards';
import { formatRelativeTime } from '../../../utils/formatDate';
import { logger } from '../../../utils/logger';
import AdminPanelWrapper from '../AdminPanelWrapper';
import type { AdminRateLimitItem } from '../../../types/admin';

interface DialogState {
  row: AdminRateLimitItem;
}

interface FirebaseFunctionsError extends Error {
  code?: string;
}

function isAlreadyResetError(err: unknown): boolean {
  const code = (err as FirebaseFunctionsError | undefined)?.code;
  return code === 'functions/not-found' || code === 'not-found';
}

export default function RateLimitsSection() {
  const toast = useToast();
  const { isOffline } = useConnectivity();

  const [userIdFilter, setUserIdFilter] = useState('');
  const deferredFilter = useDeferredValue(userIdFilter);

  const fetcher = useCallback(() => {
    const trimmed = deferredFilter.trim();
    return listAdminRateLimits(trimmed ? { userId: trimmed } : {});
  }, [deferredFilter]);

  const { data, loading, error, refetch } = useAsyncData(fetcher);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dedup: emit `admin_rate_limit_viewed` once per mount on the first
  // successful load (data !== null). useRef avoids re-emit on refetch.
  const viewedEmittedRef = useRef(false);
  useEffect(() => {
    if (!viewedEmittedRef.current && !loading && !error && data !== null) {
      viewedEmittedRef.current = true;
      trackEvent(EVT_ADMIN_RATE_LIMIT_VIEWED);
    }
  }, [loading, error, data]);

  const rows = data ?? [];

  const offlineTooltip = isOffline ? MSG_OFFLINE.requiresConnection : '';

  const handleConfirmReset = useCallback(async () => {
    if (!dialog) return;
    setSubmitting(true);
    const { row } = dialog;
    try {
      await resetAdminRateLimit(row.docId);
      trackEvent(EVT_ADMIN_RATE_LIMIT_RESET, { category: row.category });
      toast.success(MSG_ADMIN.rateLimitResetSuccess);
      setDialog(null);
      refetch();
    } catch (err) {
      if (isAlreadyResetError(err)) {
        toast.info(MSG_ADMIN.rateLimitAlreadyReset);
        setDialog(null);
        refetch();
      } else {
        logger.error('adminResetRateLimit failed', err);
        toast.error(MSG_ADMIN.rateLimitResetError);
      }
    } finally {
      setSubmitting(false);
    }
  }, [dialog, refetch, toast]);

  const dialogBody = useMemo(() => {
    if (!dialog) return '';
    const uidShort = `${dialog.row.userId.slice(0, 8)}…`;
    if (dialog.row.windowActive) {
      return `Desbloquea al usuario ${uidShort} en categoría ${dialog.row.category} inmediatamente.`;
    }
    return 'Limpia esta entrada (la ventana ya expiró). Es housekeeping.';
  }, [dialog]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <TextField
          label="Filtrar por User ID"
          size="small"
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        {userIdFilter && (
          <Button
            size="small"
            variant="text"
            onClick={() => setUserIdFilter('')}
            aria-label="Limpiar filtro"
            sx={{ minHeight: 44 }}
          >
            Limpiar
          </Button>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Mostrando docs con campo userId. Para casos previos a v2.42, listar sin filtro o usar Cloud Console.
      </Typography>

      <AdminPanelWrapper
        loading={loading}
        error={error}
        errorMessage="No se pudieron cargar los rate limits."
      >
        {rows.length === 0 ? (
          <Alert severity="info" variant="outlined">
            {deferredFilter.trim() ? 'Sin resultados para este User ID.' : 'Sin entradas.'}
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Categoría</TableCell>
                  <TableCell>User ID</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell>Reset</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const userIdShort = row.userId.slice(0, 8);
                  return (
                    <TableRow key={row.docId} hover>
                      <TableCell>
                        <Chip label={row.category} size="small" sx={CHIP_SMALL_SX} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={row.userId}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {userIdShort}…
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(new Date(row.resetAt))}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={row.windowActive ? 'Activa' : 'Expirada'}
                          size="small"
                          color={row.windowActive ? 'success' : 'default'}
                          variant="outlined"
                          sx={CHIP_SMALL_SX}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={offlineTooltip}>
                          <span>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={isOffline}
                              onClick={() => setDialog({ row })}
                              aria-label={`Resetear rate limit de ${userIdShort} (categoría ${row.category})`}
                              sx={{ minHeight: 44 }}
                            >
                              Resetear
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </AdminPanelWrapper>

      <Dialog
        open={dialog !== null}
        onClose={() => {
          if (!submitting) setDialog(null);
        }}
        role="alertdialog"
        aria-labelledby="rate-limit-reset-title"
        aria-describedby="rate-limit-reset-body"
      >
        <DialogTitle id="rate-limit-reset-title">¿Resetear rate limit?</DialogTitle>
        <DialogContent>
          <DialogContentText id="rate-limit-reset-body">{dialogBody}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmReset}
            color="error"
            variant="contained"
            disabled={submitting || isOffline}
          >
            Resetear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
