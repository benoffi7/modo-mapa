import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handler,
  mockGetDb,
  mockAssertAdmin,
} = vi.hoisted(() => ({
  handler: { fn: null as ((request: any) => Promise<any>) | null },
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    handler.fn = fn;
    return fn;
  },
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: () => mockGetDb(),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: any[]) => mockAssertAdmin(...args),
}));

function createMockDb(items: any[] = []) {
  const mockSnap = {
    docs: items.map((item, i) => ({
      id: item.id ?? `item${i}`,
      data: () => item,
    })),
  };
  const mockLimit = vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(mockSnap) });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockItemsCollection = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockUserDoc = vi.fn().mockReturnValue({ collection: mockItemsCollection });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockUserDoc });
  const db = { collection: mockCollection };
  mockGetDb.mockReturnValue(db);
  return { db, mockCollection, mockLimit };
}

// Import AFTER mocks
import '../activityFeedDiag';

describe('getActivityFeedDiag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getHandler = () => handler.fn!;

  it('rejects non-admin users', async () => {
    createMockDb();
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(
      getHandler()({ auth: { uid: 'user1' }, data: { userId: 'u1' } }),
    ).rejects.toThrow('Admin only');
  });

  it('rejects missing userId', async () => {
    createMockDb();
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: {} }),
    ).rejects.toThrow('userId is required');
  });

  it('rejects invalid limit', async () => {
    createMockDb();
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: { userId: 'u1', limit: 100 } }),
    ).rejects.toThrow('limit must be a number between 1 and 50');
  });

  it('returns items with expired status', async () => {
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    const futureDate = new Date(Date.now() + 86400000); // tomorrow

    createMockDb([
      {
        id: 'item1',
        actorId: 'a1',
        actorName: 'Actor 1',
        type: 'rating',
        businessId: 'b1',
        businessName: 'Biz 1',
        referenceId: 'r1',
        createdAt: { toDate: () => new Date('2026-01-01') },
        expiresAt: { toDate: () => pastDate },
      },
      {
        id: 'item2',
        actorId: 'a2',
        actorName: 'Actor 2',
        type: 'comment',
        businessId: 'b2',
        businessName: 'Biz 2',
        referenceId: 'r2',
        createdAt: { toDate: () => new Date('2026-03-01') },
        expiresAt: { toDate: () => futureDate },
      },
    ]);

    const result = await getHandler()({
      auth: { uid: 'admin1' },
      data: { userId: 'u1' },
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].isExpired).toBe(true);
    expect(result.items[1].isExpired).toBe(false);
    expect(result.items[0].type).toBe('rating');
    expect(result.items[1].type).toBe('comment');
  });

  it('returns empty feed', async () => {
    createMockDb([]);
    const result = await getHandler()({
      auth: { uid: 'admin1' },
      data: { userId: 'u1' },
    });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects custom limit', async () => {
    const { mockLimit } = createMockDb([]);
    await getHandler()({
      auth: { uid: 'admin1' },
      data: { userId: 'u1', limit: 10 },
    });
    expect(mockLimit).toHaveBeenCalledWith(10);
  });
});
