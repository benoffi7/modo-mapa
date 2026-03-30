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

  it('throws when target email not found', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockRejectedValueOnce(new Error('not found'));
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'notfound@b.com' } }))
      .rejects.toThrow('No se pudo enviar la invitacion');
  });

  it('throws when inviting self', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u1' });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'me@b.com' } }))
      .rejects.toThrow('No podés invitarte a vos mismo');
  });

  it('throws when user already editor', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'dup@b.com' } }))
      .rejects.toThrow('Este usuario ya es editor');
  });

  it('throws when 5 editors already', async () => {
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

  it('calls checkCallableRateLimit with correct key and limit', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'u2' });
    await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } });
    expect(mockCheckCallableRateLimit).toHaveBeenCalledWith(mockDb, 'editors_invite_u1', 10);
  });

  it('rejects with resource-exhausted when rate limited', async () => {
    mockCheckCallableRateLimit.mockRejectedValueOnce(
      Object.assign(new Error('Limite diario alcanzado. Intenta manana.'), { code: 'resource-exhausted' }),
    );
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } }))
      .rejects.toThrow('Limite diario alcanzado');
  });
});
