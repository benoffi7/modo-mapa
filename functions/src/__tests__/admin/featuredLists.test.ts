import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsEmulator = vi.hoisted(() => ({ value: true }));
const mockUpdate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('../../helpers/env', () => ({
  get IS_EMULATOR() { return mockIsEmulator.value; },
  ENFORCE_APP_CHECK: false,
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: () => ({ doc: () => ({ get: mockGet, update: mockUpdate }) }),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: (...args: unknown[]) => unknown) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: vi.fn(),
}));

import { toggleFeaturedList } from '../../admin/featuredLists';

const handler = toggleFeaturedList as unknown as (request: unknown) => Promise<unknown>;

describe('toggleFeaturedList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws on missing listId', async () => {
    await expect(handler({ auth: { uid: 'admin' }, data: { featured: true } }))
      .rejects.toThrow('listId required');
  });

  it('throws on non-boolean featured', async () => {
    await expect(handler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: 'yes' } }))
      .rejects.toThrow('featured must be boolean');
  });

  it('throws when list not found', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(handler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: true } }))
      .rejects.toThrow('Lista no encontrada');
  });

  it('throws when featuring a private list', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isPublic: false }) });
    await expect(handler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: true } }))
      .rejects.toThrow('Solo listas públicas pueden ser destacadas');
  });

  it('allows unfeaturing a private list', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isPublic: false }) });
    const result = await handler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: false } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ featured: false });
  });

  it('features a public list successfully', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isPublic: true }) });
    const result = await handler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: true } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ featured: true });
  });
});
