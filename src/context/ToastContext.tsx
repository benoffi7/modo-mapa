import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { AlertColor } from '@mui/material';
import type { ReactNode } from 'react';

interface Toast {
  id: string;
  message: string;
  severity: AlertColor;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_HIDE_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string, severity: AlertColor) => {
    setToast({ id: crypto.randomUUID(), message, severity });
  }, []);

  const handleClose = useCallback((_?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setToast(null);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    warning: (message: string) => show(message, 'warning'),
    info: (message: string) => show(message, 'info'),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.id}
        open={toast !== null}
        autoHideDuration={AUTO_HIDE_MS}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={handleClose}
            action={
              <IconButton size="small" color="inherit" onClick={handleClose} aria-label="Cerrar">
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ width: '100%', minWidth: 280 }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
