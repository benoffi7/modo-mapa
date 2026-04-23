import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Rating } from '../types';

// --- Mocks ---

const mockWithBusyFlag = vi.hoisted(() => vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})));
const mockIsBusyFlagActive = vi.hoisted(() => vi.fn(() => false));
vi.mock('../utils/busyFlag', () => ({
  withBusyFlag: mockWithBusyFlag,
  isBusyFlagActive: () => mockIsBusyFlagActive(),
}));

const mockUpsertRating = vi.hoisted(() => vi.fn());
const mockDeleteRating = vi.hoisted(() => vi.fn());
const mockUpsertCriteriaRating = vi.hoisted(() => vi.fn());
vi.mock('../services/ratings', () => ({
  upsertRating: mockUpsertRating,
  deleteRating: mockDeleteRating,
  upsertCriteriaRating: mockUpsertCriteriaRating,
}));

const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
vi.mock('../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

let mockUser: { uid: string; isAnonymous?: boolean } | null = { uid: 'user1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

vi.mock('../hooks/useActivityReminder', () => ({
  incrementAnonRatingCount: vi.fn(),
}));

vi.mock('../constants/criteria', () => ({
  RATING_CRITERIA: [],
}));

vi.mock('../constants/storage', () => ({
  STORAGE_KEY_HINT_POST_FIRST_RATING: 'hint_post_first_rating',
  STORAGE_KEY_ONBOARDING_COMPLETED: 'onboarding_completed',
}));

vi.mock('../constants/messages', () => ({
  MSG_BUSINESS: {
    ratingSuccess: 'Calificación guardada',
    ratingError: 'Error al calificar',
    ratingDeleteError: 'Error al eliminar calificación',
    criteriaError: 'Error al calificar criterio',
  },
}));

import { useBusinessRating } from './useBusinessRating';

// --- Helpers ---

const baseRating: Rating = {
  userId: 'other',
  businessId: 'biz1',
  score: 4,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultParams = {
  businessId: 'biz1',
  businessName: 'Test Biz',
  ratings: [baseRating],
  isLoading: false,
  onRatingChange: vi.fn(),
};

describe('useBusinessRating – withBusyFlag integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<unknown>) => fn(),
    );
    mockUpsertRating.mockResolvedValue(undefined);
    mockUpsertCriteriaRating.mockResolvedValue(undefined);
    mockDeleteRating.mockResolvedValue(undefined);
  });

  it('handleRate invoca withBusyFlag con kind: rating_submit', async () => {
    const { result } = renderHook(() => useBusinessRating(defaultParams));

    await act(async () => {
      await result.current.handleRate(null, 5);
    });

    expect(mockWithBusyFlag).toHaveBeenCalledWith('rating_submit', expect.any(Function));
  });

  it('handleCriterionRate invoca withBusyFlag con kind: rating_submit', async () => {
    const { result } = renderHook(() => useBusinessRating(defaultParams));

    await act(async () => {
      await result.current.handleCriterionRate('quality' as never, 4);
    });

    expect(mockWithBusyFlag).toHaveBeenCalledWith('rating_submit', expect.any(Function));
  });

  it('handleRate no llama withBusyFlag si no hay usuario', async () => {
    mockUser = null;
    const { result } = renderHook(() => useBusinessRating(defaultParams));

    await act(async () => {
      await result.current.handleRate(null, 5);
    });

    expect(mockWithBusyFlag).not.toHaveBeenCalled();
  });

  it('handleRate no llama withBusyFlag si value es null', async () => {
    const { result } = renderHook(() => useBusinessRating(defaultParams));

    await act(async () => {
      await result.current.handleRate(null, null);
    });

    expect(mockWithBusyFlag).not.toHaveBeenCalled();
  });
});
