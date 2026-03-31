import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockAssertAdmin,
  mockCheckCallableRateLimit,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: any) => Promise<any>) | null>,
  mockGetFirestore: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCheckCallableRateLimit: vi.fn().mockResolvedValue(undefined),
}));

// We need to keep track of the names assigned to handlers because onCall is called multiple times
const callIndex = vi.hoisted(() => ({ value: 0 }));
const HANDLER_NAMES = vi.hoisted(() => ['moderateComment', 'moderateRating', 'moderateCustomTag']);

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    const name = HANDLER_NAMES[callIndex.value++];
    if (name) handlers[name] = fn;
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

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
    increment: vi.fn((n) => ({ type: 'increment', value: n })),
  },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: () => mockGetFirestore(),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: any[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/callableRateLimit', () => ({
  checkCallableRateLimit: (...args: any[]) => mockCheckCallableRateLimit(...args),
}));

vi.mock('../../shared/collections', () => ({
  COLLECTIONS: {
    COMMENTS: 'comments',
    COMMENT_LIKES: 'commentLikes',
    RATINGS: 'ratings',
    CUSTOM_TAGS: 'customTags',
    MODERATION_LOGS: 'moderationLogs',
  },
}));

function createMockDb(overrides?: {
  commentExists?: boolean;
  commentData?: any;
  replies?: any[];
  likes?: any[];
  ratingExists?: boolean;
  ratingData?: any;
  tagExists?: boolean;
  tagData?: any;
}) {
  const mockBatch = {
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  const mockCommentDoc = {
    get: vi.fn().mockResolvedValue({
      exists: overrides?.commentExists ?? true,
      data: () => overrides?.commentData ?? { userId: 'user1', text: 'bad comment' },
    }),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockRatingDoc = {
    get: vi.fn().mockResolvedValue({
      exists: overrides?.ratingExists ?? true,
      data: () => overrides?.ratingData ?? { userId: 'user1', score: 1 },
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockTagDoc = {
    get: vi.fn().mockResolvedValue({
      exists: overrides?.tagExists ?? true,
      data: () => overrides?.tagData ?? { userId: 'user1', label: 'bad tag' },
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockCollection = vi.fn((name) => ({
    doc: vi.fn((id) => {
      if (name === 'comments') return mockCommentDoc;
      if (name === 'ratings') return mockRatingDoc;
      if (name === 'customTags') return mockTagDoc;
      return { id };
    }),
    add: vi.fn().mockResolvedValue({ id: 'log1' }),
    where: vi.fn((field) => ({
      get: vi.fn().mockResolvedValue({
        docs: (field === 'parentId' ? (overrides?.replies ?? []) : (overrides?.likes ?? [])),
      }),
    })),
  }));

  const db = {
    collection: mockCollection,
    batch: vi.fn().mockReturnValue(mockBatch),
  };
  mockGetFirestore.mockReturnValue(db);

  return { db, mockBatch, mockCommentDoc, mockRatingDoc, mockTagDoc, mockCollection };
}

// Import ONLY AFTER mocks are defined
import '../../admin/moderation';

describe('moderation functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('moderateComment', () => {
    const getHandler = () => handlers.moderateComment;

    it('throws on missing input', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      await expect(handler({ auth: { uid: 'admin1' }, data: {} }))
        .rejects.toThrow('Missing commentId or action');
    });

    it('throws when comment not found', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      createMockDb({ commentExists: false });
      await expect(handler({
        auth: { uid: 'admin1' },
        data: { commentId: 'c1', action: 'delete' },
      })).rejects.toThrow('Comment not found');
    });

    it('hides a comment', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      const { mockCommentDoc, mockCollection } = createMockDb();
      const result = await handler({
        auth: { uid: 'admin1' },
        data: { commentId: 'c1', action: 'hide', reason: 'spam' },
      });

      expect(result).toEqual({ success: true });
      expect(mockCommentDoc.update).toHaveBeenCalledWith(expect.objectContaining({
        hidden: true,
      }));
      expect(mockCollection).toHaveBeenCalledWith('moderationLogs');
    });

    it('deletes a comment with cascade', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      const replies = [{ ref: { delete: vi.fn() } }, { ref: { delete: vi.fn() } }];
      const likes = [{ ref: { delete: vi.fn() } }];
      const { mockBatch, mockCollection } = createMockDb({
        replies: replies as any,
        likes: likes as any,
      });

      const result = await handler({
        auth: { uid: 'admin1' },
        data: { commentId: 'c1', action: 'delete' },
      });

      expect(result).toEqual({ success: true });
      // batch.delete is called for comment + each reply + each like
      expect(mockBatch.delete).toHaveBeenCalledTimes(4);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(mockCollection).toHaveBeenCalledWith('moderationLogs');
    });

    it('decrements parent replyCount when deleting a reply', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      const { mockBatch } = createMockDb({
        commentData: { userId: 'u1', parentId: 'parent1' },
      });

      await handler({
        auth: { uid: 'admin1' },
        data: { commentId: 'c1', action: 'delete' },
      });

      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          replyCount: { type: 'increment', value: -1 },
        })
      );
    });
  });

  describe('moderateRating', () => {
    const getHandler = () => handlers.moderateRating;

    it('deletes a rating', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      const { mockRatingDoc, mockCollection } = createMockDb();
      const result = await handler({
        auth: { uid: 'admin1' },
        data: { ratingId: 'r1' },
      });

      expect(result).toEqual({ success: true });
      expect(mockRatingDoc.delete).toHaveBeenCalled();
      expect(mockCollection).toHaveBeenCalledWith('moderationLogs');
    });
  });

  describe('moderateCustomTag', () => {
    const getHandler = () => handlers.moderateCustomTag;

    it('deletes a custom tag', async () => {
      const handler = getHandler();
      if (!handler) throw new Error('Handler not found');
      const { mockTagDoc, mockCollection } = createMockDb();
      const result = await handler({
        auth: { uid: 'admin1' },
        data: { tagId: 't1' },
      });

      expect(result).toEqual({ success: true });
      expect(mockTagDoc.delete).toHaveBeenCalled();
      expect(mockCollection).toHaveBeenCalledWith('moderationLogs');
    });
  });
});
