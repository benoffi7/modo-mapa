import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---
const {
  handlers,
  mockGetFirestore,
  mockIncrement,
  mockCheckRateLimit,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockCreateNotification,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockIncrement: vi.fn().mockReturnValue({ __increment: true }),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackDelete: vi.fn().mockResolvedValue(undefined),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { increment: (n: number) => mockIncrement(n), serverTimestamp: vi.fn() },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
  onDocumentDeleted: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`deleted:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/rateLimiter', () => ({ checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) }));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
  trackDelete: (...args: unknown[]) => mockTrackDelete(...args),
}));
vi.mock('../../utils/notifications', () => ({ createNotification: (...args: unknown[]) => mockCreateNotification(...args) }));
vi.mock('../../utils/abuseLogger', () => ({ logAbuse: vi.fn().mockResolvedValue(undefined) }));

// --- Mock DB helper ---

function createMockDb(overrides?: {
  commentData?: Record<string, unknown> | null;
  commentExists?: boolean;
  userName?: string;
}) {
  const commentData = overrides?.commentData ?? { userId: 'author1', businessId: 'b1' };
  const commentExists = overrides?.commentExists ?? true;
  const userName = overrides?.userName ?? 'TestUser';

  const mockUpdate = vi.fn().mockResolvedValue(undefined);

  // Path-based doc mocking: comments/* returns comment data, users/* returns user data
  const mockDocFn = vi.fn().mockImplementation((path: string) => ({
    update: mockUpdate,
    get: vi.fn().mockResolvedValue(
      path.startsWith('comments/')
        ? { exists: commentExists, data: () => commentData }
        : { exists: true, data: () => ({ displayName: userName }) },
    ),
  }));

  const db = { doc: mockDocFn, collection: vi.fn() };
  mockGetFirestore.mockReturnValue(db);

  return { db, mockUpdate, mockDocFn };
}

// Import triggers
import '../../triggers/commentLikes';

// --- Tests ---

describe('onCommentLikeCreated', () => {
  const onCreated = () => handlers['created:commentLikes/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
  });

  it('skips if no snapshot data', async () => {
    await onCreated()({ data: null });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('deletes like and returns early when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    createMockDb();
    const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };

    await onCreated()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }), ref: snapRef },
    });

    expect(snapRef.delete).toHaveBeenCalled();
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('increments likeCount on the comment', async () => {
    const { mockUpdate } = createMockDb();

    await onCreated()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }), ref: { delete: vi.fn() } },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ likeCount: { __increment: true } });
    expect(mockIncrement).toHaveBeenCalledWith(1);
  });

  it('creates notification for comment author (not self-likes)', async () => {
    createMockDb({ commentData: { userId: 'author1', businessId: 'b1' }, userName: 'Liker' });

    await onCreated()({
      data: { data: () => ({ userId: 'liker1', commentId: 'c1' }), ref: { delete: vi.fn() } },
    });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'author1',
        type: 'like',
        referenceId: 'c1',
      }),
    );
  });

  it('does NOT create notification for self-likes', async () => {
    createMockDb({ commentData: { userId: 'u1', businessId: 'b1' } });

    await onCreated()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }), ref: { delete: vi.fn() } },
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('does NOT create notification if comment does not exist', async () => {
    createMockDb({ commentExists: false });

    await onCreated()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }), ref: { delete: vi.fn() } },
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('increments counters', async () => {
    createMockDb();

    await onCreated()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }), ref: { delete: vi.fn() } },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'commentLikes', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'commentLikes');
  });
});

describe('onCommentLikeDeleted', () => {
  const onDeleted = () => handlers['deleted:commentLikes/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips if no snapshot data', async () => {
    await onDeleted()({ data: null });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('decrements likeCount on the comment', async () => {
    const { mockUpdate } = createMockDb();

    await onDeleted()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }) },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ likeCount: { __increment: true } });
    expect(mockIncrement).toHaveBeenCalledWith(-1);
  });

  it('decrements counters', async () => {
    createMockDb();

    await onDeleted()({
      data: { data: () => ({ userId: 'u1', commentId: 'c1' }) },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'commentLikes', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'commentLikes');
  });
});
