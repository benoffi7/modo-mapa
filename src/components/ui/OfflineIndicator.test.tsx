import { render, screen } from '@testing-library/react';
import { OfflineIndicator } from './OfflineIndicator';
import * as useConnectivityModule from '../../hooks/useConnectivity';
import { MSG_OFFLINE } from '../../constants/messages';
import { vi } from 'vitest';

function mockConnectivity(overrides: Partial<ReturnType<typeof useConnectivityModule.useConnectivity>> = {}) {
  vi.spyOn(useConnectivityModule, 'useConnectivity').mockReturnValue({
    isOffline: false,
    isSyncing: false,
    pendingActionsCount: 0,
    pendingActions: [],
    discardAction: vi.fn(),
    retryFailed: vi.fn(),
    ...overrides,
  });
}

describe('OfflineIndicator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows nothing when online and not syncing', () => {
    mockConnectivity();
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Sin conexión" when offline with no pending', () => {
    mockConnectivity({ isOffline: true });
    render(<OfflineIndicator />);
    expect(screen.getByText(MSG_OFFLINE.noConnection)).toBeInTheDocument();
  });

  it('shows pending count when offline with actions', () => {
    mockConnectivity({ isOffline: true, pendingActionsCount: 3 });
    render(<OfflineIndicator />);
    expect(screen.getByText(MSG_OFFLINE.noConnectionPending(3))).toBeInTheDocument();
  });

  it('shows singular form for 1 pending', () => {
    mockConnectivity({ isOffline: true, pendingActionsCount: 1 });
    render(<OfflineIndicator />);
    expect(screen.getByText(MSG_OFFLINE.noConnectionPending(1))).toBeInTheDocument();
  });

  it('shows "Sincronizando..." when syncing', () => {
    mockConnectivity({ isSyncing: true });
    render(<OfflineIndicator />);
    expect(screen.getByText('Sincronizando...')).toBeInTheDocument();
  });
});
