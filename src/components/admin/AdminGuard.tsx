import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../../context/AuthContext';

const ADMIN_EMAIL = 'benoffi11@gmail.com';

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // No session or anonymous → show login
  if (!user || user.isAnonymous) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 3 }}>
        <Typography variant="h4">Panel de Administración</Typography>
        <Typography variant="body1" color="text.secondary">
          Inicia sesión con tu cuenta de Google para acceder.
        </Typography>
        <Button onClick={signInWithGoogle} variant="contained" size="large">
          Iniciar sesión con Google
        </Button>
      </Box>
    );
  }

  // Google session but wrong email → deny
  if (user.email !== ADMIN_EMAIL) {
    void signOut();
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          Acceso denegado. Solo {ADMIN_EMAIL} puede acceder al panel de administración.
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
