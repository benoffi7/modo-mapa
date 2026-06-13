import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetDb,
  mockAssertAdmin,
  mockCheckCallableRateLimit,
  mockLogAbuse,
  mockCaptureException,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: any) => Promise<any>) | null>,
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCheckCallableRateLimit: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCaptureException: vi.fn(),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

const callIndex = vi.hoisted(() => ({ value: 0 }));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    const names = ['adminListIpRateLimits', 'adminResetIpRateLimit'];
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
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: () => mockGetDb(),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: any[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/callableRateLimit', () => ({
  checkCallableRateLimit: (...args: any[]) => mockCheckCallableRateLimit(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: any[]) => mockLogAbuse(...args),
}));

vi.mock('../../utils/sentry', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: any[]) => mockTrackFunctionTiming(...args),
}));

function createQueryMockDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const snapDocs = docs.map((d) => ({ id: d.id, data: () => d.data }));
  const snap = { docs: snapDocs };

  const limitMock = vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(snap),
  });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const collectionMock = vi.fn().mockReturnValue({
    orderBy: orderByMock,
    where: whereMock,
    doc: vi.fn(),
  });
  const db = { collection: collectionMock };
  mockGetDb.mockReturnValue(db);
  return { db, collectionMock, orderByMock, whereMock, limitMock };
}

function createDocMockDb(options: { exists: boolean; data?: Record<string, unknown> }) {
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = {
    get: vi.fn().mockResolvedValue({
      exists: options.exists,
      data: () => options.data ?? {},
      id: 'some-doc-id',
    }),
    delete: mockDelete,
  };
  const collectionMock = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue(mockDocRef),
  });
  const db = { collection: collectionMock };
  mockGetDb.mockReturnValue(db);
  return { db, mockDelete, mockDocRef, collectionMock };
}

import { parseIpRateLimitDocId } from '../ipRateLimits';
import '../ipRateLimits';

const today = new Date().toISOString().slice(0, 10);

describe('parseIpRateLimitDocId', () => {
  it('parses docId with a multi-segment action (anon_create)', () => {
    // A naive split on `_` would fail here — `action` contains an underscore.
    expect(parseIpRateLimitDocId('a1b2c3d4e5f60718_anon_create_2026-06-10')).toEqual({
      ipHash: 'a1b2c3d4e5f60718',
      action: 'anon_create',
      date: '2026-06-10',
    });
  });

  it('parses docId with a single-segment action', () => {
    expect(parseIpRateLimitDocId('a1b2c3d4e5f60718_login_2026-06-10')).toEqual({
      ipHash: 'a1b2c3d4e5f60718',
      action: 'login',
      date: '2026-06-10',
    });
  });
});

