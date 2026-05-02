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
