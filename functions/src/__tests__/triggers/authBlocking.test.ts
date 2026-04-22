import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handler,
  mockCheckIpRateLimit,
  mockGetIpActionCount,
  mockHashIp,
  mockLogAbuse,
  mockUserSettingsSet,
  mockGetDb,
} = vi.hoisted(() => ({
  handler: { current: null as null | ((event: unknown) => Promise<unknown>) },
  mockCheckIpRateLimit: vi.fn().mockResolvedValue(false),
  mockGetIpActionCount: vi.fn().mockResolvedValue(0),
  mockHashIp: vi.fn().mockReturnValue('hashed-ip'),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockUserSettingsSet: vi.fn().mockResolvedValue(undefined),
  mockGetDb: vi.fn(),
}));

vi.mock('firebase-functions/v2/identity', () => ({
  beforeUserCreated: (cb: (event: unknown) => Promise<unknown>) => {
    handler.current = cb;
    return cb;
  },
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__ts__' },
}));

vi.mock('firebase-functions', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../helpers/env', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('../../utils/ipRateLimiter', () => ({
  checkIpRateLimit: (...args: unknown[]) => mockCheckIpRateLimit(...args),
  getIpActionCount: (...args: unknown[]) => mockGetIpActionCount(...args),
  hashIp: (...args: unknown[]) => mockHashIp(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
}));

vi.mock('../../constants/ipRateLimits', () => ({
  MAX_ANON_CREATES_PER_IP_PER_DAY: 10,
  ANON_FLOOD_ALERT_THRESHOLD: 5,
}));

import '../../triggers/authBlocking';

function setupDb() {
  const dbDoc = { set: mockUserSettingsSet };
  const db = {
    doc: vi.fn().mockReturnValue(dbDoc),
  };
  mockGetDb.mockReturnValue(db);
  return { db, dbDoc };
}

describe('onBeforeUserCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckIpRateLimit.mockResolvedValue(false);
    mockGetIpActionCount.mockResolvedValue(0);
    mockHashIp.mockReturnValue('hashed-ip');
  });

  it('seeds userSettings with profilePublic:false for anonymous creates', async () => {
    setupDb();
    await handler.current?.({
      ipAddress: '10.0.0.1',
      data: { uid: 'anon1' },
      additionalUserInfo: { providerId: 'anonymous' },
    });

    expect(mockUserSettingsSet).toHaveBeenCalledWith(
      expect.objectContaining({ profilePublic: false }),
      { merge: true },
    );
  });

  it('seeds userSettings for email sign-ups too (no IP rate-limit branch)', async () => {
    const { db } = setupDb();
    await handler.current?.({
      ipAddress: '10.0.0.1',
      data: { uid: 'email1' },
      additionalUserInfo: { providerId: 'google.com' },
    });

    // Rate limit MUST NOT be invoked for non-anonymous
    expect(mockCheckIpRateLimit).not.toHaveBeenCalled();
    expect(db.doc).toHaveBeenCalledWith('userSettings/email1');
    expect(mockUserSettingsSet).toHaveBeenCalled();
  });

  it('does not seed when uid is missing (defensive)', async () => {
    setupDb();
    await handler.current?.({
      ipAddress: '10.0.0.1',
      data: undefined,
      additionalUserInfo: { providerId: 'anonymous' },
    });

    expect(mockUserSettingsSet).not.toHaveBeenCalled();
  });

  it('blocks anonymous accounts when IP rate limit exceeded', async () => {
    setupDb();
    mockCheckIpRateLimit.mockResolvedValueOnce(true);

    await expect(handler.current?.({
      ipAddress: '10.0.0.1',
      data: { uid: 'anon2' },
      additionalUserInfo: { providerId: 'anonymous' },
    })).rejects.toThrow('Too many accounts created from this network.');

    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ severity: 'high', type: 'anon_flood' }),
    );
    // seed should NOT happen when we throw
    expect(mockUserSettingsSet).not.toHaveBeenCalled();
  });

  it('logs medium-severity warning at threshold but allows creation', async () => {
    setupDb();
    mockGetIpActionCount.mockResolvedValueOnce(6); // over ANON_FLOOD_ALERT_THRESHOLD (5)

    await handler.current?.({
      ipAddress: '10.0.0.1',
      data: { uid: 'anon3' },
      additionalUserInfo: { providerId: 'anonymous' },
    });

    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ severity: 'medium' }),
    );
    expect(mockUserSettingsSet).toHaveBeenCalled();
  });

  it('best-effort seed: logs error and returns success if set() throws', async () => {
    mockUserSettingsSet.mockRejectedValueOnce(new Error('firestore outage'));
    setupDb();

    // Should not throw even when seed fails
    await expect(handler.current?.({
      ipAddress: '10.0.0.1',
      data: { uid: 'anon4' },
      additionalUserInfo: { providerId: 'anonymous' },
    })).resolves.toBeUndefined();
  });

  it('still runs rate-limit when IP present for anonymous providers', async () => {
    setupDb();
    await handler.current?.({
      ipAddress: '10.0.0.1',
      data: { uid: 'anon5' },
      additionalUserInfo: { providerId: 'anonymous' },
    });

    expect(mockCheckIpRateLimit).toHaveBeenCalled();
    expect(mockGetIpActionCount).toHaveBeenCalled();
  });

  it('skips rate-limit when anonymous but no IP', async () => {
    setupDb();
    await handler.current?.({
      ipAddress: undefined,
      data: { uid: 'anon6' },
      additionalUserInfo: { providerId: 'anonymous' },
    });

    expect(mockCheckIpRateLimit).not.toHaveBeenCalled();
    // but seed still runs
    expect(mockUserSettingsSet).toHaveBeenCalled();
  });
});
