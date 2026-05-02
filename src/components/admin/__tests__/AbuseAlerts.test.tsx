import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

const useAbuseLogsRealtimeMock = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useAbuseLogsRealtime', () => ({
  useAbuseLogsRealtime: (...args: unknown[]) => useAbuseLogsRealtimeMock(...args),
}));

vi.mock('../../../services/admin', () => ({
  reviewAbuseLog: vi.fn(),
  dismissAbuseLog: vi.fn(),
  listAdminRateLimits: vi.fn().mockResolvedValue([]),
  resetAdminRateLimit: vi.fn(),
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

vi.mock('../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

vi.mock('../../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

import AbuseAlerts from '../AbuseAlerts';

beforeEach(() => {
  vi.clearAllMocks();
  useAbuseLogsRealtimeMock.mockReturnValue({
    logs: [],
    loading: false,
    error: false,
    newCount: 0,
    resetNewCount: vi.fn(),
  });
});

describe('AbuseAlerts subtab integration', () => {
  it('default subtab is "alerts" and KPI cards are visible', () => {
    useAbuseLogsRealtimeMock.mockReturnValue({
      logs: [],
      loading: false,
      error: false,
      newCount: 0,
      resetNewCount: vi.fn(),
    });
    render(<AbuseAlerts />);
    // KPI labels visible
    expect(screen.getByText('Alertas hoy')).toBeInTheDocument();
    // useAbuseLogsRealtime invoked with enabled=true (subtab !== rateLimits)
    expect(useAbuseLogsRealtimeMock).toHaveBeenCalledWith(200, true);
  });

  it('clicking Rate Limits tab hides KPIs and renders RateLimitsSection', () => {
    render(<AbuseAlerts />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rate Limits' }));

    // KPIs no longer visible
    expect(screen.queryByText('Alertas hoy')).toBeNull();
    expect(screen.queryByText('Total cargadas')).toBeNull();
    // RateLimitsSection filter input visible
    expect(screen.getByLabelText('Filtrar por User ID')).toBeInTheDocument();
  });

  it('passes enabled=false to useAbuseLogsRealtime when on rateLimits subtab', () => {
    render(<AbuseAlerts />);
    useAbuseLogsRealtimeMock.mockClear();

    fireEvent.click(screen.getByRole('tab', { name: 'Rate Limits' }));

    // After re-render the most recent invocation is enabled=false
    const lastCall = useAbuseLogsRealtimeMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(false);
  });

  it('returning to alerts subtab re-enables the hook', () => {
    render(<AbuseAlerts />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rate Limits' }));
    useAbuseLogsRealtimeMock.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: 'Alertas' }));
    const lastCall = useAbuseLogsRealtimeMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(true);
  });

  it('Rate Limits tab is reachable via role+name', () => {
    render(<AbuseAlerts />);
    expect(screen.getByRole('tab', { name: 'Rate Limits' })).toBeInTheDocument();
  });
});
