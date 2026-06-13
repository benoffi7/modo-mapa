import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { uid: 'me' } as { uid: string } | null,
  isOffline: false,
  trackEvent: vi.fn(),
  markAllRead: vi.fn().mockResolvedValue(undefined),
  markRead: vi.fn().mockResolvedValue(undefined),
  items: [] as Array<{ id: string; businessId: string; businessName: string; senderName: string; senderId: string; read: boolean; createdAt: Date }>,
  reload: vi.fn(),
  loadMore: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));

vi.mock('../../hooks/useSortLocation', () => ({
  useSortLocation: () => ({ lat: 0, lng: 0 }),
}));

vi.mock('../../hooks/useTabRefresh', () => ({
  useSocialSubTabRefresh: vi.fn(),
}));

vi.mock('../../hooks/usePaginatedQuery', () => ({
  usePaginatedQuery: () => ({
    items: mocks.items,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    hasMore: false,
    loadMore: mocks.loadMore,
    reload: mocks.reload,
  }),
}));

vi.mock('../../services/recommendations', () => ({
  getRecommendationsCollection: () => ({}),
  getReceivedRecommendationsConstraints: () => [],
  markRecommendationAsRead: (...args: unknown[]) => mocks.markRead(...args),
  markAllRecommendationsAsRead: (...args: unknown[]) => mocks.markAllRead(...args),
}));

vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mocks.trackEvent(...args),
}));

vi.mock('../common/PullToRefreshWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/PaginatedListShell', () => ({
  PaginatedListShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../utils/businessMap', () => ({
  getBusinessById: () => ({ id: 'b1', name: 'Café', category: 'cafe', lat: 0, lng: 0 }),
}));

import ReceivedRecommendations from './ReceivedRecommendations';

describe('ReceivedRecommendations — #340 W5: trackEvent viewed no inflado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { uid: 'me' };
    mocks.isOffline = false;
    mocks.items = [];
  });

  const countViewed = () =>
    mocks.trackEvent.mock.calls.filter((c) => c[0] === 'recommendation_list_viewed').length;

  it('emite recommendation_list_viewed UNA sola vez al montar', () => {
    render(<ReceivedRecommendations onSelectBusiness={vi.fn()} />);
    expect(countViewed()).toBe(1);
  });

  it('NO re-emite el evento "viewed" cuando cambia isOffline', () => {
    const { rerender } = render(<ReceivedRecommendations onSelectBusiness={vi.fn()} />);
    expect(countViewed()).toBe(1);

    // online → offline → online: el evento "viewed" NO debe volver a dispararse.
    mocks.isOffline = true;
    rerender(<ReceivedRecommendations onSelectBusiness={vi.fn()} />);
    mocks.isOffline = false;
    rerender(<ReceivedRecommendations onSelectBusiness={vi.fn()} />);

    expect(countViewed()).toBe(1);
  });

  it('markAllRead corre online y se omite offline', () => {
    mocks.isOffline = true;
    render(<ReceivedRecommendations onSelectBusiness={vi.fn()} />);
    expect(mocks.markAllRead).not.toHaveBeenCalled();
  });

  it('markAllRead corre cuando está online', () => {
    mocks.isOffline = false;
    render(<ReceivedRecommendations onSelectBusiness={vi.fn()} />);
    expect(mocks.markAllRead).toHaveBeenCalledWith('me');
  });
});
