import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { OfflineAction } from '../types/offline';

vi.mock('./ratings', () => ({
  upsertRating: vi.fn().mockResolvedValue(undefined),
  deleteRating: vi.fn().mockResolvedValue(undefined),
  upsertCriteriaRating: vi.fn().mockResolvedValue(undefined),
}));

import { dispatch, executeAction } from './syncEngine';
import { upsertRating } from './ratings';

function makeAction(overrides: Partial<OfflineAction> = {}): OfflineAction {
  return {
    id: crypto.randomUUID(),
    type: 'rating_upsert',
    payload: { score: 4 },
    userId: 'u1',
    businessId: 'b1',
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('syncEngine.dispatch (#335)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatch routes to the registered handler', async () => {
    await dispatch(makeAction({ type: 'rating_upsert', payload: { score: 5 } }));
    expect(upsertRating).toHaveBeenCalledWith('u1', 'b1', 5, undefined);
  });

  it('executeAction is an alias of dispatch (backward compat)', () => {
    expect(executeAction).toBe(dispatch);
  });

  it('throws (assertNever) for an unknown action type at runtime', async () => {
    // Simula una accion persistida por un cliente desconocido / corrupta.
    const corrupt = makeAction();
    // @ts-expect-error — forzamos un tipo fuera de la union para probar el guard runtime.
    corrupt.type = 'totally_unknown_type';
    await expect(dispatch(corrupt)).rejects.toThrow(/Unhandled offline action type/);
  });
});
