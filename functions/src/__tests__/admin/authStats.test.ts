import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handler,
  mockListUsers,
  mockAdminEmailValue,
} = vi.hoisted(() => ({
  handler: { fn: null as ((request: unknown) => Promise<unknown>) | null },
  mockListUsers: vi.fn(),
  mockAdminEmailValue: vi.fn().mockReturnValue('admin@test.com'),
}));

// Mock firebase-functions/v2/https
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, fn: (request: unknown) => Promise<unknown>) => {
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

// Mock firebase-functions/v2
vi.mock('firebase-functions/v2', () => ({
  logger: { error: vi.fn() },
}));

// Mock firebase-functions/params
vi.mock('firebase-functions/params', () => ({
  defineString: () => ({ value: mockAdminEmailValue }),
}));

// Mock firebase-admin/auth
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ listUsers: mockListUsers }),
}));

// Mock sentry
vi.mock('../../utils/sentry', () => ({
  captureException: vi.fn(),
}));

// Import to trigger handler registration
import '../../admin/authStats';

function makeRequest(email: string, emailVerified: boolean) {
  return {
    auth: {
      uid: 'admin-uid',
      token: { email, email_verified: emailVerified },
    },
  };
}

function makeUserRecord(
  uid: string,
  providers: string[],
  opts: { email?: string; emailVerified?: boolean; displayName?: string } = {},
) {
  return {
    uid,
    email: opts.email,
    emailVerified: opts.emailVerified ?? false,
    displayName: opts.displayName ?? null,
    providerData: providers.map((id) => ({ providerId: id })),
    metadata: { creationTime: '2026-01-01T00:00:00Z' },
  };
}

describe('getAuthStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin users', async () => {
    const request = makeRequest('other@test.com', true);
    await expect(handler.fn!(request)).rejects.toThrow('Solo admin');
  });

  it('rejects unverified admin email', async () => {
    const request = makeRequest('admin@test.com', false);
    await expect(handler.fn!(request)).rejects.toThrow('Email no verificado');
  });

  it('classifies anonymous users correctly', async () => {
    mockListUsers.mockResolvedValueOnce({
      users: [makeUserRecord('u1', [])],
      pageToken: undefined,
    });

    const result = await handler.fn!(makeRequest('admin@test.com', true));
    const data = result as { byMethod: { anonymous: number; email: number } };
    expect(data.byMethod.anonymous).toBe(1);
    expect(data.byMethod.email).toBe(0);
  });

  it('classifies email users correctly', async () => {
    mockListUsers.mockResolvedValueOnce({
      users: [
        makeUserRecord('u1', ['password'], { email: 'user@test.com', emailVerified: true }),
      ],
      pageToken: undefined,
    });

    const result = await handler.fn!(makeRequest('admin@test.com', true));
    const data = result as {
      byMethod: { anonymous: number; email: number };
      emailVerification: { verified: number; unverified: number };
    };
    expect(data.byMethod.email).toBe(1);
    expect(data.emailVerification.verified).toBe(1);
  });

  it('excludes admin from stats', async () => {
    mockListUsers.mockResolvedValueOnce({
      users: [
        makeUserRecord('admin', ['password'], { email: 'admin@test.com' }),
        makeUserRecord('u1', []),
      ],
      pageToken: undefined,
    });

    const result = await handler.fn!(makeRequest('admin@test.com', true));
    const data = result as { users: unknown[] };
    expect(data.users).toHaveLength(1);
  });

  it('handles pagination', async () => {
    mockListUsers
      .mockResolvedValueOnce({
        users: [makeUserRecord('u1', [])],
        pageToken: 'next',
      })
      .mockResolvedValueOnce({
        users: [makeUserRecord('u2', ['password'], { email: 'u2@test.com' })],
        pageToken: undefined,
      });

    const result = await handler.fn!(makeRequest('admin@test.com', true));
    const data = result as { byMethod: { anonymous: number; email: number } };
    expect(data.byMethod.anonymous).toBe(1);
    expect(data.byMethod.email).toBe(1);
  });
});
