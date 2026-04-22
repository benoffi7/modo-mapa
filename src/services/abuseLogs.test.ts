import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnSnapshot = vi.fn();

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { ABUSE_LOGS: 'abuseLogs' },
}));
vi.mock('../config/adminConverters', () => ({
  abuseLogConverter: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  query: vi.fn(() => 'query-ref'),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { subscribeToAbuseLogs } from './abuseLogs';

describe('subscribeToAbuseLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the unsubscribe function returned by onSnapshot', () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const result = subscribeToAbuseLogs(50, vi.fn(), vi.fn());
    expect(result).toBe(unsub);
  });

  it('calls onNext with mapped logs and docChanges on snapshot', () => {
    const onNext = vi.fn();
    mockOnSnapshot.mockImplementation((_q: unknown, next: (snap: unknown) => void) => {
      next({
        docs: [{ data: () => ({ userId: 'u1', type: 'rate_limit' }) }],
        docChanges: () => [{ type: 'added', doc: { id: 'doc1' } }],
      });
      return vi.fn();
    });

    subscribeToAbuseLogs(50, onNext, vi.fn());

    expect(onNext).toHaveBeenCalledOnce();
    const [logs, changes] = onNext.mock.calls[0] as [unknown[], { type: string; id: string }[]];
    expect(logs).toEqual([{ userId: 'u1', type: 'rate_limit' }]);
    expect(changes).toEqual([{ type: 'added', id: 'doc1' }]);
  });

  it('calls onError when snapshot emits an error', () => {
    const onError = vi.fn();
    mockOnSnapshot.mockImplementation(
      (_q: unknown, _next: unknown, error: () => void) => {
        error();
        return vi.fn();
      },
    );

    subscribeToAbuseLogs(50, vi.fn(), onError);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('reports empty docChanges array when snapshot has no changes', () => {
    const onNext = vi.fn();
    mockOnSnapshot.mockImplementation((_q: unknown, next: (snap: unknown) => void) => {
      next({
        docs: [],
        docChanges: () => [],
      });
      return vi.fn();
    });

    subscribeToAbuseLogs(50, onNext, vi.fn());

    const [logs, changes] = onNext.mock.calls[0] as [unknown[], unknown[]];
    expect(logs).toEqual([]);
    expect(changes).toEqual([]);
  });
});
