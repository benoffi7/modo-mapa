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
const mockUsersGet = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: () => ({ get: mockGet, update: mockUpdate }),
    collection: () => ({ where: () => ({ limit: () => ({ get: mockUsersGet }) }) }),
  }),
  FieldValue: {
    arrayUnion: vi.fn((v: string) => ({ __arrayUnion: v })),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
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
    mockUsersGet.mockResolvedValueOnce({ empty: true });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'notfound@b.com' } }))
      .rejects.toThrow('Usuario no encontrado');
  });

  it('throws when inviting self', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockUsersGet.mockResolvedValueOnce({ empty: false, docs: [{ id: 'u1' }] });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'me@b.com' } }))
      .rejects.toThrow('No podés invitarte a vos mismo');
  });

  it('throws when user already editor', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['u2'] }) });
    mockUsersGet.mockResolvedValueOnce({ empty: false, docs: [{ id: 'u2' }] });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'dup@b.com' } }))
      .rejects.toThrow('Este usuario ya es editor');
  });

  it('throws when 5 editors already', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: ['a', 'b', 'c', 'd', 'e'] }) });
    mockUsersGet.mockResolvedValueOnce({ empty: false, docs: [{ id: 'newuser' }] });
    await expect(handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'new@b.com' } }))
      .rejects.toThrow('Máximo 5 editores por lista');
  });

  it('succeeds and returns targetUid', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ ownerId: 'u1', editorIds: [] }) });
    mockUsersGet.mockResolvedValueOnce({ empty: false, docs: [{ id: 'u2' }] });
    const result = await handler({ auth: { uid: 'u1' }, data: { listId: 'l1', targetEmail: 'friend@b.com' } });
    expect(result).toEqual({ success: true, targetUid: 'u2' });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
