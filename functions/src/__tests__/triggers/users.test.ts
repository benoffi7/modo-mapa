import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetFirestore,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { increment: vi.fn((n: number) => n), serverTimestamp: vi.fn() },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: any) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: any[]) => mockIncrementCounter(...args),
  trackWrite: (...args: any[]) => mockTrackWrite(...args),
}));
vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: any[]) => mockTrackFunctionTiming(...args),
}));

import '../../triggers/users';

function makeDb() {
  const db = {};
  mockGetFirestore.mockReturnValue(db);
  return db;
}

function makeEvent(data: Record<string, unknown> | undefined) {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockRef = { update: mockUpdate };
  return {
    data: data !== undefined
      ? { data: () => data, ref: mockRef }
      : undefined,
    params: { userId: 'user1' },
    _mockUpdate: mockUpdate,
  };
}

describe('onUserCreated', () => {
  const getHandler = () => handlers['created:users/{userId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
  });

  it('increments counter and tracks write even when event.data is undefined', async () => {
    // The trigger accesses event.data?.data() — if event.data is undefined, it still runs counters
    await getHandler()({ data: undefined, params: { userId: 'user1' } });
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'users', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'users');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onUserCreated', expect.any(Number));
  });

  it('does not call ref.update when displayName is absent', async () => {
    const event = makeEvent({ email: 'user@example.com' });
    await getHandler()(event);
    expect(event._mockUpdate).not.toHaveBeenCalled();
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'users', 1);
  });

  it('updates displayNameLower and initializes follow counters when displayName is present', async () => {
    const event = makeEvent({ displayName: 'Alice Wonderland', email: 'alice@example.com' });
    await getHandler()(event);
    expect(event._mockUpdate).toHaveBeenCalledWith({
      displayNameLower: 'alice wonderland',
      followersCount: 0,
      followingCount: 0,
    });
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onUserCreated', expect.any(Number));
  });
});
