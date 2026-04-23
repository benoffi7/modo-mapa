import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Comment } from '../../types';

// --- Mocks ---

const mockLikeComment = vi.hoisted(() => vi.fn());
const mockUnlikeComment = vi.hoisted(() => vi.fn());
const mockAddComment = vi.hoisted(() => vi.fn());
const mockDeleteComment = vi.hoisted(() => vi.fn());

vi.mock('../../services/comments', () => ({
  likeComment: mockLikeComment,
  unlikeComment: mockUnlikeComment,
  addComment: mockAddComment,
  deleteComment: mockDeleteComment,
}));

const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

const mockWithBusyFlag = vi.hoisted(() => vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})));
vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: mockWithBusyFlag,
  isBusyFlagActive: vi.fn(() => false),
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

let mockUser: { uid: string; isAnonymous?: boolean } | null = { uid: 'user1' };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, displayName: 'Test User' }),
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

vi.mock('../../hooks/useProfileVisibility', () => ({
  useProfileVisibility: () => ({}),
}));

vi.mock('../../hooks/useUndoDelete', () => ({
  useUndoDelete: ({ message }: { message: string }) => ({
    isPendingDelete: () => false,
    markForDelete: vi.fn(),
    snackbarProps: { open: false, message, onClose: vi.fn(), onUndo: vi.fn() },
  }),
}));

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { useCommentListBase } from '../useCommentListBase';

// --- Test helpers ---

const baseComment: Comment = {
  id: 'comment1',
  userId: 'user2',
  userName: 'Other User',
  businessId: 'biz1',
  text: 'Great place!',
  likeCount: 5,
  type: 'comment',
  createdAt: new Date(),
  replyCount: 0,
  flagged: false,
};

const defaultParams = {
  businessId: 'biz1',
  businessName: 'Test Biz',
  comments: [baseComment],
  userCommentLikes: new Set<string>(),
  onCommentsChange: vi.fn(),
  deleteMessage: 'Comentario eliminado',
};

describe('useCommentListBase – handleToggleLike', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };

    let resolveFirst!: () => void;
    // Default: likeComment resolves immediately
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<unknown>) => fn(),
    );
    mockLikeComment.mockImplementation(() => new Promise<void>((resolve) => { resolveFirst = resolve; resolve(); }));
    mockUnlikeComment.mockResolvedValue(undefined);
    void resolveFirst; // suppress unused warning
  });

  it('applies optimistic like on first tap', async () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));

    expect(result.current.isLiked('comment1')).toBe(false);
    expect(result.current.getLikeCount(baseComment)).toBe(5);

    await act(async () => {
      await result.current.handleToggleLike('comment1');
    });

    expect(result.current.isLiked('comment1')).toBe(true);
    expect(result.current.getLikeCount(baseComment)).toBe(6);
  });

  it('ignores second invocation of handleToggleLike for same commentId while first is in flight', async () => {
    let resolveFirst!: () => void;
    mockWithOfflineSupport.mockImplementationOnce(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<unknown>) =>
        new Promise<void>((resolve) => {
          resolveFirst = () => { void fn(); resolve(); };
        }),
    );
    // Second call (if it happens) resolves immediately
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<unknown>) => fn(),
    );

    const { result } = renderHook(() => useCommentListBase(defaultParams));

    // First tap — starts but does not await
    let firstTogglePromise!: Promise<void>;
    act(() => {
      firstTogglePromise = result.current.handleToggleLike('comment1');
    });

    // Second tap immediately (first is still in flight)
    act(() => {
      void result.current.handleToggleLike('comment1');
    });

    // Resolve first
    await act(async () => {
      resolveFirst();
      await firstTogglePromise;
    });

    // withOfflineSupport should have been called only ONCE (second tap was blocked)
    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);
  });

  it('optimisticLikes has correct delta after single like resolves', async () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));

    await act(async () => {
      await result.current.handleToggleLike('comment1');
    });

    // Should show +1 delta
    expect(result.current.getLikeCount(baseComment)).toBe(6);
    expect(result.current.isLiked('comment1')).toBe(true);
  });

  it('reverts optimistic state on error', async () => {
    mockWithOfflineSupport.mockRejectedValueOnce(new Error('like failed'));

    const { result } = renderHook(() => useCommentListBase(defaultParams));

    await act(async () => {
      await result.current.handleToggleLike('comment1');
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
      // After error, optimistic entry is cleared — falls back to server state
      expect(result.current.isLiked('comment1')).toBe(false);
      expect(result.current.getLikeCount(baseComment)).toBe(5);
    });
  });

  it('allows subsequent tap after first resolves (togglingIds cleaned up)', async () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));

    // First tap - like
    await act(async () => {
      await result.current.handleToggleLike('comment1');
    });
    expect(result.current.isLiked('comment1')).toBe(true);

    // Second tap - unlike
    await act(async () => {
      await result.current.handleToggleLike('comment1');
    });
    expect(result.current.isLiked('comment1')).toBe(false);

    // Two calls total
    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(2);
  });
});

