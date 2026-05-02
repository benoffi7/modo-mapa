import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Business } from '../types';

const { mockAllBusinesses, mockUseVisitHistory, mockUseSortLocation, mockToast, mockTrackEvent } =
  vi.hoisted(() => ({
    // mutable so each test can swap content via .splice/=
    mockAllBusinesses: [] as Business[],
    mockUseVisitHistory: vi.fn(),
    mockUseSortLocation: vi.fn(),
    mockToast: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
    mockTrackEvent: vi.fn(),
  }));

vi.mock('./useBusinesses', () => ({
  allBusinesses: mockAllBusinesses,
  useBusinesses: vi.fn(),
}));

vi.mock('./useVisitHistory', () => ({
  useVisitHistory: () => mockUseVisitHistory(),
}));

vi.mock('./useSortLocation', () => ({
  useSortLocation: () => mockUseSortLocation(),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { useSurpriseMe } from './useSurpriseMe';
import { MSG_ONBOARDING } from '../constants/messages';

function makeBusiness(id: string, lat: number, lng: number, name = `Bar ${id}`): Business {
  return {
    id,
    name,
    address: 'Av Falsa 123',
    category: 'cafe',
    lat,
    lng,
    tags: [],
  } as Business;
}

// Buenos Aires reference: -34.6, -58.4
// Nearby: same coords (~0km). Far: ~100km away (-35.5, -59.4)
const BS_AS = { lat: -34.6, lng: -58.4 };

describe('useSurpriseMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shared array reference
    mockAllBusinesses.length = 0;
    mockUseSortLocation.mockReturnValue(BS_AS);
    mockUseVisitHistory.mockReturnValue({ visits: [], recordVisit: vi.fn(), clearHistory: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('picks from nearby (<=5km) when there are nearby unvisited candidates', () => {
    mockAllBusinesses.push(
      makeBusiness('near1', -34.6, -58.4),
      makeBusiness('near2', -34.605, -58.405),
      makeBusiness('far1', -35.5, -59.4),
    );
    const onSelect = vi.fn();
    const onClose = vi.fn();

    // Force Math.random=0 → first nearby element
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { result } = renderHook(() => useSurpriseMe({ onSelect, onClose }));
    act(() => {
      result.current.handleSurprise();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    const picked = (onSelect.mock.calls[0][0] as Business).id;
    expect(['near1', 'near2']).toContain(picked);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledWith(MSG_ONBOARDING.surpriseSuccess(`Bar ${picked}`));
    expect(mockToast.info).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('surprise_me', { business_id: picked });
  });

  it('picks from full candidates when no nearby (<=5km) match', () => {
    mockAllBusinesses.push(
      makeBusiness('far1', -35.5, -59.4),
      makeBusiness('far2', -36.5, -60.4),
    );
    const onSelect = vi.fn();
    const onClose = vi.fn();

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { result } = renderHook(() => useSurpriseMe({ onSelect, onClose }));
    act(() => {
      result.current.handleSurprise();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    const picked = (onSelect.mock.calls[0][0] as Business).id;
    expect(['far1', 'far2']).toContain(picked);
    expect(mockToast.success).toHaveBeenCalled();
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it('falls back to allBusinesses pool when every business is already visited', () => {
    mockAllBusinesses.push(
      makeBusiness('a', -34.6, -58.4),
      makeBusiness('b', -34.605, -58.405),
    );
    mockUseVisitHistory.mockReturnValue({
      visits: [
        { businessId: 'a', lastVisited: '2026-01-01', visitCount: 1, business: null },
        { businessId: 'b', lastVisited: '2026-01-02', visitCount: 1, business: null },
      ],
      recordVisit: vi.fn(),
      clearHistory: vi.fn(),
    });
    const onSelect = vi.fn();
    const onClose = vi.fn();

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { result } = renderHook(() => useSurpriseMe({ onSelect, onClose }));
    act(() => {
      result.current.handleSurprise();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(mockToast.info).toHaveBeenCalledWith(MSG_ONBOARDING.surpriseAllVisited);
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('surprise_me', expect.any(Object));
  });

  it('Math.random near upper bound picks the last element of pool', () => {
    mockAllBusinesses.push(
      makeBusiness('near1', -34.6, -58.4),
      makeBusiness('near2', -34.605, -58.405),
    );
    const onSelect = vi.fn();
    const onClose = vi.fn();

    // Math.random()=0.99 → floor(0.99 * 2) = 1 → last index
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const { result } = renderHook(() => useSurpriseMe({ onSelect, onClose }));
    act(() => {
      result.current.handleSurprise();
    });

    expect((onSelect.mock.calls[0][0] as Business).id).toBe('near2');
  });
});
