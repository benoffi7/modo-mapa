import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  reload: vi.fn(),
  loadMore: vi.fn(),
  trackEvent: vi.fn(),
  useSocialSubTabRefresh: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'me' } }),
}));

vi.mock('../../hooks/useActivityFeed', () => ({
  useActivityFeed: () => ({
    items: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    hasMore: false,
    loadMore: mocks.loadMore,
    reload: mocks.reload,
  }),
}));

vi.mock('../../hooks/useTabRefresh', () => ({
  useSocialSubTabRefresh: mocks.useSocialSubTabRefresh,
}));

vi.mock('../../utils/analytics', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../common/PullToRefreshWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ActivityFeedView } from './ActivityFeedView';

describe('ActivityFeedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reload se llama exactamente una vez en mount', () => {
    render(<ActivityFeedView onBusinessClick={vi.fn()} />);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('trackEvent(EVT_FEED_VIEWED) se llama una vez en mount', () => {
    render(<ActivityFeedView onBusinessClick={vi.fn()} />);
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackEvent).toHaveBeenCalledWith('feed_viewed');
  });

  it('re-render NO redispara reload', () => {
    const { rerender } = render(<ActivityFeedView onBusinessClick={vi.fn()} />);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    rerender(<ActivityFeedView onBusinessClick={vi.fn()} />);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('useSocialSubTabRefresh se registra con la callback reload (identidad-actual)', () => {
    render(<ActivityFeedView onBusinessClick={vi.fn()} />);
    expect(mocks.useSocialSubTabRefresh).toHaveBeenCalledWith('actividad', mocks.reload);
  });
});
