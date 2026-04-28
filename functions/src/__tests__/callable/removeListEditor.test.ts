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

const mockLoggerWarn = vi.fn();
vi.mock('firebase-functions', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: vi.fn(),
    error: vi.fn(),
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

  it('succeeds when owner removes existing editor', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  // R13 mirror — uniform response anti-enumeration

  it('returns uniform success when targetUid not in editorIds (idempotent)', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['someoneElse'] }) });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'ghost' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns uniform success when editorIds is undefined (no editors yet)', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1' }) });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('logs hashed uid (not plain) when target not in editors', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'plainUidShouldNotLeak' } });
    expect(mockLoggerWarn).toHaveBeenCalled();
    const call = mockLoggerWarn.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('not in editors'),
    );
    expect(call).toBeDefined();
    const payload = call![1] as { targetUidHash: string; listId: string; ownerUid: string };
    expect(payload.targetUidHash).toMatch(/^[a-f0-9]{12}$/);
    expect(payload.listId).toBe('l1');
    expect(payload.ownerUid).toBe('u1');
    expect(JSON.stringify(payload)).not.toContain('plainUidShouldNotLeak');
  });

  it('uniform shape: removing existing vs non-existing editor returns identical responses', async () => {
    // Existing
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    const existing = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } });

    // Non-existing
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    const ghost = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'ghost' } });

    expect(existing).toEqual({ success: true });
    expect(ghost).toEqual({ success: true });
    expect(Object.keys(existing as object).sort()).toEqual(['success']);
    expect(Object.keys(ghost as object).sort()).toEqual(['success']);
  });

  it('calls checkCallableRateLimit with correct key and limit', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } });
    expect(mockCheckCallableRateLimit).toHaveBeenCalledWith(mockDb, 'editors_remove_u1', 10, 'u1');
  });

  it('rejects with resource-exhausted when rate limited', async () => {
    mockCheckCallableRateLimit.mockRejectedValueOnce(
      Object.assign(new Error('Limite diario alcanzado. Intenta manana.'), { code: 'resource-exhausted' }),
    );
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetUid: 'u2' } }))
      .rejects.toThrow('Limite diario alcanzado');
  });
});
