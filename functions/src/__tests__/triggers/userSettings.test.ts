import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockGetFirestore: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`written:${path}`] = handler;
    return handler;
  },
}));

function createMockDb() {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn().mockReturnValue({
    update: mockUpdate,
    set: mockSet,
  });

  const db = { doc: mockDoc };
  mockGetFirestore.mockReturnValue(db);
  return { db, mockUpdate, mockSet, mockDoc };
}

import '../../triggers/userSettings';

describe('onUserSettingsWritten', () => {
  const onWritten = () => handlers['written:userSettings/{userId}'];

  beforeEach(() => vi.clearAllMocks());

  it('returns early when after doc does not exist (delete)', async () => {
    createMockDb();
    await onWritten()({
      params: { userId: 'u1' },
      data: { after: { exists: false, data: () => undefined } },
    });

    // Nothing should be called since we return early
    const { mockUpdate } = createMockDb();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('syncs profilePublic=true to users doc', async () => {
    const { mockUpdate, mockDoc } = createMockDb();

    await onWritten()({
      params: { userId: 'user123' },
      data: {
        after: {
          exists: true,
          data: () => ({ profilePublic: true }),
        },
      },
    });

    expect(mockDoc).toHaveBeenCalledWith('users/user123');
    expect(mockUpdate).toHaveBeenCalledWith({ profilePublic: true });
  });

  it('syncs profilePublic=false to users doc', async () => {
    const { mockUpdate } = createMockDb();

    await onWritten()({
      params: { userId: 'user123' },
      data: {
        after: {
          exists: true,
          data: () => ({ profilePublic: false }),
        },
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ profilePublic: false });
  });

  it('defaults profilePublic to false when field is missing', async () => {
    const { mockUpdate } = createMockDb();

    await onWritten()({
      params: { userId: 'user123' },
      data: {
        after: {
          exists: true,
          data: () => ({}),
        },
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ profilePublic: false });
  });

  it('defaults profilePublic to false when value is non-boolean', async () => {
    const { mockUpdate } = createMockDb();

    await onWritten()({
      params: { userId: 'user123' },
      data: {
        after: {
          exists: true,
          data: () => ({ profilePublic: 'yes' }),
        },
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ profilePublic: false });
  });

  it('falls back to set+merge when user doc does not exist', async () => {
    const { mockUpdate, mockSet } = createMockDb();
    mockUpdate.mockRejectedValueOnce(new Error('NOT_FOUND'));

    await onWritten()({
      params: { userId: 'newuser' },
      data: {
        after: {
          exists: true,
          data: () => ({ profilePublic: true }),
        },
      },
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ profilePublic: true }, { merge: true });
  });

  it('handles missing data in after snapshot', async () => {
    createMockDb();
    await onWritten()({
      params: { userId: 'u1' },
      data: { after: null },
    });
    // Should not throw
  });
});
