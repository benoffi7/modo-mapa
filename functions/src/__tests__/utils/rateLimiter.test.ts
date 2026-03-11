import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit } from '../../utils/rateLimiter';

function mockFirestore(countValue: number) {
  return {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          data: () => ({ count: countValue }),
        }),
      }),
    }),
  } as never;
}

describe('checkRateLimit', () => {
  it('returns false when under limit', async () => {
    const db = mockFirestore(5);
    const result = await checkRateLimit(
      db,
      { collection: 'comments', limit: 20, windowType: 'daily' },
      'user1',
    );
    expect(result).toBe(false);
  });

  it('returns false when at exactly the limit', async () => {
    const db = mockFirestore(20);
    const result = await checkRateLimit(
      db,
      { collection: 'comments', limit: 20, windowType: 'daily' },
      'user1',
    );
    expect(result).toBe(false);
  });

  it('returns true when over the limit', async () => {
    const db = mockFirestore(21);
    const result = await checkRateLimit(
      db,
      { collection: 'comments', limit: 20, windowType: 'daily' },
      'user1',
    );
    expect(result).toBe(true);
  });

  it('uses per_entity window with businessId', async () => {
    const where = vi.fn().mockReturnThis();
    const db = {
      collection: vi.fn().mockReturnValue({
        where,
        count: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            data: () => ({ count: 5 }),
          }),
        }),
      }),
    } as never;

    await checkRateLimit(
      db,
      { collection: 'customTags', limit: 10, windowType: 'per_entity' },
      'user1',
      'business1',
    );

    expect(where).toHaveBeenCalledWith('userId', '==', 'user1');
    expect(where).toHaveBeenCalledWith('businessId', '==', 'business1');
  });
});
