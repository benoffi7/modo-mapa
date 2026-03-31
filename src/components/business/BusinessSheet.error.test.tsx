import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRefetch = vi.fn();

vi.mock('../../hooks/useBusinessData', () => ({
  useBusinessData: () => ({
    isLoading: false,
    error: true,
    refetch: mockRefetch,
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
    selectedBusiness: { id: 'biz-1', name: 'Test Business', category: 'restaurant', lat: 0, lng: 0, tags: [] },
    setSelectedBusiness: vi.fn(),
    selectedBusinessTab: null,
    setSelectedBusinessTab: vi.fn(),
  }),
}));

vi.mock('../../hooks/useBusinessRating', () => ({
  useBusinessRating: () => ({
    averageRating: 0,
    totalRatings: 0,
    myRating: null,
    handleRate: vi.fn(),
    handleDeleteRating: vi.fn(),
  }),
}));

vi.mock('../../hooks/useVisitHistory', () => ({
  useVisitHistory: () => ({ recordVisit: vi.fn() }),
}));

vi.mock('../../hooks/useTrending', () => ({
  useTrending: () => ({ data: null }),
}));

vi.mock('../../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({ confirmClose: (fn: () => void) => fn(), dialogProps: {} }),
}));

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

vi.mock('./BusinessSheetSkeleton', () => ({ default: () => <div>skeleton</div> }));
vi.mock('./BusinessSheetHeader', () => ({ default: () => <div>header</div> }));
vi.mock('./InfoTab', () => ({ default: () => <div>info</div> }));
vi.mock('./OpinionesTab', () => ({ default: () => <div>opiniones</div> }));
vi.mock('./FavoriteButton', () => ({ default: () => <div>fav</div> }));
vi.mock('./ShareButton', () => ({ default: () => <div>share</div> }));
vi.mock('./CheckInButton', () => ({ default: () => <div>checkin</div> }));
vi.mock('./AddToListDialog', () => ({ default: () => null }));
vi.mock('./RecommendDialog', () => ({ default: () => null }));
vi.mock('../ui/StaleBanner', () => ({ default: () => null }));
vi.mock('../common/DiscardDialog', () => ({ default: () => null }));

import BusinessSheet from './BusinessSheet';

describe('BusinessSheet error state', () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    localStorage.setItem('drag_handle_seen', '1');
  });

  it('renderiza el mensaje de error cuando useBusinessData devuelve error: true', () => {
    render(<BusinessSheet />);
    expect(screen.getByText(/No se pudo cargar la información del comercio/)).toBeInTheDocument();
  });

  it('no renderiza el skeleton cuando isLoading es false y error es true', () => {
    render(<BusinessSheet />);
    expect(screen.queryByText('skeleton')).not.toBeInTheDocument();
  });

  it('el botón Reintentar llama a data.refetch', () => {
    render(<BusinessSheet />);
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
