import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SharedList, ListItem as ListItemType } from '../../../types';

// ── Mocks ───────────────────────────────────────────────────────────────

const mockFetchPublicLists = vi.hoisted(() => vi.fn());
const mockToggleFeaturedList = vi.hoisted(() => vi.fn());
vi.mock('../../../services/adminFeatured', () => ({
  fetchPublicLists: (...args: unknown[]) => mockFetchPublicLists(...args),
  toggleFeaturedList: (...args: unknown[]) => mockToggleFeaturedList(...args),
}));

const mockFetchListItems = vi.hoisted(() => vi.fn());
vi.mock('../../../services/sharedLists', () => ({
  fetchListItems: (...args: unknown[]) => mockFetchListItems(...args),
}));

const mockAdminDeleteListItem = vi.hoisted(() => vi.fn());
vi.mock('../../../services/admin', () => ({
  adminDeleteListItem: (...args: unknown[]) => mockAdminDeleteListItem(...args),
}));

const mockFetchUserDisplayNames = vi.hoisted(() => vi.fn());
vi.mock('../../../services/users', () => ({
  fetchUserDisplayNames: (...args: unknown[]) => mockFetchUserDisplayNames(...args),
}));

const mockTrackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('../../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

let isOfflineMock = false;
vi.mock('../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: isOfflineMock }),
}));

const loggerWarn = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/logger', () => ({
  logger: { warn: loggerWarn, error: loggerError, log: vi.fn() },
}));

vi.mock('../ListStatsSection', () => ({
  default: () => null,
}));

vi.mock('../../../utils/businessMap', () => ({
  getBusinessById: (id: string) => ({
    id,
    name: `Business ${id}`,
    category: 'cafeteria',
    address: 'Calle 123',
  }),
}));

vi.mock('../../../constants/business', () => ({
  CATEGORY_LABELS: { cafeteria: 'Cafetería' },
}));

import FeaturedListsPanel from '../FeaturedListsPanel';

const baseList: SharedList = {
  id: 'list-1',
  ownerId: 'owner-uid-12345',
  name: 'Test List',
  description: '',
  isPublic: true,
  featured: false,
  editorIds: [],
  itemCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseItem: ListItemType = {
  id: 'item-1',
  listId: 'list-1',
  businessId: 'biz-1',
  addedBy: 'owner-uid-12345',
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  isOfflineMock = false;
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockToast.info.mockClear();
  mockFetchUserDisplayNames.mockResolvedValue(new Map());
  mockFetchListItems.mockResolvedValue([baseItem]);
});

describe('FeaturedListsPanel — base', () => {
  it('renders public lists from fetchPublicLists', async () => {
    mockFetchPublicLists.mockResolvedValueOnce([baseList]);
    render(<FeaturedListsPanel />);
    expect(await screen.findByText('Test List')).toBeInTheDocument();
  });

  it('renders empty state when no lists', async () => {
    mockFetchPublicLists.mockResolvedValueOnce([]);
    render(<FeaturedListsPanel />);
    expect(await screen.findByText('No hay listas públicas.')).toBeInTheDocument();
  });

  it('logs a warn (no console.error) when fetchListItems fails', async () => {
    mockFetchPublicLists.mockResolvedValueOnce([baseList]);
    mockFetchListItems.mockRejectedValueOnce(new Error('network error'));

    render(<FeaturedListsPanel />);
    const row = await screen.findByText('Test List');

    fireEvent.click(row);

    await waitFor(() => {
      expect(loggerWarn).toHaveBeenCalledWith(
        'FeaturedListsPanel fetchListItems failed',
        expect.any(Error),
      );
    });
  });
});

describe('FeaturedListsPanel — analytics + truncado + displayNames', () => {
  it('emits admin_list_items_inspected once per listId per mount', async () => {
    mockFetchPublicLists.mockResolvedValueOnce([baseList]);
    mockFetchListItems.mockResolvedValue([baseItem]);
    render(<FeaturedListsPanel />);
    const row = await screen.findByText('Test List');

    // Expand
    fireEvent.click(row);
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'admin_list_items_inspected',
        { listId: 'list-1', itemCount: 1 },
      );
    });

    // Collapse and re-expand → should NOT re-emit
    fireEvent.click(row);
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByText('Business biz-1')).toBeInTheDocument();
    });
    const inspectCalls = mockTrackEvent.mock.calls.filter(
      (c) => c[0] === 'admin_list_items_inspected',
    );
    expect(inspectCalls).toHaveLength(1);
  });

  it('truncates items to 50 and shows "Mostrando 50 de N" helper', async () => {
    const manyItems: ListItemType[] = Array.from({ length: 65 }, (_, i) => ({
      id: `item-${i}`,
      listId: 'list-1',
      businessId: 'biz-1',
      addedBy: 'owner-uid-12345',
      createdAt: new Date(),
    }));
    mockFetchPublicLists.mockResolvedValueOnce([{ ...baseList, itemCount: 65 }]);
    mockFetchListItems.mockResolvedValueOnce(manyItems);

    render(<FeaturedListsPanel />);
    fireEvent.click(await screen.findByText('Test List'));

    await waitFor(() => {
      expect(screen.getByText(/Mostrando 50 de 65/)).toBeInTheDocument();
    });
    // analytics should report the REAL count
    const inspectCall = mockTrackEvent.mock.calls.find(
      (c) => c[0] === 'admin_list_items_inspected',
    );
    expect(inspectCall?.[1]).toEqual({ listId: 'list-1', itemCount: 65 });
  });

  it('resolves addedBy via fetchUserDisplayNames and renders Owner chip', async () => {
    mockFetchPublicLists.mockResolvedValueOnce([baseList]);
    mockFetchListItems.mockResolvedValueOnce([baseItem]);
    mockFetchUserDisplayNames.mockResolvedValueOnce(
      new Map([['owner-uid-12345', 'Walter']]),
    );

    render(<FeaturedListsPanel />);
    fireEvent.click(await screen.findByText('Test List'));

    await waitFor(() => {
      expect(mockFetchUserDisplayNames).toHaveBeenCalledWith(['owner-uid-12345']);
    });
    expect(await screen.findByText(/Walter \(Owner\)/)).toBeInTheDocument();
  });

  it('shows Editor chip when addedBy !== ownerId', async () => {
    const editorItem: ListItemType = {
      id: 'item-2',
      listId: 'list-1',
      businessId: 'biz-1',
      addedBy: 'editor-uid-987',
      createdAt: new Date(),
    };
    mockFetchPublicLists.mockResolvedValueOnce([baseList]);
    mockFetchListItems.mockResolvedValueOnce([editorItem]);
    mockFetchUserDisplayNames.mockResolvedValueOnce(
      new Map([['editor-uid-987', 'Eddy']]),
    );

    render(<FeaturedListsPanel />);
    fireEvent.click(await screen.findByText('Test List'));

    expect(await screen.findByText(/Eddy \(Editor\)/)).toBeInTheDocument();
  });

  it('does not render "Mostrando 50 de N" when items <= 50', async () => {
    mockFetchPublicLists.mockResolvedValueOnce([baseList]);
    mockFetchListItems.mockResolvedValueOnce([baseItem]);
    render(<FeaturedListsPanel />);
    fireEvent.click(await screen.findByText('Test List'));
    await screen.findByText('Business biz-1');
    expect(screen.queryByText(/Mostrando 50/)).toBeNull();
  });
});
