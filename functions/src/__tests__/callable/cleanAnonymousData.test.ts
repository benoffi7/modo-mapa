import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock setup ---

const {
  mockRateLimitGet,
  mockRateLimitSet,
  mockAuditAdd,
  mockGetDb,
  mockDeleteAllUserData,
  mockRevokeRefreshTokens,
  mockLogAbuse,
  mockLoggerWarn,
  mockLoggerError,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockRateLimitGet: vi.fn(),
  mockRateLimitSet: vi.fn().mockResolvedValue(undefined),
  mockAuditAdd: vi.fn().mockResolvedValue({ id: 'audit1' }),
  mockGetDb: vi.fn(),
  mockDeleteAllUserData: vi.fn(),
  mockRevokeRefreshTokens: vi.fn(),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

// db: rate limit doc + deletionAuditLogs collection.
const mockDb = {
  doc: vi.fn(() => ({ get: mockRateLimitGet, set: mockRateLimitSet })),
  collection: vi.fn(() => ({ add: mockAuditAdd })),
};

mockGetDb.mockReturnValue(mockDb);

vi.mock('../../helpers/env', () => ({
  IS_EMULATOR: true,
  ENFORCE_APP_CHECK: false,
  getDb: (...args: unknown[]) => mockGetDb(...args),
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

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    revokeRefreshTokens: (...args: unknown[]) => mockRevokeRefreshTokens(...args),
  }),
}));

