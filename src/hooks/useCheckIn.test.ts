import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateCheckIn = vi.hoisted(() => vi.fn());
const mockDeleteCheckIn = vi.hoisted(() => vi.fn());
const mockFetchCheckInsForBusiness = vi.hoisted(() => vi.fn());
const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
const mockTrackEvent = vi.hoisted(() => vi.fn());
const mockDistanceKm = vi.hoisted(() => vi.fn());
const mockToast = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };

vi.mock('../services/checkins', () => ({
  createCheckIn: mockCreateCheckIn,
  deleteCheckIn: mockDeleteCheckIn,
  fetchCheckInsForBusiness: mockFetchCheckInsForBusiness,
}));

vi.mock('../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

const mockWithBusyFlag = vi.hoisted(() => vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})));
vi.mock('../utils/busyFlag', () => ({
  withBusyFlag: mockWithBusyFlag,
  isBusyFlagActive: vi.fn(() => false),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock('../utils/distance', () => ({
  distanceKm: mockDistanceKm,
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockUserLocation: { lat: number; lng: number } | null = null;
vi.mock('../context/FiltersContext', () => ({
  useFilters: () => ({ userLocation: mockUserLocation }),
}));

let mockIsOffline = false;
vi.mock('../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../constants/checkin', () => ({
  CHECKIN_COOLDOWN_HOURS: 4,
  CHECKIN_PROXIMITY_RADIUS_M: 500,
}));

import { useCheckIn } from './useCheckIn';
import { logger } from '../utils/logger';

describe('useCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockUserLocation = null;
    mockIsOffline = false;
    mockFetchCheckInsForBusiness.mockResolvedValue([]);
    mockDistanceKm.mockReturnValue(0.1); // 100m = nearby
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<unknown>) => fn(),
    );
    mockCreateCheckIn.mockResolvedValue('checkin-id-1');
    mockDeleteCheckIn.mockResolvedValue(undefined);
  });

  it('starts with idle status and no recent check-in', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.hasCheckedInRecently).toBe(false);
    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.recentCheckInId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('detects a recent check-in within cooldown window', async () => {
    const recentTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    mockFetchCheckInsForBusiness.mockResolvedValue([
      { id: 'ci-1', createdAt: recentTime },
    ]);

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));

    await waitFor(() => expect(result.current.hasCheckedInRecently).toBe(true));
    expect(result.current.recentCheckInId).toBe('ci-1');
    expect(result.current.status).toBe('success');
    expect(result.current.canCheckIn).toBe(false);
  });

  it('does not flag old check-in outside cooldown window', async () => {
    const oldTime = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago
    mockFetchCheckInsForBusiness.mockResolvedValue([
      { id: 'ci-old', createdAt: oldTime },
    ]);

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));

    await waitFor(() => expect(mockFetchCheckInsForBusiness).toHaveBeenCalled());
    expect(result.current.hasCheckedInRecently).toBe(false);
  });

  it('does not fetch check-ins when no user', async () => {
    mockUser = null;
    renderHook(() => useCheckIn('biz1', 'Test Biz'));
    expect(mockFetchCheckInsForBusiness).not.toHaveBeenCalled();
  });

  it('does not fetch check-ins when no businessId', async () => {
    renderHook(() => useCheckIn('', 'Test Biz'));
    expect(mockFetchCheckInsForBusiness).not.toHaveBeenCalled();
  });

  it('returns isNearby=true when no user or business location', () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    expect(result.current.isNearby).toBe(true);
  });

  it('returns isNearby=true when within proximity radius', () => {
    mockUserLocation = { lat: -34.6, lng: -58.3 };
    mockDistanceKm.mockReturnValue(0.3); // 300m

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz', { lat: -34.601, lng: -58.301 }));
    expect(result.current.isNearby).toBe(true);
  });

  it('returns isNearby=false when outside proximity radius', () => {
    mockUserLocation = { lat: -34.6, lng: -58.3 };
    mockDistanceKm.mockReturnValue(1.0); // 1000m

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz', { lat: -34.61, lng: -58.31 }));
    expect(result.current.isNearby).toBe(false);
  });

  it('performs check-in successfully', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    expect(result.current.status).toBe('success');
    expect(result.current.hasCheckedInRecently).toBe(true);
    expect(result.current.recentCheckInId).toBe('checkin-id-1');
  });

  it('does nothing when user is null on performCheckIn', async () => {
    mockUser = null;
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));

    await act(async () => { await result.current.performCheckIn(); });

    expect(mockWithOfflineSupport).not.toHaveBeenCalled();
  });

  it('blocks check-in during cooldown and tracks event', async () => {
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000);
    mockFetchCheckInsForBusiness.mockResolvedValue([
      { id: 'ci-1', createdAt: recentTime },
    ]);

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.hasCheckedInRecently).toBe(true));

    await act(async () => { await result.current.performCheckIn(); });

    expect(mockTrackEvent).toHaveBeenCalledWith('checkin_cooldown_blocked', { business_id: 'biz1' });
    expect(mockWithOfflineSupport).not.toHaveBeenCalled();
  });

  it('tracks proximity warning when not nearby', async () => {
    mockUserLocation = { lat: -34.6, lng: -58.3 };
    mockDistanceKm.mockReturnValue(1.5); // 1500m, not nearby

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz', { lat: -34.62, lng: -58.32 }));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    expect(mockTrackEvent).toHaveBeenCalledWith('checkin_proximity_warning', expect.objectContaining({
      business_id: 'biz1',
    }));
  });

  it('handles performCheckIn error', async () => {
    mockWithOfflineSupport.mockRejectedValue(new Error('Network fail'));

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Network fail');
    expect(result.current.hasCheckedInRecently).toBe(false);
  });

  it('handles non-Error throw on performCheckIn', async () => {
    mockWithOfflineSupport.mockRejectedValue('string error');

    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('No se pudo registrar la visita');
  });

  it('undoes check-in successfully', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    // First do a check-in
    await act(async () => { await result.current.performCheckIn(); });
    expect(result.current.hasCheckedInRecently).toBe(true);

    // Then undo
    await act(async () => { await result.current.undoCheckIn(); });

    expect(result.current.status).toBe('idle');
    expect(result.current.hasCheckedInRecently).toBe(false);
    expect(result.current.recentCheckInId).toBeNull();
  });

  it('does nothing on undoCheckIn when no user', async () => {
    mockUser = null;
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));

    await act(async () => { await result.current.undoCheckIn(); });
    expect(mockWithOfflineSupport).not.toHaveBeenCalled();
  });

  it('does nothing on undoCheckIn when no recentCheckInId', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.undoCheckIn(); });
    expect(mockWithOfflineSupport).not.toHaveBeenCalled();
  });

  it('handles undoCheckIn error', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    mockWithOfflineSupport.mockRejectedValue(new Error('Undo fail'));

    await act(async () => { await result.current.undoCheckIn(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Undo fail');
  });

  it('calls logger.warn when fetchCheckInsForBusiness rejects (mounted component)', async () => {
    const fetchError = new Error('fetch failed');
    mockFetchCheckInsForBusiness.mockRejectedValue(fetchError);

    renderHook(() => useCheckIn('biz1', 'Test Biz'));

    await waitFor(() => expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      '[useCheckIn] fetchCheckInsForBusiness failed',
      fetchError,
    ));
  });

  it('does NOT call logger.warn when component is unmounted before fetch rejects (cancelled guard)', async () => {
    let rejectFn!: (err: Error) => void;
    mockFetchCheckInsForBusiness.mockImplementation(
      () => new Promise<never>((_, reject) => { rejectFn = reject; }),
    );

    const { unmount } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    unmount();
    rejectFn(new Error('late error'));

    // Flush microtasks
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('handles non-Error throw on undoCheckIn', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    mockWithOfflineSupport.mockRejectedValue(42);

    await act(async () => { await result.current.undoCheckIn(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('No se pudo desmarcar la visita');
  });

  it('performCheckIn invoca withBusyFlag con kind: checkin_submit', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => { await result.current.performCheckIn(); });

    expect(mockWithBusyFlag).toHaveBeenCalledWith('checkin_submit', expect.any(Function));
  });

  it('undoCheckIn invoca withBusyFlag con kind: checkin_submit', async () => {
    const { result } = renderHook(() => useCheckIn('biz1', 'Test Biz'));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    // Perform check-in first so recentCheckInId is set
    await act(async () => { await result.current.performCheckIn(); });
    mockWithBusyFlag.mockClear();

    await act(async () => { await result.current.undoCheckIn(); });

    expect(mockWithBusyFlag).toHaveBeenCalledWith('checkin_submit', expect.any(Function));
  });
});
