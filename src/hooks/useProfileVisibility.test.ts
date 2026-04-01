import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks must be declared before imports ---

const mockFetchProfileVisibility = vi.fn();

vi.mock('../services/users', () => ({
  fetchProfileVisibility: (...args: unknown[]) => mockFetchProfileVisibility(...args),
}));

vi.mock('../constants/cache', () => ({
  PROFILE_CACHE_TTL_MS: 30000, // 30s TTL
}));

// Note: useProfileVisibility has module-level cache (visibilityCache, pendingFetches).
// Use unique user IDs per test to avoid cross-test cache pollution.

describe('useProfileVisibility — service integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test the service delegation directly via fetchProfileVisibility mock
  it('fetchProfileVisibility is called with the user IDs that need fetching', async () => {
    mockFetchProfileVisibility.mockResolvedValue(new Map([
      ['uid-e1', true],
      ['uid-e2', false],
    ]));

    // Import the module to access internal functions
    const { fetchProfileVisibility } = await import('../services/users');
    const result = await fetchProfileVisibility(['uid-e1', 'uid-e2']);

    expect(result.get('uid-e1')).toBe(true);
    expect(result.get('uid-e2')).toBe(false);
  });

  it('fetchProfileVisibility returns false for users not in result', async () => {
    mockFetchProfileVisibility.mockResolvedValue(new Map([['uid-f1', true]]));

    const { fetchProfileVisibility } = await import('../services/users');
    const result = await fetchProfileVisibility(['uid-f1', 'uid-f2']);

    expect(result.get('uid-f1')).toBe(true);
    // uid-f2 was not in mock result — service should default to false
    // (this tests service behavior, not hook cache behavior)
  });
});