vi.mock('firebase-functions', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

vi.mock('../../utils/deleteUserData', () => ({
  deleteAllUserData: (...args: unknown[]) => mockDeleteAllUserData(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
}));

vi.mock('../../shared/userOwnedCollections', () => ({
  USER_OWNED_COLLECTIONS: ['places', 'ratings', 'lists', 'checkins', 'feedback'],
}));

import { cleanAnonymousData } from '../../callable/cleanAnonymousData';

const handler = cleanAnonymousData as unknown as (req: unknown) => Promise<unknown>;

// --- Helpers ---

function makeAnonRequest(uid = 'anon-uid-123', data: unknown = {}) {
  return {
    auth: { uid, token: { /* no email = anonymous */ } },
    data,
  };
}

function makeEmailRequest(uid = 'user-1', email = 'user@test.com') {
  return {
    auth: { uid, token: { email } },
    data: {},
  };
}

function happyDeleteResult() {
  return {
    collectionsProcessed: 5,
    collectionsFailed: [],
    storageFilesDeleted: 3,
    storageFilesFailed: 0,
    aggregatesCorrected: true,
    durationMs: 250,
  };
}

function getAuditLogPayload(): Record<string, unknown> | undefined {
  const call = mockAuditAdd.mock.calls[0];
  return call ? (call[0] as Record<string, unknown>) : undefined;
}

// --- Tests ---

describe('cleanAnonymousData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no prior rate limit
    mockRateLimitGet.mockResolvedValue({ exists: false });
    // Default: clean delete result
    mockDeleteAllUserData.mockResolvedValue(happyDeleteResult());
    // Default: revoke succeeds
    mockRevokeRefreshTokens.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue(mockDb);
  });

  // ── Preconditions ──

  it('throws unauthenticated when no auth', async () => {
    await expect(handler({ data: {} })).rejects.toThrow('Must be signed in');
  });

  it('throws unauthenticated when auth is null', async () => {
    await expect(handler({ auth: null, data: {} })).rejects.toThrow('Must be signed in');
  });

  it('rejects email accounts (only anonymous can use this endpoint)', async () => {
    await expect(handler(makeEmailRequest())).rejects.toThrow('Use deleteUserAccount for email accounts');
  });

  // ── Rate limit ──

  it('blocks rapid requests within 60s window', async () => {
    const recentDate = new Date(Date.now() - 10_000); // 10s ago
    mockRateLimitGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ lastAttempt: { toDate: () => recentDate } }),
    });
    await expect(handler(makeAnonRequest())).rejects.toThrow('Please wait before retrying');
    expect(mockDeleteAllUserData).not.toHaveBeenCalled();
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('allows requests after 60s window expires', async () => {
    const oldDate = new Date(Date.now() - 120_000); // 2 min ago
    mockRateLimitGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ lastAttempt: { toDate: () => oldDate } }),
    });
    const result = await handler(makeAnonRequest());
    expect(result).toEqual({ success: true });
  });

  // ── Happy path ──

  it('happy path: revoke OK + audit log with tokensRevoked: true', async () => {
    const uid = 'anon-happy';
    const result = await handler(makeAnonRequest(uid));
    expect(result).toEqual({ success: true });

    // revokeRefreshTokens called with the uid
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith(uid);

    // Audit log entry includes tokensRevoked: true and NO tokensRevokedError
    const audit = getAuditLogPayload();
    expect(audit).toBeDefined();
    expect(audit!.tokensRevoked).toBe(true);
    expect(audit!).not.toHaveProperty('tokensRevokedError');
    expect(audit!.type).toBe('anonymous_clean');
    expect(audit!.status).toBe('success');
    // uidHash hashed (never plain uid)
    expect(audit!.uidHash).toMatch(/^[a-f0-9]{12}$/);
    expect(audit!.uidHash).not.toBe(uid);
  });

  it('happy path: deleteAllUserData called with db and uid', async () => {
    const uid = 'anon-x';
    await handler(makeAnonRequest(uid));
    expect(mockDeleteAllUserData).toHaveBeenCalledWith(mockDb, uid);
  });

  // ── revoke fail (defense-in-depth) ──

  it('revoke fails: logger.warn called, audit log has tokensRevoked: false + tokensRevokedError', async () => {
    const uid = 'anon-revoke-fail';
    mockRevokeRefreshTokens.mockRejectedValueOnce(new Error('auth/internal-error'));

    const result = await handler(makeAnonRequest(uid));
    // Flow continua sin throw — best-effort
    expect(result).toEqual({ success: true });

    // logger.warn was called for revoke failure
    expect(mockLoggerWarn).toHaveBeenCalled();
    const warnCall = mockLoggerWarn.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('Failed to revoke refresh tokens'),
    );
    expect(warnCall).toBeDefined();
    const warnPayload = warnCall![1] as { uidHash: string; error: string };
    expect(warnPayload.uidHash).toMatch(/^[a-f0-9]{12}$/);
    expect(warnPayload.error).toContain('auth/internal-error');
    // uid plano nunca debe aparecer en el log
    expect(warnPayload.uidHash).not.toBe(uid);

    // Audit log entry: tokensRevoked: false + tokensRevokedError set
    const audit = getAuditLogPayload();
    expect(audit).toBeDefined();
    expect(audit!.tokensRevoked).toBe(false);
    expect(audit!.tokensRevokedError).toBeDefined();
    expect(String(audit!.tokensRevokedError)).toContain('auth/internal-error');
  });

  it('revoke fails: deleteAllUserData still completes (does NOT block flow)', async () => {
    mockRevokeRefreshTokens.mockRejectedValueOnce(new Error('boom'));
    const result = await handler(makeAnonRequest());
    expect(result).toEqual({ success: true });
    expect(mockDeleteAllUserData).toHaveBeenCalled();
  });

  // ── Audit log payload ──

  it('audit log includes all delete result fields', async () => {
    mockDeleteAllUserData.mockResolvedValueOnce({
      collectionsProcessed: 7,
      collectionsFailed: [],
      storageFilesDeleted: 12,
      storageFilesFailed: 1,
      aggregatesCorrected: true,
      durationMs: 4321,
    });

    await handler(makeAnonRequest());

    const audit = getAuditLogPayload();
    expect(audit).toBeDefined();
    expect(audit!.collectionsProcessed).toBe(7);
    expect(audit!.storageFilesDeleted).toBe(12);
    expect(audit!.storageFilesFailed).toBe(1);
    expect(audit!.durationMs).toBe(4321);
    expect(audit!.triggeredBy).toBe('user');
    expect(audit!.tokensRevoked).toBe(true);
  });

  it('audit log status is "partial_failure" when some collections fail', async () => {
    mockDeleteAllUserData.mockResolvedValueOnce({
      collectionsProcessed: 5,
      collectionsFailed: ['places', 'ratings'],
      storageFilesDeleted: 1,
      storageFilesFailed: 0,
      aggregatesCorrected: true,
      durationMs: 100,
    });

    await handler(makeAnonRequest());

    const audit = getAuditLogPayload();
    expect(audit!.status).toBe('partial_failure');
    // logAbuse called on non-success status
    expect(mockLogAbuse).toHaveBeenCalled();
  });

  it('audit log status is "failure" when all collections fail', async () => {
    // USER_OWNED_COLLECTIONS mock has 5 entries; matching all = total failure
    mockDeleteAllUserData.mockResolvedValueOnce({
      collectionsProcessed: 0,
      collectionsFailed: ['places', 'ratings', 'lists', 'checkins', 'feedback'],
      storageFilesDeleted: 0,
      storageFilesFailed: 5,
      aggregatesCorrected: false,
      durationMs: 50,
    });

    await handler(makeAnonRequest());

    const audit = getAuditLogPayload();
    expect(audit!.status).toBe('failure');
    expect(mockLogAbuse).toHaveBeenCalled();
  });
});
