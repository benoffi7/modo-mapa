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

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default behavior for the shared doc mocks: por defecto el flag de
  // suspension NO existe y los `set()` resuelven sin error. Los tests que
  // necesiten otro comportamiento sobreescriben con `mockResolvedValueOnce`.
  mockDocGet.mockResolvedValue({ exists: false, data: () => undefined });
  mockDocSet.mockResolvedValue(undefined);
});

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

  // #322 Fase 4.1 — flag de suspension de creates tras abuso de deletes
  describe('onCheckInCreated suspension flag (Fase 4.1)', () => {
    it('aborts create and logs abuse when suspension flag is active', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const futureTs = Date.now() + 60 * 60 * 1000; // 1h en el futuro
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ suspendedUntil: futureTs, reason: 'delete_abuse' }),
      });

      await handler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

      // Verifica que se leyo el flag correcto
      expect(mockDoc).toHaveBeenCalledWith('_rateLimits/checkin_create_suspended_u1');
      // El doc se borra y el counter NO se incrementa
      expect(mockDelete).toHaveBeenCalled();
      expect(mockIncrementCounter).not.toHaveBeenCalled();
      expect(mockTrackWrite).not.toHaveBeenCalled();
      // logAbuse documenta la suspension
      expect(mockLogAbuse).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'u1',
          type: 'rate_limit',
          collection: 'checkins',
          detail: expect.stringContaining('Create suspended until'),
        }),
      );
    });

    it('allows create when suspension flag is expired (suspendedUntil < now)', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      const pastTs = Date.now() - 60 * 60 * 1000; // 1h en el pasado
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ suspendedUntil: pastTs, reason: 'delete_abuse' }),
      });

      await handler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

      // Flag vencido → path normal (counter incrementa, doc no se borra)
      expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'checkins', 1);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockLogAbuse).not.toHaveBeenCalled();
    });

    it('allows create when no suspension flag exists (default path)', async () => {
      mockCheckRateLimit.mockResolvedValue(false);
      // Default beforeEach ya configura `exists: false` — explicit aqui para claridad
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

      await handler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

      expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'checkins', 1);
      expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'checkins');
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

describe('onCheckInDeleted', () => {
  it('decrements counter', async () => {
    await deleteHandler({});
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'checkins', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'checkins');
  });

  // #322 Fase 4.1 — escribir flag de suspension cuando deleteCount >= 20
  it('writes suspension flag when deleteCount >= 20 (delete abuse)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Primer get: lee el counter de deletes — devuelve count = 25 hoy
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ date: today, count: 25 }),
    });

    await deleteHandler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

    // logAbuse fue llamado por exceso
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'u1',
        type: 'rate_limit',
        collection: 'checkins_delete',
      }),
    );

    // Verifica que el flag de suspension se escribio en el path correcto
    expect(mockDoc).toHaveBeenCalledWith('_rateLimits/checkin_create_suspended_u1');
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'delete_abuse',
        userId: 'u1',
        suspendedUntil: expect.any(Number),
        createdAt: 'SERVER_TS',
      }),
    );

    // Counter de deletes sigue funcionando
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'checkins', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'checkins');
  });

  it('does NOT write suspension flag when deleteCount is under threshold', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ date: today, count: 5 }),
    });

    await deleteHandler(makeEvent({ userId: 'u1', businessId: 'biz_001' }));

    expect(mockLogAbuse).not.toHaveBeenCalled();
    // Solo el set del counter de deletes; NO se llamo el doc del flag de suspension
    expect(mockDoc).not.toHaveBeenCalledWith('_rateLimits/checkin_create_suspended_u1');
  });
});
