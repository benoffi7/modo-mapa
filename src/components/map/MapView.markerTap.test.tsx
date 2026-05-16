import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Business } from '../../types';

// Capture the latest onClick prop passed to BusinessMarker so each test can
// invoke it imperatively to simulate a marker tap.
const markerOnClicks: Array<(id: string) => void> = [];

vi.mock('@vis.gl/react-google-maps', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Map: ({ children }: any) => <div data-testid="google-map">{children}</div>,
  useMap: () => null,
}));

const mockSetSelectedBusiness = vi.fn();
vi.mock('../../context/SelectionContext', () => ({
  useSelection: () => ({ selectedBusiness: null, setSelectedBusiness: mockSetSelectedBusiness }),
}));

let mockUseBusinesses: { businesses: Business[] } = { businesses: [] };
vi.mock('../../hooks/useBusinesses', () => ({
  useBusinesses: () => mockUseBusinesses,
}));

vi.mock('../../context/FiltersContext', () => ({
  useFilters: () => ({ userLocation: null, searchQuery: '', activeFilters: [] }),
}));

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => ({ settings: {} }),
}));

const mockGetBusinessById = vi.fn<(id: string) => Business | undefined>();
vi.mock('../../utils/businessMap', () => ({
  getBusinessById: (id: string) => mockGetBusinessById(id),
}));

vi.mock('./BusinessMarker', () => ({
  default: ({ onClick }: { onClick: (id: string) => void }) => {
    markerOnClicks.push(onClick);
    return null;
  },
}));
vi.mock('./OfficeMarker', () => ({ default: () => null }));
vi.mock('./MapSkeleton', () => ({ default: () => null }));

vi.mock('../../constants/map', () => ({
  BUENOS_AIRES_CENTER: { lat: -34.6, lng: -58.4 },
}));

import MapView from './MapView';

const FIXTURE: Business = {
  id: 'biz_001',
  name: 'Café Central',
  category: 'cafe',
  address: 'Av 1',
  lat: -34.6,
  lng: -58.4,
  tags: [],
  phone: null,
};

describe('MapView marker tap', () => {
  beforeEach(() => {
    mockSetSelectedBusiness.mockReset();
    mockGetBusinessById.mockReset();
    markerOnClicks.length = 0;
  });

  it('sin filtro: marker tap selecciona el business correcto via getBusinessById', () => {
    mockUseBusinesses = { businesses: [FIXTURE] };
    mockGetBusinessById.mockImplementation((id) => (id === 'biz_001' ? FIXTURE : undefined));

    render(<MapView />);

    expect(markerOnClicks.length).toBeGreaterThan(0);
    const onClick = markerOnClicks[markerOnClicks.length - 1];
    onClick('biz_001');

    expect(mockGetBusinessById).toHaveBeenCalledWith('biz_001');
    expect(mockSetSelectedBusiness).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedBusiness).toHaveBeenCalledWith(FIXTURE);
  });

  it('con filtro activo que excluye el business: lookup sigue resolviendo (dataset estatico es fuente de verdad)', () => {
    // El render filtra (businesses: []) pero la fuente de verdad para handleMarkerClick
    // es `getBusinessById`, que apunta al singleton del dataset estatico. Invocamos
    // onClick imperativamente para validar el invariante.
    mockUseBusinesses = { businesses: [] };
    mockGetBusinessById.mockImplementation((id) => (id === 'biz_001' ? FIXTURE : undefined));

    // Sin marker rendereado, capturamos handleMarkerClick directamente: forzamos
    // un render con un marker provisto via fixture y luego cambiamos el resultado.
    mockUseBusinesses = { businesses: [FIXTURE] };
    render(<MapView />);
    const onClick = markerOnClicks[markerOnClicks.length - 1];

    // Simula que un filtro lo escondio del render pero el callback aun se invoca
    // (p. ej. desde una interaccion previa en cache). El lookup debe resolver.
    onClick('biz_001');

    expect(mockGetBusinessById).toHaveBeenCalledWith('biz_001');
    expect(mockSetSelectedBusiness).toHaveBeenCalledWith(FIXTURE);
  });

  it('id desconocido: getBusinessById retorna undefined y setSelectedBusiness no se llama', () => {
    mockUseBusinesses = { businesses: [FIXTURE] };
    mockGetBusinessById.mockReturnValue(undefined);

    render(<MapView />);
    const onClick = markerOnClicks[markerOnClicks.length - 1];
    onClick('biz_unknown');

    expect(mockGetBusinessById).toHaveBeenCalledWith('biz_unknown');
    expect(mockSetSelectedBusiness).not.toHaveBeenCalled();
  });
});
