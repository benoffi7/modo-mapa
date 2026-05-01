import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { uid: 'me' } as { uid: string } | null,
  isOffline: false,
  rawItems: [] as Array<{ businessId: string; createdAt: Date }>,
  reload: vi.fn(),
  loadMore: vi.fn(),
  isLoading: false,
  error: null as string | null,
  hasMore: false,
  isLoadingMore: false,
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  removeFavorite: vi.fn(),
  withOfflineSupport: vi.fn(),
  getBusinessById: vi.fn((id: string) => ({
    id,
    name: id === 'biz1' ? 'Café Luna' : 'Bar Sol',
    category: 'cafe',
    address: 'Calle 1',
    lat: 0,
    lng: 0,
    tags: [],
  })),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => mocks.toast,
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));

vi.mock('../../hooks/useSortLocation', () => ({
  useSortLocation: () => ({ lat: 0, lng: 0, hasUserLocation: false, isOfficeFallback: true }),
}));

vi.mock('../../hooks/useListFilters', () => ({
  useListFilters: <T,>(items: T[]) => ({
    filtered: items,
    total: items.length,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    categoryFilter: 'all',
    setCategoryFilter: vi.fn(),
    sortBy: 'date-desc',
    setSortBy: vi.fn(),
  }),
}));

vi.mock('../../hooks/usePaginatedQuery', () => ({
  usePaginatedQuery: () => ({
    items: mocks.rawItems,
    isLoading: mocks.isLoading,
    error: mocks.error,
    hasMore: mocks.hasMore,
    isLoadingMore: mocks.isLoadingMore,
    loadMore: mocks.loadMore,
    reload: mocks.reload,
  }),
}));

vi.mock('../../hooks/useTabRefresh', () => ({
  useListsSubTabRefresh: vi.fn(),
}));

vi.mock('../../utils/businessMap', () => ({
  getBusinessById: (id: string) => mocks.getBusinessById(id),
}));

vi.mock('../../services/favorites', () => ({
  removeFavorite: mocks.removeFavorite,
  getFavoritesCollection: () => ({}),
}));

vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: (...args: unknown[]) => mocks.withOfflineSupport(...args),
}));

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../common/PullToRefreshWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/ListFilters', () => ({
  default: () => <div>ListFilters</div>,
}));

vi.mock('../business/AddToListDialog', () => ({
  default: () => null,
}));

import FavoritesList from './FavoritesList';

const fakeBusiness = (id: string, name: string) => ({
  id,
  name,
  category: 'cafe',
  address: 'Calle 1',
  lat: 0,
  lng: 0,
  tags: [],
});

describe('FavoritesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { uid: 'me' };
    mocks.isOffline = false;
    mocks.rawItems = [];
    mocks.isLoading = false;
    mocks.error = null;
    mocks.hasMore = false;
    mocks.isLoadingMore = false;
    mocks.getBusinessById.mockImplementation((id: string) => fakeBusiness(id, id === 'biz1' ? 'Café Luna' : 'Bar Sol'));
  });

  it('cuando hay favoritos, las cards tienen role=button + tabIndex + aria-label', () => {
    mocks.rawItems = [{ businessId: 'biz1', createdAt: new Date() }];
    render(<FavoritesList onSelectBusiness={vi.fn()} />);
    const card = screen.getByRole('button', { name: /abrir comercio: café luna/i });
    expect(card).toBeInTheDocument();
    expect(card.getAttribute('tabIndex')).toBe('0');
  });

  it('Click en la card llama onSelectBusiness con el business', () => {
    mocks.rawItems = [{ businessId: 'biz1', createdAt: new Date() }];
    const onSelect = vi.fn();
    render(<FavoritesList onSelectBusiness={onSelect} />);
    const card = screen.getByRole('button', { name: /abrir comercio: café luna/i });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'biz1' }));
  });

  it('Enter en la card focuseada dispara onSelectBusiness', () => {
    mocks.rawItems = [{ businessId: 'biz1', createdAt: new Date() }];
    const onSelect = vi.fn();
    render(<FavoritesList onSelectBusiness={onSelect} />);
    const card = screen.getByRole('button', { name: /abrir comercio: café luna/i });
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'biz1' }));
  });

  it('Space en la card focuseada dispara onSelectBusiness', () => {
    mocks.rawItems = [{ businessId: 'biz1', createdAt: new Date() }];
    const onSelect = vi.fn();
    render(<FavoritesList onSelectBusiness={onSelect} />);
    const card = screen.getByRole('button', { name: /abrir comercio: café luna/i });
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('Click en el IconButton kebab NO dispara onSelectBusiness (stopPropagation)', () => {
    mocks.rawItems = [{ businessId: 'biz1', createdAt: new Date() }];
    const onSelect = vi.fn();
    render(<FavoritesList onSelectBusiness={onSelect} />);
    const kebab = screen.getByRole('button', { name: /opciones/i });
    fireEvent.click(kebab);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Empty state: cuando no hay favoritos muestra el placeholder', () => {
    mocks.rawItems = [];
    render(<FavoritesList onSelectBusiness={vi.fn()} />);
    expect(screen.getByText(/no tenés favoritos todavía/i)).toBeInTheDocument();
  });

  it('Loading state', () => {
    mocks.isLoading = true;
    render(<FavoritesList onSelectBusiness={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('Error state con botón Reintentar', () => {
    mocks.error = 'fail';
    render(<FavoritesList onSelectBusiness={vi.fn()} />);
    expect(screen.getByText(/no se pudieron cargar los favoritos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