describe('useCommentListBase – handleSubmitReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<unknown>) => fn(),
    );
    mockAddComment.mockResolvedValue(undefined);
  });

  it('is a function (callable)', () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));
    expect(typeof result.current.handleSubmitReply).toBe('function');
  });

  it('calls addComment with correct args when replyingTo is set', async () => {
    const onCommentsChange = vi.fn();
    const { result } = renderHook(() =>
      useCommentListBase({ ...defaultParams, onCommentsChange }),
    );

    // Set up reply state
    await act(async () => {
      result.current.handleStartReply(baseComment);
    });
    await act(async () => {
      result.current.setReplyText('mi respuesta');
    });

    await act(async () => {
      await result.current.handleSubmitReply();
    });

    expect(mockAddComment).toHaveBeenCalledWith(
      'user1',
      'Test User',
      'biz1',
      'mi respuesta',
      'comment1',
    );
    expect(onCommentsChange).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('does nothing when replyingTo is null', async () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));

    await act(async () => {
      await result.current.handleSubmitReply();
    });

    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('does nothing when replyText is blank', async () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));

    await act(async () => {
      result.current.handleStartReply(baseComment);
    });
    // replyText stays empty string

    await act(async () => {
      await result.current.handleSubmitReply();
    });

    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('shows error toast and does not call onCommentsChange on failure', async () => {
    const onCommentsChange = vi.fn();
    mockWithOfflineSupport.mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() =>
      useCommentListBase({ ...defaultParams, onCommentsChange }),
    );

    await act(async () => {
      result.current.handleStartReply(baseComment);
    });
    await act(async () => {
      result.current.setReplyText('respuesta');
    });

    await act(async () => {
      await result.current.handleSubmitReply();
    });

    expect(mockToast.error).toHaveBeenCalled();
    expect(onCommentsChange).not.toHaveBeenCalled();
  });

  it('handleSubmitReply invoca withBusyFlag con kind: comment_submit', async () => {
    const { result } = renderHook(() => useCommentListBase(defaultParams));

    await act(async () => {
      result.current.handleStartReply(baseComment);
    });
    await act(async () => {
      result.current.setReplyText('mi respuesta');
    });

    await act(async () => {
      await result.current.handleSubmitReply();
    });

    expect(mockWithBusyFlag).toHaveBeenCalledWith('comment_submit', expect.any(Function));
  });

  it('does nothing when daily comment limit is reached', async () => {
    // Simulate user already having MAX_COMMENTS_PER_DAY comments today
    const today = new Date();
    const ownCommentsToday = Array.from({ length: 20 }, (_, i) => ({
      ...baseComment,
      id: `own${i}`,
      userId: 'user1',
      createdAt: today,
    }));
    const { result } = renderHook(() =>
      useCommentListBase({ ...defaultParams, comments: ownCommentsToday }),
    );

    await act(async () => {
      result.current.handleStartReply(baseComment);
    });
    await act(async () => {
      result.current.setReplyText('una más');
    });

    await act(async () => {
      await result.current.handleSubmitReply();
    });

    expect(mockAddComment).not.toHaveBeenCalled();
  });
});
