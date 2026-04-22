import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SharedList } from '../../types';

// --- Mocks ---

const mockFetchFeaturedLists = vi.fn();
const mockFetchUserLists = vi.fn();
const mockFetchSharedList = vi.fn();

vi.mock('../../services/sharedLists', () => ({
  fetchFeaturedLists: (...args: unknown[]) => mockFetchFeaturedLists(...args),
  fetchUserLists: (...args: unknown[]) => mockFetchUserLists(...args),
  fetchSharedList: (...args: unknown[]) => mockFetchSharedList(...args),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' } }),
}));

vi.mock('../../hooks/useTabRefresh', () => ({
  useListsSubTabRefresh: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));

vi.mock('./CreateListDialog', () => ({ default: () => null }));
vi.mock('./ListCardGrid', () => ({ default: () => <div data-testid="list-card-grid" /> }));
vi.mock('./ListDetailScreen', () => ({ default: () => <div>detail</div> }));
vi.mock('../common/PullToRefreshWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const CACHE_KEY = 'mm_featured_lists';

const makeFeaturedList = (id: string): SharedList => ({
  id,
  ownerId: 'owner1',
  name: `Lista ${id}`,
  description: '',
  icon: '📋',
  isPublic: true,
  featured: true,
  editorIds: [],
  itemCount: 3,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

import SharedListsView from './SharedListsView';

describe('SharedListsView – stale cache fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchUserLists.mockResolvedValue([]);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows stale cache data when fetchFeaturedLists fails and cache is expired', async () => {
    const staleTs = Date.now() - 25 * 60 * 60 * 1000; // 25h ago — past 24h TTL
    const cachedData: SharedList[] = [makeFeaturedList('fl-1'), makeFeaturedList('fl-2')];
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cachedData, ts: staleTs }));

    mockFetchFeaturedLists.mockRejectedValue(new Error('network error'));

    render(<SharedListsView />);

    await waitFor(() => {
      expect(screen.getByText('Lista fl-1')).toBeInTheDocument();
    });
    expect(screen.getByText('Lista fl-2')).toBeInTheDocument();
  });

  it('replaces stale cache with fresh data when fetch succeeds', async () => {
    const staleTs = Date.now() - 25 * 60 * 60 * 1000;
    const cachedData: SharedList[] = [makeFeaturedList('old-1')];
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cachedData, ts: staleTs }));

    const freshList = makeFeaturedList('new-1');
    mockFetchFeaturedLists.mockResolvedValue([freshList]);

    render(<SharedListsView />);

    await waitFor(() => {
      expect(screen.getByText('Lista new-1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Lista old-1')).not.toBeInTheDocument();
  });

  it('shows empty featured section when no cache and fetch fails', async () => {
    mockFetchFeaturedLists.mockRejectedValue(new Error('network error'));

    render(<SharedListsView />);

    await waitFor(() => {
      expect(screen.queryByText('Destacadas')).not.toBeInTheDocument();
    });
  });
});
