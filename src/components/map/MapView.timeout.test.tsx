import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@vis.gl/react-google-maps', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Map: ({ children }: any) => <div data-testid="google-map">{children}</div>,
  useMap: () => null,
}));

vi.mock('../../context/SelectionContext', () => ({
  useSelection: () => ({ selectedBusiness: null, setSelectedBusiness: vi.fn() }),
}));

vi.mock('../../context/FiltersContext', () => ({
  useFilters: () => ({ userLocation: null, searchQuery: '', activeFilters: [] }),
}));

vi.mock('../../hooks/useBusinesses', () => ({
  useBusinesses: () => ({ businesses: [] }),
}));

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => ({ settings: {} }),
}));

vi.mock('./BusinessMarker', () => ({ default: () => null }));
vi.mock('./OfficeMarker', () => ({ default: () => null }));
vi.mock('./MapSkeleton', () => ({ default: () => <div data-testid="map-skeleton">skeleton</div> }));

vi.mock('../../constants/map', () => ({
  BUENOS_AIRES_CENTER: { lat: -34.6, lng: -58.4 },
}));

import MapView from './MapView';

describe('MapView timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el skeleton inicialmente mientras el mapa no cargó', () => {
    render(<MapView />);
    expect(screen.getByTestId('map-skeleton')).toBeInTheDocument();
  });

  it('muestra el error después de 10 segundos sin que onTilesLoaded dispare', async () => {
    render(<MapView />);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/No se pudo cargar el mapa/)).toBeInTheDocument();
    expect(screen.queryByTestId('map-skeleton')).not.toBeInTheDocument();
  });
});
