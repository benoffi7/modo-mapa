import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { checkCallableRateLimit } from '../../utils/callableRateLimit';

function createMockDb(snapData: { count: number; resetAt: number } | undefined) {
  const mockSet = vi.fn();
  const mockUpdate = vi.fn();
  const mockGet = vi.fn().mockResolvedValue({
    data: () => snapData,
  });

  const docRef = {};
  const db = {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue(docRef),
    }),
    runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      };
      await fn(tx);
    }),
  };

  return { db, mockSet, mockUpdate, mockGet };
}

describe('checkCallableRateLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new rate limit doc on first call', async () => {
    const { db, mockSet } = createMockDb(undefined);
    await checkCallableRateLimit(db as never, 'test_key', 10);
    expect(mockSet).toHaveBeenCalledWith({}, { count: 1, resetAt: expect.any(Number) });
  });

  it('increments count within the daily window', async () => {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    const { db, mockUpdate } = createMockDb({ count: 3, resetAt: tomorrow.getTime() });
    await checkCallableRateLimit(db as never, 'test_key', 10);
    expect(mockUpdate).toHaveBeenCalledWith({}, { count: 4 });
  });

  it('rejects when limit is exceeded', async () => {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    const { db } = createMockDb({ count: 10, resetAt: tomorrow.getTime() });
    await expect(checkCallableRateLimit(db as never, 'test_key', 10))
      .rejects.toThrow('Limite diario alcanzado');
  });

  it('resets counter when the daily window has expired', async () => {
    const yesterday = Date.now() - 86_400_000;
    const { db, mockSet } = createMockDb({ count: 10, resetAt: yesterday });
    await checkCallableRateLimit(db as never, 'test_key', 10);
    expect(mockSet).toHaveBeenCalledWith({}, { count: 1, resetAt: expect.any(Number) });
  });
});
