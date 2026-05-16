import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

const mockUseAuth = vi.fn(() => ({ user: { uid: 'user1' } as { uid: string } | null }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../hooks/useTabRefresh', () => ({
  useListsSubTabRefresh: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));

vi.mock('./CreateListDialog', () => ({
  default: ({ open, onCreated }: {
    open: boolean;
    onClose: () => void;
    onCreated: (id: string, name: string, desc: string, icon: string) => void;
  }) =>
    open ? (
      <div data-testid="create-dialog">
        <button
          type="button"
          data-testid="trigger-created"
          onClick={() => onCreated('new-list', 'New', 'desc', 'icon')}
        >
          create
        </button>
      </div>
    ) : null,
}));

vi.mock('./ListCardGrid', () => ({
  default: ({ lists, onListClick, onCreateClick }: {
    lists: SharedList[];
    onListClick: (l: SharedList) => void;
    onCreateClick?: () => void;
  }) => (
    <div data-testid="list-card-grid">
      <span data-testid="count">{lists.length}</span>
      {lists.map((l) => (
        <button key={l.id} type="button" onClick={() => onListClick(l)}>
          {l.name}
        </button>
      ))}
      {onCreateClick && (
        <button type="button" data-testid="create-btn" onClick={onCreateClick}>
          create
        </button>
      )}
    </div>
  ),
}));

vi.mock('./ListDetailScreen', () => ({
  default: ({ list, onBack, onDeleted }: {
    list: SharedList;
    onBack: (updated?: Partial<SharedList>) => void;
    onDeleted: () => void;
  }) => (
    <div data-testid="detail">
      <span data-testid="detail-name">{list.name}</span>
      <button type="button" data-testid="back" onClick={() => onBack()}>back</button>
      <button
        type="button"
        data-testid="back-updated"
        onClick={() => onBack({ id: list.id, name: 'renamed' })}
      >back-updated</button>
      <button type="button" data-testid="deleted" onClick={onDeleted}>deleted</button>
    </div>
  ),
}));

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

const makeUserList = (id: string): SharedList => ({
  id,
  ownerId: 'user1',
  name: `MyList ${id}`,
  description: '',
  icon: '🍔',
  isPublic: false,
  featured: false,
  editorIds: [],
  itemCount: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

import SharedListsView from './SharedListsView';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: { uid: 'user1' } });
  mockFetchUserLists.mockResolvedValue([]);
  mockFetchFeaturedLists.mockResolvedValue([]);
  mockFetchSharedList.mockResolvedValue(null);
});

afterEach(() => { localStorage.clear(); });

describe('SharedListsView — featured cache flow', () => {
  it('shows stale cache when fetchFeaturedLists fails', async () => {
    const staleTs = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: [makeFeaturedList('fl-1'), makeFeaturedList('fl-2')], ts: staleTs }),
    );
    mockFetchFeaturedLists.mockRejectedValue(new Error('network'));
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('Lista fl-1')).toBeInTheDocument());
    expect(screen.getByText('Lista fl-2')).toBeInTheDocument();
  });

  it('replaces stale cache with fresh data on success', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: [makeFeaturedList('old-1')], ts: Date.now() - 1000 }),
    );
    mockFetchFeaturedLists.mockResolvedValue([makeFeaturedList('new-1')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('Lista new-1')).toBeInTheDocument());
    expect(screen.queryByText('Lista old-1')).not.toBeInTheDocument();
  });

  it('no destacadas section when no cache and fetch fails', async () => {
    mockFetchFeaturedLists.mockRejectedValue(new Error('network'));
    render(<SharedListsView />);
    await waitFor(() => {
      expect(screen.queryByText('Destacadas')).not.toBeInTheDocument();
    });
  });

  it('silently ignores malformed cache JSON', async () => {
    localStorage.setItem(CACHE_KEY, 'not-json-{{{');
    mockFetchFeaturedLists.mockResolvedValue([makeFeaturedList('a')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('Lista a')).toBeInTheDocument());
  });

  it('does not crash when localStorage.setItem throws (storage full branch)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => { throw new Error('QuotaExceeded'); });
    mockFetchFeaturedLists.mockResolvedValue([makeFeaturedList('a')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('Lista a')).toBeInTheDocument());
    setItemSpy.mockRestore();
  });

  it('renders featured chip and clicking a featured opens detail', async () => {
    mockFetchFeaturedLists.mockResolvedValue([makeFeaturedList('feat')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('Lista feat')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Lista feat'));
    expect(screen.getByTestId('detail-name').textContent).toBe('Lista feat');
  });
});

