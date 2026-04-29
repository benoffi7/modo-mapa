import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockAssertAdmin,
  mockGetUser,
  mockSetCustomUserClaims,
  mockIsEmulator,
  mockBootstrapDocGet,
  mockBootstrapDocSet,
  mockLoggerInfo,
  mockLoggerError,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: unknown) => Promise<unknown>) | null>,
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockGetUser: vi.fn(),
  mockSetCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  mockIsEmulator: { value: false },
  mockBootstrapDocGet: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
  mockBootstrapDocSet: vi.fn().mockResolvedValue(undefined),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

const callIndex = vi.hoisted(() => ({ value: 0 }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, fn: (request: unknown) => Promise<unknown>) => {
    const names = ['setAdminClaim', 'removeAdminClaim'];
    handlers[names[callIndex.value++]] = fn;
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

vi.mock('firebase-functions/v2', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

vi.mock('firebase-functions/params', () => ({
  defineString: vi.fn().mockReturnValue({ value: () => 'admin@test.com' }),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: (path: string) => {
      // El handler solo escribe/lee `config/bootstrap`. Si llegan otros paths,
      // mantener interfaz consistente (los tests no deberian gatillarlos).
      if (path === 'config/bootstrap') {
        return { get: mockBootstrapDocGet, set: mockBootstrapDocSet };
      }
      return { get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() };
    },
  }),
  FieldValue: {
    serverTimestamp: () => 'SERVER_TS',
  },
}));

vi.mock('../../helpers/env', () => ({
  get IS_EMULATOR() { return mockIsEmulator.value; },
  ENFORCE_APP_CHECK_ADMIN: false,
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

import '../../admin/claims';

describe('setAdminClaim', () => {
  const handler = () => handlers.setAdminClaim!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEmulator.value = false;
    // Restore default behavior post-clearAllMocks (clearAllMocks resetea
    // implementations en vitest 4.x). Default: flag NO existe + writes resuelven.
    mockBootstrapDocGet.mockResolvedValue({ exists: false, data: () => undefined });
    mockBootstrapDocSet.mockResolvedValue(undefined);
  });

  it('throws on missing targetUid', async () => {
    await expect(handler()({ auth: { uid: 'admin1', token: { admin: true } }, data: {} }))
      .rejects.toThrow('targetUid required');
  });

  it('throws when not admin and not bootstrap in production', async () => {
    mockIsEmulator.value = false;
    await expect(handler()({
      auth: { uid: 'user1', token: { email: 'other@test.com', email_verified: true } },
      data: { targetUid: 'target1' },
    })).rejects.toThrow('Not authorized');
  });

  it('allows existing admin to set claims', async () => {
    mockIsEmulator.value = false;
    mockGetUser.mockResolvedValueOnce({ customClaims: { someOther: true } });

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith(
      'target1',
      { someOther: true, admin: true },
    );
  });

  it('allows bootstrap via ADMIN_EMAIL when flag is missing/false and writes flag post-success', async () => {
    mockIsEmulator.value = false;
    mockGetUser.mockResolvedValueOnce({ customClaims: null });
    // Default beforeEach: bootstrap doc no existe (equivalente a adminAssigned: false).

    const result = await handler()({
      auth: {
        uid: 'bootstrap-user',
        token: { email: 'admin@test.com', email_verified: true },
      },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
    // Claim seteado primero
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target1', { admin: true });
    // Flag escrito despues con merge
    expect(mockBootstrapDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        adminAssigned: true,
        assignedTo: 'target1',
        assignedAt: 'SERVER_TS',
      }),
      { merge: true },
    );
    // Logger info incluye via: 'bootstrap'
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Admin claim set',
      expect.objectContaining({ targetUid: 'target1', via: 'bootstrap' }),
    );
  });

  // Fase 5.1 (#322 S5): bootstrap gate via config/bootstrap.adminAssigned
  it('rejects bootstrap path when config/bootstrap.adminAssigned === true', async () => {
    mockIsEmulator.value = false;
    mockBootstrapDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ adminAssigned: true, assignedTo: 'previous-admin' }),
    });

    await expect(handler()({
      auth: {
        uid: 'attacker',
        token: { email: 'admin@test.com', email_verified: true },
      },
      data: { targetUid: 'target1' },
    })).rejects.toThrow('Not authorized');

    // Critico: el claim NO debe haberse seteado
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    expect(mockBootstrapDocSet).not.toHaveBeenCalled();
  });

  it('does NOT write flag when via is existing_admin (not bootstrap)', async () => {
    mockIsEmulator.value = false;
    mockGetUser.mockResolvedValueOnce({ customClaims: { someOther: true } });

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
    // Existing admin path: claim seteado pero flag NO se toca
    expect(mockSetCustomUserClaims).toHaveBeenCalled();
    expect(mockBootstrapDocSet).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Admin claim set',
      expect.objectContaining({ via: 'existing_admin' }),
    );
  });

  it('handler does NOT re-throw when flag write fails post-claim (manual remediation logged)', async () => {
    mockIsEmulator.value = false;
    mockGetUser.mockResolvedValueOnce({ customClaims: null });
    mockBootstrapDocSet.mockRejectedValueOnce(new Error('Firestore unavailable'));

    // CRITICO: el handler debe retornar success aunque el flag write falle
    const result = await handler()({
      auth: {
        uid: 'bootstrap-user',
        token: { email: 'admin@test.com', email_verified: true },
      },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
    // El claim SI quedo seteado
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target1', { admin: true });
    // El flag write fue intentado
    expect(mockBootstrapDocSet).toHaveBeenCalled();
    // logger.error con remediation guardado para ops
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Bootstrap flag write FAILED — manual remediation required',
      expect.objectContaining({
        targetUid: 'target1',
        error: 'Firestore unavailable',
        remediation: expect.stringContaining('reset-bootstrap-admin.md'),
      }),
    );
  });

  it('bypasses auth check in emulator mode', async () => {
    mockIsEmulator.value = true;
    mockGetUser.mockResolvedValueOnce({ customClaims: {} });

    const result = await handler()({
      auth: { uid: 'anyone', token: {} },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
  });

  it('merges with existing custom claims', async () => {
    mockIsEmulator.value = true;
    mockGetUser.mockResolvedValueOnce({ customClaims: { role: 'editor' } });

    await handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { targetUid: 'target1' },
    });

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith(
      'target1',
      { role: 'editor', admin: true },
    );
  });
});

describe('removeAdminClaim', () => {
  const handler = () => handlers.removeAdminClaim!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEmulator.value = false;
  });

  it('throws on missing targetUid', async () => {
    await expect(handler()({ auth: { uid: 'admin1', token: { admin: true } }, data: {} }))
      .rejects.toThrow('targetUid required');
  });

  it('throws when trying to remove own admin claim', async () => {
    mockAssertAdmin.mockReturnValueOnce({ uid: 'admin1', token: { admin: true } });
    await expect(handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { targetUid: 'admin1' },
    })).rejects.toThrow('Cannot remove your own admin claim');
  });

  it('removes admin claim and preserves other claims', async () => {
    mockAssertAdmin.mockReturnValueOnce({ uid: 'admin1', token: { admin: true } });
    mockGetUser.mockResolvedValueOnce({ customClaims: { admin: true, role: 'editor' } });

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target1', { role: 'editor' });
  });

  it('handles user with no existing claims', async () => {
    mockAssertAdmin.mockReturnValueOnce({ uid: 'admin1', token: { admin: true } });
    mockGetUser.mockResolvedValueOnce({ customClaims: null });

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith('target1', {});
  });
});
