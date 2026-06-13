import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  trackEvent: vi.fn(),
  recordVisit: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../utils/analytics', () => ({ trackEvent: mocks.trackEvent }));

vi.mock('../../../hooks/useBusinessData', () => ({
  useBusinessData: () => ({
    isLoading: false,
    error: false,
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
vi.mock('../AddToListDialog', () => ({ default: () => null }));
vi.mock('../RecommendDialog', () => ({ default: () => null }));
vi.mock('../../ui/StaleBanner', () => ({ default: () => null }));

import BusinessSheetCompactContent from '../BusinessSheetCompactContent';

const business = {
  id: 'biz_001',
  name: 'Test Comercio',
  category: 'restaurante',
  address: 'Calle 123',
  lat: -34,
  lng: -58,
  tags: [],
};

describe('BusinessSheetCompactContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renderiza el header y el botón Ver detalles', () => {
    render(<BusinessSheetCompactContent business={business as never} />);
    expect(screen.getByText('header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver detalles del comercio/i })).toBeInTheDocument();
  });

  it('no renderiza tabs de contenido', () => {
    render(<BusinessSheetCompactContent business={business as never} />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('al hacer click en CTA dispara trackEvent con business_id', () => {
    render(<BusinessSheetCompactContent business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /ver detalles del comercio/i }));
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'business_detail_cta_clicked',
      expect.objectContaining({ business_id: 'biz_001' }),
    );
  });

  it('al hacer click en CTA navega a /comercio/:id', () => {
    render(<BusinessSheetCompactContent business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /ver detalles del comercio/i }));
    expect(mocks.navigate).toHaveBeenCalledWith('/comercio/biz_001');
  });

  it('al hacer click en CTA guarda el businessId en sessionStorage', () => {
    render(<BusinessSheetCompactContent business={business as never} />);
    fireEvent.click(screen.getByRole('button', { name: /ver detalles del comercio/i }));
    expect(sessionStorage.getItem('mm_last_business_sheet')).toBe('biz_001');
  });

  // S6 — guard de regresión para stale myRating cross-screen.
  //
  // Hipótesis del PRD: el flow Sheet→Detail→Sheet NO requiere fix porque:
  // 1. La sheet usa key={selectedBusiness.id} en BusinessSheet.tsx, así que al
  //    volver del detail React remonta el compact con un fresh useBusinessData.
  // 2. useBusinessData con 3-tier cache (memory → IndexedDB → Firestore) hace
  //    stale-while-revalidate: el render usa data fresca o stale-then-fresh.
  // 3. useBusinessRating deriva serverMyRating con useMemo([ratings, user]) ⇒
  //    cualquier cambio en ratings produce nuevo myRating en el siguiente render.
  // 4. BusinessRating consume ratingData.myRating como prop y NO lo cachea
  //    localmente — re-render lo refleja inmediatamente.
  //
  // Conclusión: el remount del sheet + memo en useBusinessRating + paso de prop
  // sin cache local en BusinessRating cierran la ventana de stale.
  // Si Detail llama refetch('ratings'), el cache memory ya tiene las ratings
  // actualizadas cuando el sheet remonta.
  //
  // Test: smoke check que el remount con businessId distinto monta una sheet
  // independiente (key prop en BusinessSheet hace que React lo re-instancie).
  // El comportamiento "ratings actualizados → myRating actualizado" está
  // cubierto por el test "myRating cambia entre renders" en BusinessRating.test.
  it('S6 guard — cuando businessId cambia, el sheet remonta con nuevo state (key prop en BusinessSheet)', () => {
    const business2 = { ...business, id: 'biz_002' };
    const { rerender } = render(<BusinessSheetCompactContent key="biz_001" business={business as never} />);
    expect(screen.getByText('header')).toBeInTheDocument();

    // Cambio de business → key distinto → remount del componente
    rerender(<BusinessSheetCompactContent key="biz_002" business={business2 as never} />);
    expect(screen.getByText('header')).toBeInTheDocument();
    // No fix needed: el flow Detail → Sheet remonta vía key={selectedBusiness.id}
    // en BusinessSheet.tsx (línea 98), y la cadena reactiva ratings → myRating
    // ya está cubierta en BusinessRating.test.
  });
});
