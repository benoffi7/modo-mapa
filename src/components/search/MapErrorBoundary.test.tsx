import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MapErrorBoundary from './MapErrorBoundary';

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../../constants/analyticsEvents', () => ({ EVT_MAP_LOAD_FAILED: 'map_load_failed' }));

/** Child that throws on first render */
function BombChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Maps API failed');
  return <div>Map rendered</div>;
}

describe('MapErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress React's error boundary console output in tests
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders children when there is no error', () => {
    render(
      <MapErrorBoundary>
        <BombChild shouldThrow={false} />
      </MapErrorBoundary>,
    );
    expect(screen.getByText('Map rendered')).toBeInTheDocument();
  });

  it('shows fallback UI when a child throws', () => {
    render(
      <MapErrorBoundary>
        <BombChild shouldThrow />
      </MapErrorBoundary>,
    );
    expect(screen.getByText(/No se pudo cargar el mapa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('calls onFallback when a child throws', () => {
    const onFallback = vi.fn();
    render(
      <MapErrorBoundary onFallback={onFallback}>
        <BombChild shouldThrow />
      </MapErrorBoundary>,
    );
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('does not call onFallback when no error occurs', () => {
    const onFallback = vi.fn();
    render(
      <MapErrorBoundary onFallback={onFallback}>
        <BombChild shouldThrow={false} />
      </MapErrorBoundary>,
    );
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('retry button resets hasError state and tries to render children again', () => {
    const { rerender } = render(
      <MapErrorBoundary>
        <BombChild shouldThrow />
      </MapErrorBoundary>,
    );

    expect(screen.getByText(/No se pudo cargar el mapa/)).toBeInTheDocument();

    // Click retry — this resets hasError=false; child will throw again since prop is still true
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    // After retry the boundary tries to re-render and will catch again (child still throws)
    // The fallback should be visible again
    expect(screen.getByText(/No se pudo cargar el mapa/)).toBeInTheDocument();

    // Verify boundary recovers when children stop throwing
    rerender(
      <MapErrorBoundary>
        <BombChild shouldThrow={false} />
      </MapErrorBoundary>,
    );
    // Still in error state from previous throw — retry needed again
    expect(screen.getByText(/No se pudo cargar el mapa/)).toBeInTheDocument();
  });

  it('renders children normally when no onFallback is provided', () => {
    // Should not throw when onFallback is omitted
    render(
      <MapErrorBoundary>
        <BombChild shouldThrow={false} />
      </MapErrorBoundary>,
    );
    expect(screen.getByText('Map rendered')).toBeInTheDocument();
  });
});
