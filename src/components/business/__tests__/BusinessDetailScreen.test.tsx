import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  trackEvent: vi.fn(),
  recordVisit: vi.fn(),
  isOffline: false,
  dataError: false,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ key: 'abc123' }),
  useSearchParams: () => [new URLSearchParams(), mocks.setSearchParams],
}));

vi.mock('../../../utils/analytics', () => ({ trackEvent: mocks.trackEvent }));

vi.mock('../../../hooks/useBusinessData', () => ({
  useBusinessData: () => ({
    isLoading: false,
    error: mocks.dataError,
    refetch: vi.fn(),
    isFavorite: false,
    ratings: [],
    comments: [],
    userTags: [],
    customTags: [],
    userCommentLikes: new Set(),
    priceLevels: [],
    menuPhoto: null,
    stale: false,
  }),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));

vi.mock('../../../context/BusinessScopeContext', () => ({
  BusinessScopeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../hooks/useBusinessRating', () => ({
  useBusinessRating: () => ({
    averageRating: 0,
    totalRatings: 0,
    myRating: null,
    criteriaAverages: {},
    myCriteria: {},
    hasCriteriaData: false,
    handleRate: vi.fn(),
    handleDeleteRating: vi.fn(),
    handleCriterionRate: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useVisitHistory', () => ({
  useVisitHistory: () => ({ recordVisit: mocks.recordVisit }),
}));

vi.mock('../../../hooks/useTrending', () => ({
  useTrending: () => ({ data: null }),
}));

vi.mock('../BusinessSheetSkeleton', () => ({ default: () => <div>skeleton</div> }));
vi.mock('../BusinessSheetHeader', () => ({ default: () => <div>header</div> }));
vi.mock('../FavoriteButton', () => ({ default: () => <div>fav</div> }));
vi.mock('../ShareButton', () => ({ default: () => <div>share</div> }));
vi.mock('../CheckInButton', () => ({ default: () => <div>checkin</div> }));
vi.mock('../AddToListDialog', () => ({ default: () => null }));
vi.mock('../RecommendDialog', () => ({ default: () => null }));
vi.mock('../../ui/StaleBanner', () => ({ default: () => null }));
vi.mock('../CriteriaSection', () => ({ default: () => <div>criterios-content</div> }));
vi.mock('../BusinessPriceLevel', () => ({ default: () => <div>precio-content</div> }));
vi.mock('../BusinessTags', () => ({ default: () => <div>tags-content</div> }));
vi.mock('../MenuPhotoSection', () => ({ default: () => <div>foto-content</div> }));
vi.mock('../OpinionesTab', () => ({ default: () => <div>opiniones-content</div> }));
vi.mock('../BusinessNotFound', () => ({ default: ({ reason }: { reason: string }) => <div>not-found-{reason}</div> }));

import BusinessDetailScreen from '../BusinessDetailScreen';

const business = {
  id: 'biz_001',
  name: 'Test Comercio',
  category: 'restaurante',
  address: 'Calle 123',
  lat: -34,
  lng: -58,
  tags: [],
};

describe('BusinessDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOffline = false;
    mocks.dataError = false;
  });

  it('renderiza los chips de navegación', () => {
    render(<BusinessDetailScreen business={business as never} />);
    expect(screen.getByText('Criterios')).toBeInTheDocument();
    expect(screen.getByText('Precio')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Foto')).toBeInTheDocument();
    expect(screen.getByText('Opiniones')).toBeInTheDocument();
  });

  it('renderiza el header del comercio', () => {
    render(<BusinessDetailScreen business={business as never} />);
    expect(screen.getByText('header')).toBeInTheDocument();
  });

  it('cambia de chip y llama a setSearchParams', () => {
    render(<BusinessDetailScreen business={business as never} />);
    fireEvent.click(screen.getByText('Opiniones'));
    expect(mocks.setSearchParams).toHaveBeenCalledWith({ tab: 'opiniones' }, { replace: true });
  });

  it('dispara EVT_BUSINESS_DETAIL_OPENED con source sheet_cta cuando no hay initialTab', () => {
    render(<BusinessDetailScreen business={business as never} />);
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'business_detail_opened',
      expect.objectContaining({ business_id: 'biz_001', source: 'sheet_cta' }),
    );
  });

  it('dispara EVT_BUSINESS_DETAIL_OPENED con source deep_link cuando hay initialTab', () => {
    render(<BusinessDetailScreen business={business as never} initialTab="opiniones" />);
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'business_detail_opened',
      expect.objectContaining({ business_id: 'biz_001', source: 'deep_link' }),
    );
  });

  it('el botón back llama a navigate(-1) cuando location.key no es default', () => {
    render(<BusinessDetailScreen business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /volver al mapa/i }));
    expect(mocks.navigate).toHaveBeenCalledWith(-1);
  });

  it('dispara EVT_BUSINESS_DETAIL_TAB_CHANGED al cambiar chip', () => {
    render(<BusinessDetailScreen business={business as never} />);
    fireEvent.click(screen.getByText('Precio'));
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'business_detail_tab_changed',
      expect.objectContaining({ business_id: 'biz_001', tab: 'precio' }),
    );
  });

  it('dispara sub_tab_switched con parent=comercio al cambiar chip', () => {
    render(<BusinessDetailScreen business={business as never} />);
    fireEvent.click(screen.getByText('Opiniones'));
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'sub_tab_switched',
      expect.objectContaining({ parent: 'comercio', tab: 'opiniones' }),
    );
  });

  describe('chip focus', () => {
    it('al montar sin initialTab, el primer chip NO recibe focus automáticamente', () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      render(<BusinessDetailScreen business={business as never} />);
      // Ningún chip (role=tab) debería haberse focado durante el mount.
      const tabFocusCalls = focusSpy.mock.instances.filter(
        (inst) => inst instanceof HTMLElement && inst.getAttribute('role') === 'tab',
      );
      expect(tabFocusCalls.length).toBe(0);
      focusSpy.mockRestore();
    });

    it('click en un chip dispara focus() sobre ese chip', () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      render(<BusinessDetailScreen business={business as never} />);
      const precioChip = screen.getByText('Precio').closest('[role="tab"]') as HTMLElement;
      fireEvent.click(precioChip);
      expect(focusSpy).toHaveBeenCalled();
      // Al menos una de las invocaciones fue sobre el chip role=tab con label Precio.
      const focusedOnPrecio = focusSpy.mock.instances.some(
        (inst) => inst instanceof HTMLElement
          && inst.getAttribute('role') === 'tab'
          && inst.textContent === 'Precio',
      );
      expect(focusedOnPrecio).toBe(true);
      focusSpy.mockRestore();
    });

    it('ArrowRight sobre el chip activo dispara focus() sobre el siguiente', () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      render(<BusinessDetailScreen business={business as never} />);
      const criteriosChip = screen.getByText('Criterios').closest('[role="tab"]') as HTMLElement;
      fireEvent.keyDown(criteriosChip, { key: 'ArrowRight' });
      const focusedOnPrecio = focusSpy.mock.instances.some(
        (inst) => inst instanceof HTMLElement
          && inst.getAttribute('role') === 'tab'
          && inst.textContent === 'Precio',
      );
      expect(focusedOnPrecio).toBe(true);
      focusSpy.mockRestore();
    });

    it('Home lleva el foco al primer chip', () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      render(<BusinessDetailScreen business={business as never} initialTab="opiniones" />);
      const opinionesChip = screen.getByText('Opiniones').closest('[role="tab"]') as HTMLElement;
      focusSpy.mockClear();
      fireEvent.keyDown(opinionesChip, { key: 'Home' });
      const focusedOnCriterios = focusSpy.mock.instances.some(
        (inst) => inst instanceof HTMLElement
          && inst.getAttribute('role') === 'tab'
          && inst.textContent === 'Criterios',
      );
      expect(focusedOnCriterios).toBe(true);
      focusSpy.mockRestore();
    });

    it('End lleva el foco al último chip', () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      render(<BusinessDetailScreen business={business as never} />);
      const criteriosChip = screen.getByText('Criterios').closest('[role="tab"]') as HTMLElement;
      focusSpy.mockClear();
      fireEvent.keyDown(criteriosChip, { key: 'End' });
      const focusedOnOpiniones = focusSpy.mock.instances.some(
        (inst) => inst instanceof HTMLElement
          && inst.getAttribute('role') === 'tab'
          && inst.textContent === 'Opiniones',
      );
      expect(focusedOnOpiniones).toBe(true);
      focusSpy.mockRestore();
    });
  });

  it('offline con error: muestra el header y los chips (no BusinessNotFound)', () => {
    mocks.isOffline = true;
    mocks.dataError = true;
    render(<BusinessDetailScreen business={business as never} />);
    expect(screen.getByText('header')).toBeInTheDocument();
    expect(screen.getByText('Criterios')).toBeInTheDocument();
    expect(screen.queryByText(/not-found/)).not.toBeInTheDocument();
  });

  it('online con error: muestra DetailError con botón Reintentar', () => {
    mocks.isOffline = false;
    mocks.dataError = true;
    render(<BusinessDetailScreen business={business as never} />);
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.queryByText('header')).not.toBeInTheDocument();
  });
});
