import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockAssertAdmin,
  mockGetUser,
  mockSetCustomUserClaims,
  mockIsEmulator,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: unknown) => Promise<unknown>) | null>,
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockGetUser: vi.fn(),
  mockSetCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  mockIsEmulator: { value: false },
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
  logger: { info: vi.fn(), warn: vi.fn() },
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

  it('allows bootstrap via ADMIN_EMAIL', async () => {
    mockIsEmulator.value = false;
    mockGetUser.mockResolvedValueOnce({ customClaims: null });

    const result = await handler()({
      auth: {
        uid: 'bootstrap-user',
        token: { email: 'admin@test.com', email_verified: true },
      },
      data: { targetUid: 'target1' },
    });

    expect(result).toEqual({ success: true });
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
