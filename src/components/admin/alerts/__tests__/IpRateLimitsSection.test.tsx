import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminIpRateLimitItem } from '../../../../types/admin';

// ── Mocks ───────────────────────────────────────────────────────────────

const mockListAdminIpRateLimits = vi.hoisted(() => vi.fn());
const mockResetAdminIpRateLimit = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/admin', () => ({
  listAdminIpRateLimits: (...args: unknown[]) => mockListAdminIpRateLimits(...args),
  resetAdminIpRateLimit: (...args: unknown[]) => mockResetAdminIpRateLimit(...args),
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

import IpRateLimitsSection from '../IpRateLimitsSection';

const item: AdminIpRateLimitItem = {
  docId: 'a1b2c3d4e5f60718_anon_create_2026-06-10',
  ipHash: 'a1b2c3d4e5f60718',
  action: 'anon_create',
  date: '2026-06-10',
  count: 9,
  windowActive: true,
};

const expiredItem: AdminIpRateLimitItem = {
  docId: 'ffffffffffffffff_anon_create_2000-01-01',
  ipHash: 'ffffffffffffffff',
  action: 'anon_create',
  date: '2000-01-01',
  count: 3,
  windowActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockToast.info.mockClear();
  isOfflineMock = false;
});

describe('IpRateLimitsSection', () => {
  it('renders empty state when no items', async () => {
    mockListAdminIpRateLimits.mockResolvedValueOnce([]);
    render(<IpRateLimitsSection />);
    expect(await screen.findByText(/Sin entradas/i)).toBeInTheDocument();
  });

  it('renders rows from listAdminIpRateLimits with truncated hash', async () => {
    mockListAdminIpRateLimits.mockResolvedValueOnce([item]);
    render(<IpRateLimitsSection />);
    expect(await screen.findByText('a1b2c3d4…')).toBeInTheDocument();
    expect(screen.getByText('anon_create')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('shows hash caption disclaimer', async () => {
    mockListAdminIpRateLimits.mockResolvedValueOnce([]);
    render(<IpRateLimitsSection />);
    expect(
      await screen.findByText(/hash SHA-256 de la IP, no la dirección real/i),
    ).toBeInTheDocument();
  });

  it('emits admin_ip_rate_limit_viewed once on first successful load', async () => {
    mockListAdminIpRateLimits.mockResolvedValueOnce([item]);
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');
    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith('admin_ip_rate_limit_viewed'),
    );
    const callsForViewed = mockTrackEvent.mock.calls.filter(
      (c) => c[0] === 'admin_ip_rate_limit_viewed',
    );
    expect(callsForViewed).toHaveLength(1);
  });

  it('does not re-emit viewed event on refetch after reset', async () => {
    mockListAdminIpRateLimits.mockResolvedValue([item]);
    mockResetAdminIpRateLimit.mockResolvedValueOnce(undefined);
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit de IP/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());

    const callsForViewed = mockTrackEvent.mock.calls.filter(
      (c) => c[0] === 'admin_ip_rate_limit_viewed',
    );
    expect(callsForViewed).toHaveLength(1);
  });

  it('opens dialog with role="alertdialog" (active window copy)', async () => {
    mockListAdminIpRateLimits.mockResolvedValueOnce([item]);
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');
    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit de IP/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Desbloquea esta IP/)).toBeInTheDocument();
  });

  it('shows housekeeping copy for expired window', async () => {
    mockListAdminIpRateLimits.mockResolvedValueOnce([expiredItem]);
    render(<IpRateLimitsSection />);
    await screen.findByText('Expirada');
    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit de IP/i }));
    expect(await screen.findByText(/ya expiró/)).toBeInTheDocument();
  });

  it('confirms reset → calls resetAdminIpRateLimit + emits analytics + toast success', async () => {
    mockListAdminIpRateLimits.mockResolvedValue([item]);
    mockResetAdminIpRateLimit.mockResolvedValueOnce(undefined);
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit de IP/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => {
      expect(mockResetAdminIpRateLimit).toHaveBeenCalledWith(item.docId);
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('admin_ip_rate_limit_reset', {
      action: 'anon_create',
    });
    expect(mockToast.success).toHaveBeenCalledWith('Reseteado correctamente');
  });

  it('maps not-found error to toast.info + refetch', async () => {
    mockListAdminIpRateLimits.mockResolvedValue([item]);
    const err = Object.assign(new Error('not-found'), { code: 'functions/not-found' });
    mockResetAdminIpRateLimit.mockRejectedValueOnce(err);
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit de IP/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith(
        'Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla.',
      );
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockListAdminIpRateLimits).toHaveBeenCalledTimes(2);
    });
  });

  it('shows toast.error on generic error', async () => {
    mockListAdminIpRateLimits.mockResolvedValue([item]);
    mockResetAdminIpRateLimit.mockRejectedValueOnce(new Error('unavailable'));
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');

    fireEvent.click(screen.getByRole('button', { name: /Resetear rate limit de IP/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resetear' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'No se pudo resetear. Verificá tu sesión admin.',
      );
    });
  });

  it('disables row reset button when offline', async () => {
    isOfflineMock = true;
    mockListAdminIpRateLimits.mockResolvedValueOnce([item]);
    render(<IpRateLimitsSection />);
    await screen.findByText('anon_create');
    const resetBtn = screen.getByRole('button', { name: /Resetear rate limit de IP/i });
    expect(resetBtn).toBeDisabled();
  });

  it('passes action filter to listAdminIpRateLimits when input changes', async () => {
    mockListAdminIpRateLimits.mockResolvedValue([]);
    render(<IpRateLimitsSection />);
    await waitFor(() => expect(mockListAdminIpRateLimits).toHaveBeenCalledWith({}));

    const input = screen.getByLabelText('Filtrar por acción');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'anon_create' } });
    });

    await waitFor(() => {
      expect(mockListAdminIpRateLimits).toHaveBeenCalledWith({ action: 'anon_create' });
    });
  });

  it('passes ipHash filter to listAdminIpRateLimits when input changes', async () => {
    mockListAdminIpRateLimits.mockResolvedValue([]);
    render(<IpRateLimitsSection />);
    await waitFor(() => expect(mockListAdminIpRateLimits).toHaveBeenCalledWith({}));

    const input = screen.getByLabelText('Filtrar por IP Hash');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a1b2c3d4e5f60718' } });
    });

    await waitFor(() => {
      expect(mockListAdminIpRateLimits).toHaveBeenCalledWith({ ipHash: 'a1b2c3d4e5f60718' });
    });
  });
});
