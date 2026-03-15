import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks (accessible inside vi.mock factories) ---

const {
  handlers,
  mockIncrement,
  mockGetFirestore,
  mockCheckRateLimit,
  mockCheckModeration,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockLogAbuse,
  mockCreateNotification,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockIncrement: vi.fn().mockReturnValue({ __increment: true }),
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockCheckModeration: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackDelete: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
}));

// Mock firebase-admin/firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { increment: (n: number) => mockIncrement(n), serverTimestamp: vi.fn() },
}));

// Mock firebase-functions/v2/firestore — capture handlers
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
  onDocumentDeleted: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`deleted:${path}`] = handler;
    return handler;
  },
  onDocumentUpdated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`updated:${path}`] = handler;
    return handler;
  },
}));

// Mock utilities
vi.mock('../../utils/rateLimiter', () => ({ checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) }));
vi.mock('../../utils/moderator', () => ({ checkModeration: (...args: unknown[]) => mockCheckModeration(...args) }));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
  trackDelete: (...args: unknown[]) => mockTrackDelete(...args),
}));
vi.mock('../../utils/abuseLogger', () => ({ logAbuse: (...args: unknown[]) => mockLogAbuse(...args) }));
vi.mock('../../utils/aggregates', () => ({ incrementBusinessCount: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../utils/notifications', () => ({ createNotification: (...args: unknown[]) => mockCreateNotification(...args) }));

// --- Firestore mock helpers ---

function createMockDoc(data: Record<string, unknown> | undefined, exists = true) {
  return {
    exists,
    data: () => data,
    ref: { delete: vi.fn().mockResolvedValue(undefined) },
  };
}

function createMockDb(overrides?: {
  parentDoc?: ReturnType<typeof createMockDoc>;
  repliesSnap?: { empty: boolean; docs: ReturnType<typeof createMockDoc>[] };
}) {
  const parentDoc = overrides?.parentDoc ?? createMockDoc({ replyCount: 3 });
  const repliesSnap = overrides?.repliesSnap ?? { empty: true, docs: [] };

  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue(parentDoc);
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

  const mockWhere = vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(repliesSnap) });
  const mockDocRef = vi.fn().mockReturnValue({ update: mockUpdate, get: mockGet });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDocRef, where: mockWhere });
  const mockBatch = vi.fn().mockReturnValue({ delete: mockBatchDelete, commit: mockBatchCommit });

  const db = {
    collection: mockCollection,
    batch: mockBatch,
  };

  // Wire getFirestore to return this db
  mockGetFirestore.mockReturnValue(db);

  return { db, mockUpdate, mockGet, mockDocRef, mockCollection, mockWhere, mockBatch, mockBatchDelete, mockBatchCommit };
}

// --- Import triggers (registers handlers via mock side-effects) ---
import '../../triggers/comments';

// --- Tests ---

