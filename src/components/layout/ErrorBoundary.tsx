import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Lazy-load Sentry to keep it out of the main bundle
    void import('@sentry/react').then((Sentry) => {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: info.componentStack ?? '' } },
      });
    });

    if (import.meta.env.DEV) {
      logger.error('ErrorBoundary caught:', error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100dvh',
            gap: 2,
            p: 3,
            textAlign: 'center',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
          <Typography variant="h6">Algo salió mal</Typography>
          <Typography variant="body2" color="text.secondary">
            Ocurrió un error inesperado. Intentá recargar la página.
          </Typography>
          <Button variant="contained" onClick={this.handleReset}>
            Reintentar
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
