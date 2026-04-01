import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockFetchUserRatingsCount = vi.fn();
const mockFetchUserFavoritesCount = vi.fn();
const mockFetchFollowersCount = vi.fn();

vi.mock('../services/ratings', () => ({
  fetchUserRatingsCount: (...args: unknown[]) => mockFetchUserRatingsCount(...args),
}));

vi.mock('../services/favorites', () => ({
  fetchUserFavoritesCount: (...args: unknown[]) => mockFetchUserFavoritesCount(...args),
}));

vi.mock('../services/follows', () => ({
  fetchFollowersCount: (...args: unknown[]) => mockFetchFollowersCount(...args),
}));

const mockUser = { uid: 'user-1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('./useMyCheckIns', () => ({
  useMyCheckIns: () => ({ stats: { uniqueBusinesses: 5 } }),
}));

import { useProfileStats } from './useProfileStats';

describe('useProfileStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchUserRatingsCount.mockResolvedValue(10);
    mockFetchUserFavoritesCount.mockResolvedValue(7);
    mockFetchFollowersCount.mockResolvedValue(3);
  });

  it('returns correct counts from services', async () => {
    const { result } = renderHook(() => useProfileStats());

    await waitFor(() => {
      expect(result.current.reviews).toBe(10);
    });

    expect(result.current.favorites).toBe(7);
    expect(result.current.followers).toBe(3);
    expect(result.current.places).toBe(5);
  });

  it('returns zeros initially before fetch resolves', () => {
    mockFetchUserRatingsCount.mockReturnValue(new Promise(() => {}));
    mockFetchUserFavoritesCount.mockReturnValue(new Promise(() => {}));
    mockFetchFollowersCount.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useProfileStats());

    expect(result.current.reviews).toBe(0);
    expect(result.current.favorites).toBe(0);
    expect(result.current.followers).toBe(0);
  });

  it('renders with zero counts while fetch is pending', async () => {
    // Keep promises pending - verify initial state
    mockFetchUserRatingsCount.mockReturnValue(new Promise(() => {}));
    mockFetchUserFavoritesCount.mockReturnValue(new Promise(() => {}));
    mockFetchFollowersCount.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useProfileStats());

    expect(result.current.reviews).toBe(0);
    expect(result.current.favorites).toBe(0);
    expect(result.current.followers).toBe(0);
    expect(result.current.places).toBe(5);
  });
});
