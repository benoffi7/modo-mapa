/**
 * IpRateLimitsSection — admin subtab inside Alertas tab (#348).
 *
 * Inspector + reset for `_ipRateLimits/{ipHash}_{action}_{date}` docs. All
 * writes go through the `adminResetIpRateLimit` callable (assertAdmin +
 * abuseLog + per-admin rate limit + App Check enforced server-side). The
 * component is purely a UI shell over the wrappers in
 * `services/admin/ipRateLimits.ts`.
 *
 * Privacy: only `ipHash` (SHA-256 of the IP) is shown — never the raw IP.
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
import { listAdminIpRateLimits, resetAdminIpRateLimit } from '../../../services/admin';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useToast } from '../../../context/ToastContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { trackEvent } from '../../../utils/analytics';
import {
  EVT_ADMIN_IP_RATE_LIMIT_RESET,
  EVT_ADMIN_IP_RATE_LIMIT_VIEWED,
} from '../../../constants/analyticsEvents/admin';
import { MSG_ADMIN, MSG_OFFLINE } from '../../../constants/messages';
import { CHIP_SMALL_SX } from '../../../theme/cards';
import { logger } from '../../../utils/logger';
import AdminPanelWrapper from '../AdminPanelWrapper';
import type { AdminIpRateLimitItem } from '../../../types/admin';

interface DialogState {
  row: AdminIpRateLimitItem;
}

interface FirebaseFunctionsError extends Error {
  code?: string;
}

function isAlreadyResetError(err: unknown): boolean {
  const code = (err as FirebaseFunctionsError | undefined)?.code;
  return code === 'functions/not-found' || code === 'not-found';
}

export default function IpRateLimitsSection() {
  const toast = useToast();
  const { isOffline } = useConnectivity();

  const [actionFilter, setActionFilter] = useState('');
  const [ipHashFilter, setIpHashFilter] = useState('');
  const deferredAction = useDeferredValue(actionFilter);
  const deferredIpHash = useDeferredValue(ipHashFilter);

  const fetcher = useCallback(() => {
    const action = deferredAction.trim();
    const ipHash = deferredIpHash.trim();
    const params: { action?: string; ipHash?: string } = {};
    if (action) params.action = action;
    if (ipHash) params.ipHash = ipHash;
    return listAdminIpRateLimits(params);
  }, [deferredAction, deferredIpHash]);

  const { data, loading, error, refetch } = useAsyncData(fetcher);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dedup: emit `admin_ip_rate_limit_viewed` once per mount on the first
  // successful load (data !== null). useRef avoids re-emit on refetch.
  const viewedEmittedRef = useRef(false);
  useEffect(() => {
    if (!viewedEmittedRef.current && !loading && !error && data !== null) {
      viewedEmittedRef.current = true;
      trackEvent(EVT_ADMIN_IP_RATE_LIMIT_VIEWED);
    }
  }, [loading, error, data]);

  const rows = data ?? [];
  const hasFilter = deferredAction.trim() !== '' || deferredIpHash.trim() !== '';

  const offlineTooltip = isOffline ? MSG_OFFLINE.requiresConnection : '';

  const handleConfirmReset = useCallback(async () => {
    if (!dialog) return;
    setSubmitting(true);
    const { row } = dialog;
    try {
      await resetAdminIpRateLimit(row.docId);
      trackEvent(EVT_ADMIN_IP_RATE_LIMIT_RESET, { action: row.action });
      toast.success(MSG_ADMIN.ipRateLimitResetSuccess);
      setDialog(null);
      refetch();
    } catch (err) {
      if (isAlreadyResetError(err)) {
        toast.info(MSG_ADMIN.ipRateLimitAlreadyReset);
        setDialog(null);
        refetch();
      } else {
        logger.error('adminResetIpRateLimit failed', err);
        toast.error(MSG_ADMIN.ipRateLimitResetError);
      }
    } finally {
      setSubmitting(false);
    }
  }, [dialog, refetch, toast]);

  const dialogBody = useMemo(() => {
    if (!dialog) return '';
    if (dialog.row.windowActive) {
      return `Desbloquea esta IP para la acción ${dialog.row.action} hasta el reset diario.`;
    }
    return 'Limpia esta entrada (la ventana del día ya expiró). Es housekeeping.';
  }, [dialog]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <TextField
          label="Filtrar por acción"
          size="small"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <TextField
          label="Filtrar por IP Hash"
          size="small"
          value={ipHashFilter}
          onChange={(e) => setIpHashFilter(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        {(actionFilter || ipHashFilter) && (
          <Button
            size="small"
            variant="text"
            onClick={() => {
              setActionFilter('');
              setIpHashFilter('');
            }}
            aria-label="Limpiar filtro"
            sx={{ minHeight: 44 }}
          >
            Limpiar
          </Button>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Se muestra un hash SHA-256 de la IP, no la dirección real.
      </Typography>

      <AdminPanelWrapper
        loading={loading}
        error={error}
        errorMessage="No se pudieron cargar los IP rate limits."
      >
        {rows.length === 0 ? (
          <Alert severity="info" variant="outlined">
            {hasFilter ? 'Sin resultados para este filtro.' : 'Sin entradas.'}
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>IP Hash</TableCell>
                  <TableCell>Acción</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const hashShort = row.ipHash.slice(0, 8);
                  return (
                    <TableRow key={row.docId} hover>
                      <TableCell>
                        <Tooltip title={row.ipHash}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {hashShort}…
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.action} size="small" sx={CHIP_SMALL_SX} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.date}</TableCell>
                      <TableCell align="right">{row.count}</TableCell>
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
                              aria-label={`Resetear rate limit de IP ${hashShort} (acción ${row.action})`}
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
        aria-labelledby="ip-rate-limit-reset-title"
        aria-describedby="ip-rate-limit-reset-body"
      >
        <DialogTitle id="ip-rate-limit-reset-title">¿Resetear rate limit de IP?</DialogTitle>
        <DialogContent>
          <DialogContentText id="ip-rate-limit-reset-body">{dialogBody}</DialogContentText>
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
