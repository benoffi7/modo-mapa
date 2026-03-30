/**
 * Shared wrapper for admin panel loading / error / empty states.
 *
 * Eliminates the duplicated Box+CircularProgress / Alert pattern
 * from every admin panel component.
 */
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

interface Props {
  loading: boolean;
  error: boolean;
  errorMessage?: string;
  children: ReactNode;
}

export default function AdminPanelWrapper({ loading, error, errorMessage, children }: Props) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {errorMessage ?? 'No se pudieron cargar los datos.'}
      </Alert>
    );
  }

  return <>{children}</>;
}