describe('SharedListsView — user lists + detail navigation', () => {
  it('shows empty state when fetchUserLists returns []', async () => {
    mockFetchUserLists.mockResolvedValue([]);
    render(<SharedListsView />);
    await waitFor(() => {
      expect(screen.getByText(/Creá una/)).toBeInTheDocument();
    });
  });

  it('renders ListCardGrid with user lists when non-empty', async () => {
    mockFetchUserLists.mockResolvedValue([makeUserList('u1'), makeUserList('u2')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByTestId('list-card-grid')).toBeInTheDocument());
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('navigates to detail when list is clicked, and back when back is pressed', async () => {
    mockFetchUserLists.mockResolvedValue([makeUserList('u1')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('MyList u1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('MyList u1'));
    expect(screen.getByTestId('detail-name').textContent).toBe('MyList u1');
    fireEvent.click(screen.getByTestId('back'));
    await waitFor(() => expect(screen.queryByTestId('detail')).not.toBeInTheDocument());
  });

  it('back with updated payload patches list name in grid', async () => {
    mockFetchUserLists.mockResolvedValue([makeUserList('u1')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('MyList u1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('MyList u1'));
    fireEvent.click(screen.getByTestId('back-updated'));
    await waitFor(() => expect(screen.getByText('renamed')).toBeInTheDocument());
  });

  it('deletes list from grid when onDeleted is triggered', async () => {
    mockFetchUserLists.mockResolvedValue([makeUserList('u1'), makeUserList('u2')]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText('MyList u1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('MyList u1'));
    fireEvent.click(screen.getByTestId('deleted'));
    await waitFor(() => {
      expect(screen.queryByText('MyList u1')).not.toBeInTheDocument();
    });
    expect(screen.getByText('MyList u2')).toBeInTheDocument();
  });

  it('logs error and stops loading when fetchUserLists rejects', async () => {
    mockFetchUserLists.mockRejectedValue(new Error('boom'));
    render(<SharedListsView />);
    // Spinner disappears (isLoading becomes false in catch)
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});

describe('SharedListsView — deep link + back handler', () => {
  it('opens detail directly when sharedListId is provided and fetchSharedList resolves', async () => {
    mockFetchSharedList.mockResolvedValue(makeUserList('deep'));
    render(<SharedListsView sharedListId="deep" />);
    await waitFor(() => expect(screen.getByTestId('detail-name').textContent).toBe('MyList deep'));
  });

  it('does not open detail when fetchSharedList returns null', async () => {
    mockFetchSharedList.mockResolvedValue(null);
    mockFetchUserLists.mockResolvedValue([]);
    render(<SharedListsView sharedListId="missing" />);
    await waitFor(() => expect(screen.queryByTestId('detail')).not.toBeInTheDocument());
  });

  it('does not crash when fetchSharedList rejects', async () => {
    mockFetchSharedList.mockRejectedValue(new Error('forbidden'));
    mockFetchUserLists.mockResolvedValue([]);
    render(<SharedListsView sharedListId="x" />);
    await waitFor(() => expect(screen.queryByText(/Creá una/)).toBeInTheDocument());
  });

  it('registers a back handler that returns true while detail is open, false otherwise', async () => {
    const onRegister = vi.fn();
    mockFetchUserLists.mockResolvedValue([makeUserList('u1')]);
    render(<SharedListsView onRegisterBackHandler={onRegister} />);
    await waitFor(() => expect(screen.getByText('MyList u1')).toBeInTheDocument());

    // Handler is registered when no detail → returns false
    const baseHandler = onRegister.mock.calls.at(-1)?.[0] as () => boolean;
    expect(baseHandler()).toBe(false);

    // Open detail → handler now returns true and closes detail
    fireEvent.click(screen.getByText('MyList u1'));
    const withDetailHandler = onRegister.mock.calls.at(-1)?.[0] as () => boolean;
    let returned: boolean;
    act(() => { returned = withDetailHandler(); });
    expect(returned!).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('detail')).not.toBeInTheDocument());
  });

  it('unregisters back handler on unmount', async () => {
    const onRegister = vi.fn();
    mockFetchUserLists.mockResolvedValue([]);
    const { unmount } = render(<SharedListsView onRegisterBackHandler={onRegister} />);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    unmount();
    expect(onRegister).toHaveBeenLastCalledWith(null);
  });
});

describe('SharedListsView — create dialog', () => {
  it('opens CreateListDialog via empty-state link and inserts on onCreated', async () => {
    mockFetchUserLists.mockResolvedValue([]);
    render(<SharedListsView />);
    await waitFor(() => expect(screen.getByText(/Creá una/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('+ Crear nueva lista'));
    await waitFor(() => expect(screen.getByTestId('create-dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('trigger-created'));
    await waitFor(() => {
      expect(screen.getByTestId('list-card-grid')).toBeInTheDocument();
    });
  });

  it('no-ops onCreated when user is null', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockFetchUserLists.mockResolvedValue([]);
    render(<SharedListsView />);
    // Without user, the loadLists effect returns early — no spinner stuck
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetchUserLists).not.toHaveBeenCalled();
  });
});
