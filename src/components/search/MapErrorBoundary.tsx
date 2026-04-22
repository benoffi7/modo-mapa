import { Component, type ReactNode } from 'react';
import { Box, Button, Alert } from '@mui/material';
import { logger } from '../../utils/logger';
import { trackEvent } from '../../utils/analytics';
import { EVT_MAP_LOAD_FAILED } from '../../constants/analyticsEvents';

interface Props {
  children: ReactNode;
  /** Called when the map fails, e.g. to switch to list view */
  onFallback?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary for the Google Maps section of SearchScreen.
 * Catches API key errors, quota errors, script-blocking tracker issues, and offline first-render.
 * Renders a fallback UI with a retry button and calls onFallback() to switch to list view.
 */
export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error): void {
    logger.error('[MapErrorBoundary] Map failed to load:', error);
    trackEvent(EVT_MAP_LOAD_FAILED, { error: error.message });
    this.props.onFallback?.();
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            No se pudo cargar el mapa. Mostrando lista.
          </Alert>
          <Button
            variant="outlined"
            aria-label="Reintentar cargar mapa"
            onClick={() => this.setState({ hasError: false })}
          >
            Reintentar
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
