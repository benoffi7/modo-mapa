import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminRateLimitItem } from '../../../../types/admin';

// ── Mocks ───────────────────────────────────────────────────────────────

const mockListAdminRateLimits = vi.hoisted(() => vi.fn());
const mockResetAdminRateLimit = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/admin', () => ({
  listAdminRateLimits: (...args: unknown[]) => mockListAdminRateLimits(...args),
  resetAdminRateLimit: (...args: unknown[]) => mockResetAdminRateLimit(...args),
}));

const mockTrackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

let isOfflineMock = false;
vi.mock('../../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: isOfflineMock }),
}));

import RateLimitsSection from '../RateLimitsSection';

const item: AdminRateLimitItem = {
  docId: 'comments_uid12345678',
  category: 'comments',
  userId: 'uid12345678',
  count: 7,
  resetAt: Date.now() + 60_000,
  windowActive: true,
};

const expiredItem: AdminRateLimitItem = {
  docId: 'sharedLists_uidxxxxxxxx',
  category: 'sharedLists',
  userId: 'uidxxxxxxxx',
  count: 3,
  resetAt: Date.now() - 60_000,
  windowActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockToast.info.mockClear();
  isOfflineMock = false;
});

describe('RateLimitsSection', () => {
  it('renders empty state when no items', async () => {
    mockListAdminRateLimits.mockResolvedValueOnce([]);
    render(<RateLimitsSection />);
    expect(await screen.findByText(/Sin entradas/i)).toBeInTheDocument();
  });

  it('renders rows from listAdminRateLimits', async () => {
    mockListAdminRateLimits.mockResolvedValueOnce([item]);
    render(<RateLimitsSection />);
    expect(await screen.findByText('comments')).toBeInTheDocument();
    expect(screen.getByText('uid12345…')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('emits admin_rate_limit_viewed once on first successful load', async () => {
    mockListAdminRateLimits.mockResolvedValueOnce([item]);
    render(<RateLimitsSection />);
    await screen.findByText('comments');
    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith('admin_rate_limit_viewed'),
    );
    const callsForViewed = mockTrackEvent.mock.calls.filter(
      (c) => c[0] === 'admin_rate_limit_viewed',
    );
    expect(callsForViewed).toHaveLength(1);
  });

  it('does not re-emit admin_rate_limit_viewed on refetch after reset', async () => {
    mockListAdminRateLimits.mockResolvedValue([item]);
    mockResetAdminRateLimit.mockResolvedValueOnce(undefined);
    render(<RateLimitsSection />);
    await screen.findByText('comments');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalled(),
    );

    const callsForViewed = mockTrackEvent.mock.calls.filter(
      (c) => c[0] === 'admin_rate_limit_viewed',
    );
    expect(callsForViewed).toHaveLength(1);
  });

  it('opens dialog with role="alertdialog" when clicking row reset button', async () => {
    mockListAdminRateLimits.mockResolvedValueOnce([item]);
    render(<RateLimitsSection />);
    await screen.findByText('comments');
    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Desbloquea al usuario/)).toBeInTheDocument();
  });

  it('shows housekeeping copy for expired window', async () => {
    mockListAdminRateLimits.mockResolvedValueOnce([expiredItem]);
    render(<RateLimitsSection />);
    await screen.findByText('sharedLists');
    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit/i }));
    expect(await screen.findByText(/ya expiró/)).toBeInTheDocument();
  });

  it('confirms reset → calls resetAdminRateLimit + emits analytics + toast success', async () => {
    mockListAdminRateLimits.mockResolvedValue([item]);
    mockResetAdminRateLimit.mockResolvedValueOnce(undefined);
    render(<RateLimitsSection />);
    await screen.findByText('comments');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => {
      expect(mockResetAdminRateLimit).toHaveBeenCalledWith(item.docId);
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('admin_rate_limit_reset', {
      category: 'comments',
    });
    expect(mockToast.success).toHaveBeenCalledWith('Reseteado correctamente');
  });

  it('maps not-found error to toast.info + refetch', async () => {
    mockListAdminRateLimits.mockResolvedValue([item]);
    const err = Object.assign(new Error('not-found'), { code: 'functions/not-found' });
    mockResetAdminRateLimit.mockRejectedValueOnce(err);
    render(<RateLimitsSection />);
    await screen.findByText('comments');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith(
        'Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla.',
      );
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    // refetch called means listAdminRateLimits was invoked again post-reset
    await waitFor(() => {
      expect(mockListAdminRateLimits).toHaveBeenCalledTimes(2);
    });
  });

  it('shows toast.error on generic error', async () => {
    mockListAdminRateLimits.mockResolvedValue([item]);
    mockResetAdminRateLimit.mockRejectedValueOnce(new Error('unavailable'));
    render(<RateLimitsSection />);
    await screen.findByText('comments');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'No se pudo resetear. Verificá tu sesión admin.',
      );
    });
  });

  it('disables row reset button when offline', async () => {
    isOfflineMock = true;
    mockListAdminRateLimits.mockResolvedValueOnce([item]);
    render(<RateLimitsSection />);
    await screen.findByText('comments');
    const resetBtn = screen.getByRole('button', { name: /Resetear rate limit/i });
    expect(resetBtn).toBeDisabled();
  });

  it('passes userId filter to listAdminRateLimits when input changes', async () => {
    mockListAdminRateLimits.mockResolvedValue([]);
    render(<RateLimitsSection />);
    await waitFor(() => expect(mockListAdminRateLimits).toHaveBeenCalledWith({}));

    const input = screen.getByLabelText('Filtrar por User ID');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'uid-abc' } });
    });

    await waitFor(() => {
      expect(mockListAdminRateLimits).toHaveBeenCalledWith({ userId: 'uid-abc' });
    });
  });
});