describe('adminListIpRateLimits', () => {
  const handler = () => handlers.adminListIpRateLimits!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
  });

  it('rejects non-admin users', async () => {
    createQueryMockDb([]);
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(handler()({ auth: { uid: 'user1' }, data: {} })).rejects.toThrow('Admin only');
  });

  it('rejects invalid action', async () => {
    createQueryMockDb([]);
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { action: 'BAD ACTION!!' } }),
    ).rejects.toThrow('action must be a valid action string');
  });

  it('rejects invalid ipHash (rejects raw IP)', async () => {
    createQueryMockDb([]);
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { ipHash: '192.168.0.1' } }),
    ).rejects.toThrow('ipHash must be 16 hex chars');
  });

  it('rejects non-numeric limit', async () => {
    createQueryMockDb([]);
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { limit: 'not-a-number' } }),
    ).rejects.toThrow('limit must be a number');
  });

  it('clamps limit into [1, 100] range', async () => {
    const { limitMock } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: { limit: 500 } });
    expect(limitMock).toHaveBeenCalledWith(100);

    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
    const { limitMock: limitMock2 } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: { limit: 0 } });
    expect(limitMock2).toHaveBeenCalledWith(1);
  });

  it('defaults limit to 50 when omitted', async () => {
    const { limitMock } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it('checks callable rate limit (admin_ip_rate_limits_{uid}, 30)', async () => {
    createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(mockCheckCallableRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'admin_ip_rate_limits_admin1',
      30,
      'admin1',
    );
  });

  it('propagates rate limit rejection', async () => {
    createQueryMockDb([]);
    mockCheckCallableRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow(
      'Rate limit exceeded',
    );
  });

  it('maps docs with windowActive true (date==today) and false', async () => {
    createQueryMockDb([
      { id: 'aaaaaaaaaaaaaaaa_anon_create_' + today, data: { ipHash: 'aaaaaaaaaaaaaaaa', action: 'anon_create', date: today, count: 9 } },
      { id: 'bbbbbbbbbbbbbbbb_anon_create_2000-01-01', data: { ipHash: 'bbbbbbbbbbbbbbbb', action: 'anon_create', date: '2000-01-01', count: 3 } },
    ]);

    const result = await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      ipHash: 'aaaaaaaaaaaaaaaa',
      action: 'anon_create',
      count: 9,
      windowActive: true,
    });
    expect(result.items[1]).toMatchObject({
      ipHash: 'bbbbbbbbbbbbbbbb',
      count: 3,
      windowActive: false,
    });
  });

  it('uses orderBy(date desc) when no filter', async () => {
    const { orderByMock, whereMock } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(orderByMock).toHaveBeenCalledWith('date', 'desc');
    expect(whereMock).not.toHaveBeenCalled();
  });

  it('uses where(action) filter and skips orderBy', async () => {
    const { whereMock, orderByMock } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: { action: 'anon_create' } });
    expect(whereMock).toHaveBeenCalledWith('action', '==', 'anon_create');
    expect(orderByMock).not.toHaveBeenCalled();
  });

  it('uses where(ipHash) filter and applies action client-side when both present', async () => {
    const { whereMock, orderByMock } = createQueryMockDb([
      { id: 'aaaaaaaaaaaaaaaa_anon_create_' + today, data: { ipHash: 'aaaaaaaaaaaaaaaa', action: 'anon_create', date: today, count: 1 } },
      { id: 'aaaaaaaaaaaaaaaa_login_' + today, data: { ipHash: 'aaaaaaaaaaaaaaaa', action: 'login', date: today, count: 2 } },
    ]);
    const result = await handler()({
      auth: { uid: 'admin1' },
      data: { ipHash: 'aaaaaaaaaaaaaaaa', action: 'anon_create' },
    });
    expect(whereMock).toHaveBeenCalledWith('ipHash', '==', 'aaaaaaaaaaaaaaaa');
    expect(orderByMock).not.toHaveBeenCalled();
    // Only the matching action survives the client-side filter
    expect(result.items).toHaveLength(1);
    expect(result.items[0].action).toBe('anon_create');
  });

  it('maps to HttpsError(internal) on unexpected error', async () => {
    const limitMock = vi.fn().mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const collectionMock = vi.fn().mockReturnValue({ orderBy: orderByMock, where: vi.fn(), doc: vi.fn() });
    mockGetDb.mockReturnValue({ collection: collectionMock });
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow(
      'No se pudo listar IP rate limits',
    );
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('calls trackFunctionTiming on happy path', async () => {
    createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('adminListIpRateLimits', expect.any(Number));
  });

  it('calls trackFunctionTiming on catch path', async () => {
    const limitMock = vi.fn().mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const collectionMock = vi.fn().mockReturnValue({ orderBy: orderByMock, where: vi.fn(), doc: vi.fn() });
    mockGetDb.mockReturnValue({ collection: collectionMock });
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow();
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('adminListIpRateLimits', expect.any(Number));
  });
});

describe('adminResetIpRateLimit', () => {
  const handler = () => handlers.adminResetIpRateLimit!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
  });

  it('rejects non-admin users', async () => {
    createDocMockDb({ exists: true, data: {} });
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(
      handler()({ auth: { uid: 'user1' }, data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' } }),
    ).rejects.toThrow('Admin only');
  });

  it('rejects missing docId', async () => {
    createDocMockDb({ exists: true });
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow(
      'docId is required',
    );
  });

  it('rejects invalid docId chars', async () => {
    createDocMockDb({ exists: true });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'bad id!!!' } }),
    ).rejects.toThrow('docId contains invalid characters');
  });

  it('throws not-found when doc does not exist', async () => {
    createDocMockDb({ exists: false });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' } }),
    ).rejects.toThrow('IP rate limit doc not found');
  });

  it('checks callable rate limit (admin_ip_rate_limit_reset_{uid}, 20)', async () => {
    createDocMockDb({ exists: true, data: {} });
    await handler()({ auth: { uid: 'admin1' }, data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' } });
    expect(mockCheckCallableRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'admin_ip_rate_limit_reset_admin1',
      20,
      'admin1',
    );
  });

  it('propagates rate limit rejection', async () => {
    createDocMockDb({ exists: true });
    mockCheckCallableRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' } }),
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('deletes doc and writes abuseLog with type config_edit + parsed detail', async () => {
    const { mockDelete } = createDocMockDb({
      exists: true,
      data: { ipHash: 'aaaaaaaaaaaaaaaa', action: 'anon_create', date: '2026-06-10', count: 9 },
    });
    const result = await handler()({
      auth: { uid: 'admin1' },
      data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' },
    });
    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'admin1',
        type: 'config_edit',
        collection: '_ipRateLimits',
      }),
    );
    const logCall = mockLogAbuse.mock.calls[0][1] as { detail: string };
    const detail = JSON.parse(logCall.detail);
    expect(detail).toMatchObject({
      action: 'reset_ip_rate_limit',
      docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10',
      ipHash: 'aaaaaaaaaaaaaaaa',
      ipAction: 'anon_create',
    });
  });

  it('calls trackFunctionTiming on happy path', async () => {
    createDocMockDb({ exists: true, data: {} });
    await handler()({ auth: { uid: 'admin1' }, data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' } });
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('adminResetIpRateLimit', expect.any(Number));
  });

  it('calls trackFunctionTiming on catch path (not-found)', async () => {
    createDocMockDb({ exists: false });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' } }),
    ).rejects.toThrow();
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('adminResetIpRateLimit', expect.any(Number));
  });
});
