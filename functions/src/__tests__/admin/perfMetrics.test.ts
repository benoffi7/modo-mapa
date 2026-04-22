import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handler,
  mockGetFirestore,
  mockTx,
  mockDocSet,
  mockMetricsSet,
} = vi.hoisted(() => {
  const tx = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  };
  const docSet = vi.fn().mockResolvedValue(undefined);
  const metricsSet = vi.fn().mockResolvedValue(undefined);

  return {
    handler: { fn: null as ((request: any) => Promise<any>) | null },
    mockGetFirestore: vi.fn(),
    mockTx: tx,
    mockDocSet: docSet,
    mockMetricsSet: metricsSet,
  };
});

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    handler.fn = fn;
    return fn;
  },
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('SERVER_TS') },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK: false,
  getDb: () => mockGetFirestore(),
}));

import '../../admin/perfMetrics';

function createMockDb(rateLimitData: { count: number; resetAt: number } | undefined = undefined) {
  const snapData = rateLimitData;
  const rateLimitDocRef = { set: mockDocSet };
  const metricsDocRef = { set: mockMetricsSet };

  mockTx.get.mockResolvedValue({
    data: () => snapData,
    exists: snapData !== undefined,
  });

  const mockDocFn = vi.fn().mockImplementation((_col: string, id: string) => {
    if (id?.startsWith?.('perf_')) return rateLimitDocRef;
    return rateLimitDocRef;
  });

  const mockCollectionFn = vi.fn().mockImplementation((name: string) => {
    if (name === 'perfMetrics') {
      return { doc: vi.fn().mockReturnValue(metricsDocRef) };
    }
    return { doc: mockDocFn };
  });

  const db = {
    collection: mockCollectionFn,
    runTransaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx)),
  };

  mockGetFirestore.mockReturnValue(db);
  return db;
}

function makeRequest(overrides: Partial<any> = {}) {
  return {
    auth: { uid: 'user1' },
    data: {
      sessionId: 'session-abc',
      vitals: { LCP: 2000, FID: 100 },
      queries: { fetchBusinesses: { p50: 300, p95: 800, count: 5 } },
      device: { type: 'mobile', connection: '4g' },
      appVersion: '2.35.7',
    },
    ...overrides,
  };
}

describe('writePerfMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws unauthenticated when request.auth is null', async () => {
    createMockDb();
    const req = makeRequest({ auth: null });
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('throws invalid-argument when sessionId is missing', async () => {
    createMockDb();
    const req = makeRequest({ data: { ...makeRequest().data, sessionId: undefined } });
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when sessionId is not a string', async () => {
    createMockDb();
    const req = makeRequest({ data: { ...makeRequest().data, sessionId: 42 } });
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when vitals is missing', async () => {
    createMockDb();
    const req = makeRequest({ data: { ...makeRequest().data, vitals: undefined } });
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when appVersion is not a string', async () => {
    createMockDb();
    const req = makeRequest({ data: { ...makeRequest().data, appVersion: 12345 } });
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when appVersion is too long (>20 chars)', async () => {
    createMockDb();
    const req = makeRequest({ data: { ...makeRequest().data, appVersion: 'a'.repeat(21) } });
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws resource-exhausted when rate limit count >= MAX_WRITES_PER_DAY', async () => {
    createMockDb({ count: 5, resetAt: Date.now() + 3600_000 }); // count=5 >= 5, window active
    const req = makeRequest();
    await expect(handler.fn!(req)).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  it('happy path: sets tx with count:1 and writes perfMetrics doc for new user', async () => {
    // No existing rate limit doc (first write)
    mockTx.get.mockResolvedValue({ data: () => undefined, exists: false });
    const db = createMockDb();
    // Re-configure db so that runTransaction works correctly with our mocks
    mockGetFirestore.mockReturnValue({
      ...db,
      collection: vi.fn().mockImplementation((name: string) => {
        if (name === 'perfMetrics') {
          return { doc: vi.fn().mockReturnValue({ set: mockMetricsSet }) };
        }
        return { doc: vi.fn().mockReturnValue({ set: mockDocSet }) };
      }),
      runTransaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        mockTx.get.mockResolvedValue({ data: () => undefined, exists: false });
        return fn(mockTx);
      }),
    });

    const req = makeRequest();
    const result = await handler.fn!(req);
    expect(result).toEqual({ success: true });
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ count: 1, userId: 'user1' }),
    );
    expect(mockMetricsSet).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-abc',
        userId: 'user1',
        vitals: { LCP: 2000, FID: 100 },
      }),
    );
  });

  it('updates count via tx.update when rate limit doc exists and window is active', async () => {
    const resetAt = Date.now() + 3600_000;
    mockTx.get.mockResolvedValue({
      data: () => ({ count: 2, resetAt }),
      exists: true,
    });
    mockGetFirestore.mockReturnValue({
      collection: vi.fn().mockImplementation((name: string) => {
        if (name === 'perfMetrics') {
          return { doc: vi.fn().mockReturnValue({ set: mockMetricsSet }) };
        }
        return { doc: vi.fn().mockReturnValue({ set: mockDocSet }) };
      }),
      runTransaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx)),
    });

    const req = makeRequest();
    const result = await handler.fn!(req);
    expect(result).toEqual({ success: true });
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ count: 3 }),
    );
  });

  it('queries and device default to empty objects when omitted', async () => {
    mockTx.get.mockResolvedValue({ data: () => undefined, exists: false });
    mockGetFirestore.mockReturnValue({
      collection: vi.fn().mockImplementation((name: string) => {
        if (name === 'perfMetrics') {
          return { doc: vi.fn().mockReturnValue({ set: mockMetricsSet }) };
        }
        return { doc: vi.fn().mockReturnValue({ set: mockDocSet }) };
      }),
      runTransaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx)),
    });

    const req = makeRequest({
      data: {
        sessionId: 'sess1',
        vitals: { LCP: 1000 },
        appVersion: '2.0.0',
        // queries and device omitted
      },
    });
    const result = await handler.fn!(req);
    expect(result).toEqual({ success: true });
    expect(mockMetricsSet).toHaveBeenCalledWith(
      expect.objectContaining({ queries: {}, device: {} }),
    );
  });
});
