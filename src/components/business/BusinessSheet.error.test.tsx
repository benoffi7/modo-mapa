import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/useBusinessData', () => ({
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

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, displayName: null }),
}));

vi.mock('../../context/SelectionContext', () => ({
  useSelection: () => ({
    selectedBusiness: { id: 'biz_001', name: 'Test Business', category: 'restaurant', lat: 0, lng: 0, tags: [] },
    setSelectedBusiness: vi.fn(),
  }),
}));

vi.mock('../../context/BusinessScopeContext', () => ({
  BusinessScopeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../hooks/useBusinessRating', () => ({
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

vi.mock('../../hooks/useVisitHistory', () => ({
  useVisitHistory: () => ({ recordVisit: vi.fn() }),
}));

vi.mock('../../hooks/useTrending', () => ({
  useTrending: () => ({ data: null }),
}));

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('./BusinessSheetSkeleton', () => ({ default: () => <div>skeleton</div> }));
vi.mock('./BusinessSheetHeader', () => ({ default: () => <div>header</div> }));
vi.mock('./FavoriteButton', () => ({ default: () => <div>fav</div> }));
vi.mock('./ShareButton', () => ({ default: () => <div>share</div> }));
vi.mock('./AddToListDialog', () => ({ default: () => null }));
vi.mock('./RecommendDialog', () => ({ default: () => null }));
vi.mock('../ui/StaleBanner', () => ({ default: () => null }));

import BusinessSheet from './BusinessSheet';

describe('BusinessSheet', () => {
  beforeEach(() => {
    localStorage.setItem('dragHandleSeen', '1');
  });

  it('renderiza el header del comercio cuando hay selectedBusiness', () => {
    render(<BusinessSheet />);
    expect(screen.getByText('header')).toBeInTheDocument();
  });

  it('renderiza el botón Ver detalles', () => {
    render(<BusinessSheet />);
    expect(screen.getByRole('button', { name: /ver detalles del comercio/i })).toBeInTheDocument();
  });

  it('no renderiza tabs de contenido', () => {
    render(<BusinessSheet />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
