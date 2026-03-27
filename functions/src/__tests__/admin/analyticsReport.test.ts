import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const {
  handler,
  mockAssertAdmin,
  mockGetDb,
  mockRunReport,
} = vi.hoisted(() => ({
  handler: { fn: null as ((request: unknown) => Promise<unknown>) | null },
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockGetDb: vi.fn(),
  mockRunReport: vi.fn(),
}));

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

vi.mock('firebase-functions/v2', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@google-analytics/data', () => {
  class MockBetaAnalyticsDataClient {
    runReport = mockRunReport;
  }
  return { BetaAnalyticsDataClient: MockBetaAnalyticsDataClient };
});

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/sentry', () => ({
  captureException: vi.fn(),
}));

function createMockDb(cacheData?: { events: unknown[]; cachedAt: string } | null) {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const cacheExists = cacheData !== null && cacheData !== undefined;

  const mockDocRef = {
    get: vi.fn().mockResolvedValue({
      exists: cacheExists,
      data: () => cacheData,
    }),
    set: mockSet,
  };

  const db = {
    doc: vi.fn().mockReturnValue(mockDocRef),
  };
  mockGetDb.mockReturnValue(db);

  return { db, mockSet, mockDocRef };
}

import '../../admin/analyticsReport';

describe('getAnalyticsReport', () => {
  const originalEnv = process.env.GA4_PROPERTY_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GA4_PROPERTY_ID = '123456';
  });

  afterAll(() => {
    process.env.GA4_PROPERTY_ID = originalEnv;
  });

  it('handler is registered', () => {
    expect(handler.fn).not.toBeNull();
  });

  it('throws when GA4_PROPERTY_ID not configured', async () => {
    delete process.env.GA4_PROPERTY_ID;
    createMockDb(null);

    await expect(handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    })).rejects.toThrow('GA4_PROPERTY_ID not configured');
  });

  it('returns cached data when cache is fresh', async () => {
    const cachedAt = new Date().toISOString();
    createMockDb({
      events: [{ eventName: 'surprise_me', date: '20260101', eventCount: 5 }],
      cachedAt,
    });

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { events: unknown[]; fromCache: boolean };

    expect(result.fromCache).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it('queries GA4 when cache is expired', async () => {
    const expiredTime = new Date(Date.now() - 4_000_000).toISOString();
    const { mockSet } = createMockDb({
      events: [],
      cachedAt: expiredTime,
    });

    mockRunReport.mockResolvedValueOnce([{
      rows: [
        {
          dimensionValues: [{ value: 'business_view' }, { value: '20260101' }],
          metricValues: [{ value: '42' }],
        },
      ],
    }]);

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { events: Array<{ eventName: string; eventCount: number }>; fromCache: boolean };

    expect(result.fromCache).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventName).toBe('business_view');
    expect(result.events[0].eventCount).toBe(42);
    expect(mockSet).toHaveBeenCalled();
  });

  it('queries GA4 when no cache exists', async () => {
    createMockDb(null);

    mockRunReport.mockResolvedValueOnce([{ rows: [] }]);

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { events: unknown[]; fromCache: boolean };

    expect(result.fromCache).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it('throws unavailable when GA4 API fails', async () => {
    createMockDb(null);
    mockRunReport.mockRejectedValueOnce(new Error('GA4 API error'));

    await expect(handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    })).rejects.toThrow('Error obteniendo reporte de analytics de GA4');
  });

  it('handles rows with missing values gracefully', async () => {
    createMockDb(null);

    mockRunReport.mockResolvedValueOnce([{
      rows: [
        {
          dimensionValues: [null, null],
          metricValues: [null],
        },
      ],
    }]);

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { events: Array<{ eventName: string; date: string; eventCount: number }> };

    expect(result.events[0].eventName).toBe('');
    expect(result.events[0].date).toBe('');
    expect(result.events[0].eventCount).toBe(0);
  });
});
