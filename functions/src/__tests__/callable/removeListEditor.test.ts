import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDb = {
  doc: () => ({ get: mockGet, update: mockUpdate }),
};

vi.mock('../../helpers/env', () => ({ IS_EMULATOR: true, ENFORCE_APP_CHECK: false, getDb: () => mockDb }));

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

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayRemove: vi.fn((v: string) => ({ __arrayRemove: v })),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
}));

const mockCheckCallableRateLimit = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/callableRateLimit', () => ({
  checkCallableRateLimit: (...args: unknown[]) => mockCheckCallableRateLimit(...args),
}));

import { removeListEditor } from '../../callable/removeListEditor';

const handler = removeListEditor as unknown as (req: unknown) => Promise<unknown>;

describe('removeListEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws unauthenticated if no auth', async () => {
    await expect(handler({ data: { listId: 'l1', targetUid: 'u2' } }))
      .rejects.toThrow('Must be signed in');
  });

  it('throws on missing targetUid', async () => {
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1' } }))
      .rejects.toThrow('targetUid required');
  });

  it('throws when not owner', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'other' }) });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } }))
      .rejects.toThrow('Solo el creador puede remover editores');
  });

  it('succeeds when owner removes editor', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1' }) });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('calls checkCallableRateLimit with correct key and limit', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1' }) });
    await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } });
    expect(mockCheckCallableRateLimit).toHaveBeenCalledWith(mockDb, 'editors_remove_u1', 10);
  });

  it('rejects with resource-exhausted when rate limited', async () => {
    mockCheckCallableRateLimit.mockRejectedValueOnce(
      Object.assign(new Error('Limite diario alcanzado. Intenta manana.'), { code: 'resource-exhausted' }),
    );
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } }))
      .rejects.toThrow('Limite diario alcanzado');
  });
});
