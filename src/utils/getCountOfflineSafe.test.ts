import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCountFromServer = vi.fn();
vi.mock('firebase/firestore', () => ({
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
}));

import { getCountOfflineSafe } from './getCountOfflineSafe';

describe('getCountOfflineSafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  it('returns count when online', async () => {
    mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 5 }) });
    const result = await getCountOfflineSafe({} as never);
    expect(result).toBe(5);
    expect(mockGetCountFromServer).toHaveBeenCalled();
  });

  it('returns 0 when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const result = await getCountOfflineSafe({} as never);
    expect(result).toBe(0);
    expect(mockGetCountFromServer).not.toHaveBeenCalled();
  });

  it('returns 0 when getCountFromServer throws', async () => {
    mockGetCountFromServer.mockRejectedValueOnce(new Error('network'));
    const result = await getCountOfflineSafe({} as never);
    expect(result).toBe(0);
  });
});