describe('onCommentCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
    mockCheckModeration.mockResolvedValue(false);
  });

  it('skips if no snapshot data', async () => {
    await handlers['created:comments/{commentId}']({ data: null });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('increments counters on normal comment', async () => {
    createMockDb();
    const snapRef = { delete: vi.fn() };
    await handlers['created:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'hello', businessId: 'b1' }), ref: snapRef },
    });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      { collection: 'comments', limit: 20, windowType: 'daily' },
      'u1',
    );
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'comments', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'comments');
    expect(snapRef.delete).not.toHaveBeenCalled();
  });

  it('deletes comment and logs abuse when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    createMockDb();
    const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };

    await handlers['created:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'spam', businessId: 'b1' }), ref: snapRef },
    });

    expect(snapRef.delete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'u1',
      type: 'rate_limit',
      collection: 'comments',
    }));
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('flags comment and logs abuse when moderation detects banned words', async () => {
    mockCheckModeration.mockResolvedValue(true);
    createMockDb();
    const mockSnapUpdate = vi.fn().mockResolvedValue(undefined);
    const snapRef = { delete: vi.fn(), update: mockSnapUpdate };

    await handlers['created:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'bad word', businessId: 'b1' }), ref: snapRef },
    });

    expect(mockSnapUpdate).toHaveBeenCalledWith({ flagged: true });
    expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: 'flagged',
      collection: 'comments',
    }));
    expect(mockIncrementCounter).toHaveBeenCalled();
  });

  it('increments parent replyCount when comment is a reply', async () => {
    const { mockUpdate, mockDocRef } = createMockDb();

    await handlers['created:comments/{commentId}']({
      data: {
        data: () => ({ userId: 'u1', text: 'reply', businessId: 'b1', parentId: 'parent123' }),
        ref: { delete: vi.fn() },
      },
    });

    expect(mockDocRef).toHaveBeenCalledWith('parent123');
    expect(mockUpdate).toHaveBeenCalledWith({ replyCount: { __increment: true } });
    expect(mockIncrement).toHaveBeenCalledWith(1);
  });

  it('does NOT increment replyCount for root comments (no parentId)', async () => {
    const { mockUpdate } = createMockDb();

    await handlers['created:comments/{commentId}']({
      data: {
        data: () => ({ userId: 'u1', text: 'root comment', businessId: 'b1' }),
        ref: { delete: vi.fn() },
      },
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('creates comment_reply notification for parent author', async () => {
    const parentDoc = createMockDoc({ userId: 'parent-author', replyCount: 2 });
    createMockDb({ parentDoc });

    await handlers['created:comments/{commentId}']({
      data: {
        data: () => ({
          userId: 'replier',
          text: 'Great comment!',
          businessId: 'b1',
          businessName: 'Café Test',
          parentId: 'parent123',
          displayName: 'Replier Name',
        }),
        ref: { delete: vi.fn() },
      },
    });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'parent-author',
        type: 'comment_reply',
        actorId: 'replier',
        actorName: 'Replier Name',
        businessId: 'b1',
        referenceId: 'parent123',
      }),
    );
  });

  it('does NOT notify when replying to own comment', async () => {
    const parentDoc = createMockDoc({ userId: 'same-user', replyCount: 1 });
    createMockDb({ parentDoc });

    await handlers['created:comments/{commentId}']({
      data: {
        data: () => ({
          userId: 'same-user',
          text: 'Self reply',
          businessId: 'b1',
          parentId: 'parent123',
        }),
        ref: { delete: vi.fn() },
      },
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('does NOT notify for root comments (no parentId)', async () => {
    createMockDb();

    await handlers['created:comments/{commentId}']({
      data: {
        data: () => ({ userId: 'u1', text: 'root', businessId: 'b1' }),
        ref: { delete: vi.fn() },
      },
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

describe('onCommentDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips parent replyCount when deleted comment has no parentId', async () => {
    const { mockUpdate } = createMockDb();

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'root', businessId: 'b1' }) },
      params: { commentId: 'c1' },
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'comments', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'comments');
  });

  it('decrements parent replyCount when reply is deleted', async () => {
    const parentDoc = createMockDoc({ replyCount: 5 });
    const { mockUpdate, mockDocRef } = createMockDb({ parentDoc });

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'reply', businessId: 'b1', parentId: 'parent1' }) },
      params: { commentId: 'reply1' },
    });

    expect(mockDocRef).toHaveBeenCalledWith('parent1');
    expect(mockUpdate).toHaveBeenCalledWith({ replyCount: 4 });
  });

  it('floors replyCount at 0 (never goes negative)', async () => {
    const parentDoc = createMockDoc({ replyCount: 0 });
    const { mockUpdate } = createMockDb({ parentDoc });

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'reply', businessId: 'b1', parentId: 'parent1' }) },
      params: { commentId: 'reply1' },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ replyCount: 0 });
  });

  it('handles missing replyCount field (defaults to 0)', async () => {
    const parentDoc = createMockDoc({});
    const { mockUpdate } = createMockDb({ parentDoc });

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'reply', businessId: 'b1', parentId: 'parent1' }) },
      params: { commentId: 'reply1' },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ replyCount: 0 });
  });

  it('does NOT decrement if parent document was already deleted', async () => {
    const parentDoc = createMockDoc(undefined, false);
    const { mockUpdate } = createMockDb({ parentDoc });

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'reply', businessId: 'b1', parentId: 'parent1' }) },
      params: { commentId: 'reply1' },
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('cascade deletes orphaned replies', async () => {
    const reply1 = createMockDoc({ userId: 'u2', text: 'r1', parentId: 'parent1' });
    const reply2 = createMockDoc({ userId: 'u3', text: 'r2', parentId: 'parent1' });
    const { mockBatchDelete, mockBatchCommit } = createMockDb({
      repliesSnap: { empty: false, docs: [reply1, reply2] },
    });

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'parent', businessId: 'b1' }) },
      params: { commentId: 'parent1' },
    });

    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchDelete).toHaveBeenCalledWith(reply1.ref);
    expect(mockBatchDelete).toHaveBeenCalledWith(reply2.ref);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('does NOT batch delete when no replies exist', async () => {
    const { mockBatchCommit } = createMockDb({
      repliesSnap: { empty: true, docs: [] },
    });

    await handlers['deleted:comments/{commentId}']({
      data: { data: () => ({ userId: 'u1', text: 'no replies', businessId: 'b1' }) },
      params: { commentId: 'c1' },
    });

    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

describe('onCommentUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckModeration.mockResolvedValue(false);
  });

  it('skips if no event data', async () => {
    await handlers['updated:comments/{commentId}']({ data: null });
    expect(mockCheckModeration).not.toHaveBeenCalled();
  });

  it('re-moderates when text changes', async () => {
    createMockDb();
    const mockRefUpdate = vi.fn().mockResolvedValue(undefined);

    await handlers['updated:comments/{commentId}']({
      data: {
        before: { data: () => ({ userId: 'u1', text: 'old text', flagged: false }) },
        after: {
          data: () => ({ userId: 'u1', text: 'new text', flagged: false }),
          ref: { update: mockRefUpdate },
        },
      },
    });

    expect(mockCheckModeration).toHaveBeenCalledWith(expect.anything(), 'new text');
  });

  it('does NOT re-moderate when text is unchanged (e.g., likeCount update)', async () => {
    await handlers['updated:comments/{commentId}']({
      data: {
        before: { data: () => ({ userId: 'u1', text: 'same', likeCount: 0 }) },
        after: { data: () => ({ userId: 'u1', text: 'same', likeCount: 1 }), ref: { update: vi.fn() } },
      },
    });

    expect(mockCheckModeration).not.toHaveBeenCalled();
  });

  it('flags previously clean text that now contains banned words', async () => {
    mockCheckModeration.mockResolvedValue(true);
    createMockDb();
    const mockRefUpdate = vi.fn().mockResolvedValue(undefined);

    await handlers['updated:comments/{commentId}']({
      data: {
        before: { data: () => ({ userId: 'u1', text: 'clean', flagged: false }) },
        after: {
          data: () => ({ userId: 'u1', text: 'bad word', flagged: false }),
          ref: { update: mockRefUpdate },
        },
      },
    });

    expect(mockRefUpdate).toHaveBeenCalledWith({ flagged: true });
    expect(mockLogAbuse).toHaveBeenCalled();
  });

  it('unflags previously flagged text that is now clean', async () => {
    mockCheckModeration.mockResolvedValue(false);
    createMockDb();
    const mockRefUpdate = vi.fn().mockResolvedValue(undefined);

    await handlers['updated:comments/{commentId}']({
      data: {
        before: { data: () => ({ userId: 'u1', text: 'bad', flagged: true }) },
        after: {
          data: () => ({ userId: 'u1', text: 'clean edit', flagged: true }),
          ref: { update: mockRefUpdate },
        },
      },
    });

    expect(mockRefUpdate).toHaveBeenCalledWith({ flagged: false });
  });
});
