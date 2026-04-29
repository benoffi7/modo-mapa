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
    arrayUnion: vi.fn((v: string) => ({ __arrayUnion: v })),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
}));

const mockGetUserByEmail = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ getUserByEmail: mockGetUserByEmail }),
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

import { inviteListEditor } from '../../callable/inviteListEditor';

const handler = inviteListEditor as unknown as (req: unknown) => Promise<unknown>;

describe('inviteListEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws unauthenticated if no auth', async () => {
    await expect(handler({ data: { listId: 'l1', targetEmail: 'a@b.com' } }))
      .rejects.toThrow('Must be signed in');
  });

  it('throws on missing listId', async () => {
    await expect(handler({ auth: { uid: 'u1' }, data: { targetEmail: 'a@b.com' } }))
      .rejects.toThrow('listId required');
  });

  it('throws when list not found', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'a@b.com' } }))
      .rejects.toThrow('Lista no encontrada');
  });

  it('throws when caller is not owner', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'other' }) });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'a@b.com' } }))
      .rejects.toThrow('Solo el creador puede invitar editores');
  });

  // R13 — uniform response anti-enumeration: los siguientes 3 paths
  // antes throws-eaban, ahora devuelven { success: true } con shape identico.

  it('returns uniform success when target email not registered (no enumeration)', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockRejectedValueOnce(new Error('not found'));
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'notfound@b.com' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('logs hashed email (not plain) when target not registered', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockRejectedValueOnce(new Error('not found'));
    await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'NotFound@b.com' } });
    expect(mockLoggerWarn).toHaveBeenCalled();
    const call = mockLoggerWarn.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('not registered'),
    );
    expect(call).toBeDefined();
    const payload = call![1] as { emailHash: string; listId: string; ownerUid: string };
    expect(payload.emailHash).toMatch(/^[a-f0-9]{12}$/);
    expect(payload.listId).toBe('l1');
    expect(payload.ownerUid).toBe('u1');
    // Email plano NUNCA debe aparecer en el payload de log
    expect(JSON.stringify(payload)).not.toContain('NotFound@b.com');
    expect(JSON.stringify(payload)).not.toContain('notfound@b.com');
  });

  it('returns uniform success when inviting self (no enumeration)', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u1' });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'me@b.com' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns uniform success when user already editor (idempotent)', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'dup@b.com' } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws when 5 editors already (cap is owner-visible info, not a leak)', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['a', 'b', 'c', 'd', 'e'] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'newuser' });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'new@b.com' } }))
      .rejects.toThrow('Máximo 5 editores por lista');
  });

  it('succeeds and returns success without targetUid', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } });
    expect(result).toEqual({ success: true });
    expect(result).not.toHaveProperty('targetUid');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('uniform shape: happy path and "not registered" return identical responses', async () => {
    // Happy path
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    const happy = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } });

    // Not-registered path
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockRejectedValueOnce(new Error('not found'));
    const ghost = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'ghost@b.com' } });

    // Self-invite path
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u1' });
    const self = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'me@b.com' } });

    // Already-editor path
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    const dup = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'dup@b.com' } });

    expect(happy).toEqual({ success: true });
    expect(ghost).toEqual({ success: true });
    expect(self).toEqual({ success: true });
    expect(dup).toEqual({ success: true });
    // Shape strictly identical — no extra fields leak which path was taken
    expect(Object.keys(happy as object).sort()).toEqual(['success']);
    expect(Object.keys(ghost as object).sort()).toEqual(['success']);
    expect(Object.keys(self as object).sort()).toEqual(['success']);
    expect(Object.keys(dup as object).sort()).toEqual(['success']);
  });

  it('calls checkCallableRateLimit with correct key and limit', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } });
    expect(mockCheckCallableRateLimit).toHaveBeenCalledWith(mockDb, 'editors_invite_u1', 10, 'u1');
  });

  it('rejects with resource-exhausted when rate limited', async () => {
    mockCheckCallableRateLimit.mockRejectedValueOnce(
      Object.assign(new Error('Limite diario alcanzado. Intenta manana.'), { code: 'resource-exhausted' }),
    );
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } }))
      .rejects.toThrow('Limite diario alcanzado');
  });
});
