import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (#323 — rating_criteria_upsert wrap) ---

const mockUpsertRating = vi.hoisted(() => vi.fn());
const mockDeleteRating = vi.hoisted(() => vi.fn());
const mockUpsertCriteriaRating = vi.hoisted(() => vi.fn());

vi.mock('../../services/ratings', () => ({
  upsertRating: mockUpsertRating,
  deleteRating: mockDeleteRating,
  upsertCriteriaRating: mockUpsertCriteriaRating,
}));

const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: vi.fn((_kind: string, fn: () => Promise<unknown>) => fn()),
  isBusyFlagActive: vi.fn(() => false),
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' }, displayName: 'Test User' }),
}));

let mockIsOffline = false;
vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

vi.mock('./useActivityReminder', () => ({ incrementAnonRatingCount: vi.fn() }));

import { useBusinessRating } from '../useBusinessRating';

const params = {
  businessId: 'biz1',
  businessName: 'Test Biz',
  ratings: [
    {
      userId: 'user1',
      businessId: 'biz1',
      score: 4,
      criteria: {},
      createdAt: new Date(),
    },
  ],
  isLoading: false,
  onRatingChange: vi.fn(),
};

describe('useBusinessRating.handleCriterionRate (#323)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _t: string, _meta: object, _payload: object, fn: () => Promise<unknown>) =>
        fn(),
    );
    mockUpsertCriteriaRating.mockResolvedValue(undefined);
  });

  it('online: invokes withOfflineSupport with isOffline=false and runs upsertCriteriaRating', async () => {
    mockIsOffline = false;
    const { result } = renderHook(() => useBusinessRating(params));

    await act(async () => {
      await result.current.handleCriterionRate('food', 5);
    });

    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);
    const call = mockWithOfflineSupport.mock.calls[0]!;
    expect(call[0]).toBe(false);
    expect(call[1]).toBe('rating_criteria_upsert');
    expect(call[2]).toEqual({ userId: 'user1', businessId: 'biz1', businessName: 'Test Biz' });
    expect(call[3]).toEqual({ criterionId: 'food', value: 5 });
    expect(mockUpsertCriteriaRating).toHaveBeenCalledWith('user1', 'biz1', { food: 5 });
  });

  it('offline: invokes withOfflineSupport with isOffline=true (interceptor enqueues, no service call)', async () => {
    mockIsOffline = true;
    mockWithOfflineSupport.mockImplementationOnce(async () => undefined);

    const { result } = renderHook(() => useBusinessRating(params));

    await act(async () => {
      await result.current.handleCriterionRate('service', 3);
    });

    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);
    expect(mockWithOfflineSupport.mock.calls[0]![0]).toBe(true);
    expect(mockWithOfflineSupport.mock.calls[0]![1]).toBe('rating_criteria_upsert');
    expect(mockUpsertCriteriaRating).not.toHaveBeenCalled();
  });

  it('does nothing when value is null', async () => {
    const { result } = renderHook(() => useBusinessRating(params));

    await act(async () => {
      await result.current.handleCriterionRate('food', null);
    });

    expect(mockWithOfflineSupport).not.toHaveBeenCalled();
    expect(mockUpsertCriteriaRating).not.toHaveBeenCalled();
  });
});
