import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../helpers/env', () => ({ IS_EMULATOR: true }));

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

const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: () => ({ get: mockGet, update: mockUpdate }),
  }),
  FieldValue: {
    arrayRemove: vi.fn((v: string) => ({ __arrayRemove: v })),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
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
});
