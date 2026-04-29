import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIncrementCounter = vi.fn().mockResolvedValue(undefined);
const mockTrackWrite = vi.fn().mockResolvedValue(undefined);
const mockCheckRateLimit = vi.fn().mockResolvedValue(false);
const mockLogAbuse = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);

// Mock de Firestore con `doc()` configurable por test. Por defecto, cualquier
// doc() retorna un ref con `.get()` resolviendo a `{ exists: false }` y `.set()`
// resolviendo a undefined — equivalente a "no flag presente".
const mockDocGet = vi.fn().mockResolvedValue({ exists: false, data: () => undefined });
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({ get: mockDocGet, set: mockDocSet }));
const mockFirestore = { doc: mockDoc };

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockFirestore,
  FieldValue: {
    serverTimestamp: () => 'SERVER_TS',
  },
}));

const mockTrackDelete = vi.fn().mockResolvedValue(undefined);

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
  trackDelete: (...args: unknown[]) => mockTrackDelete(...args),
}));

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (_path: string, handler: (...args: unknown[]) => unknown) => handler,
  onDocumentDeleted: (_path: string, handler: (...args: unknown[]) => unknown) => handler,
}));

import { onCheckInCreated, onCheckInDeleted } from '../../triggers/checkins';

const handler = onCheckInCreated as unknown as (event: unknown) => Promise<void>;
const deleteHandler = onCheckInDeleted as unknown as (event: unknown) => Promise<void>;

function makeEvent(data: Record<string, unknown>) {
  return {
    data: {
      data: () => data,
      ref: { delete: mockDelete },
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('onCheckInCreated', () => {
  it('increments counter when under rate limit', async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    await handler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'checkins', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'checkins');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    await handler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

    expect(mockDelete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'u1',
        type: 'rate_limit',
        collection: 'checkins',
      }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('handles missing snapshot gracefully', async () => {
    await handler({ data: null });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('passes correct rate limit config', async () => {
    mockCheckRateLimit.mockResolvedValue(false);
    await handler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      { collection: 'checkins', limit: 10, windowType: 'daily' },
      'u1',
    );
  });
});

describe('onCheckInDeleted', () => {
  it('decrements counter', async () => {
    await deleteHandler({});
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'checkins', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'checkins');
  });
});
