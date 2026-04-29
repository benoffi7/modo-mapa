import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Comment } from '../../types';

// --- Mocks (#323 — comment_delete wrap) ---

const mockDeleteComment = vi.hoisted(() => vi.fn());
const mockLikeComment = vi.hoisted(() => vi.fn());
const mockUnlikeComment = vi.hoisted(() => vi.fn());
const mockAddComment = vi.hoisted(() => vi.fn());

vi.mock('../../services/comments', () => ({
  deleteComment: mockDeleteComment,
  likeComment: mockLikeComment,
  unlikeComment: mockUnlikeComment,
  addComment: mockAddComment,
}));

const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})),
  isBusyFlagActive: vi.fn(() => false),
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' }, displayName: 'Test User' }),
}));

let mockIsOffline = false;
vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

vi.mock('../../hooks/useProfileVisibility', () => ({ useProfileVisibility: () => ({}) }));

// Capture the onConfirmDelete handler that useCommentListBase passes to useUndoDelete.
let capturedOnConfirmDelete: ((comment: Comment) => Promise<void>) | null = null;
vi.mock('../../hooks/useUndoDelete', () => ({
  useUndoDelete: ({ onConfirmDelete }: { onConfirmDelete: (c: Comment) => Promise<void> }) => {
    capturedOnConfirmDelete = onConfirmDelete;
    return {
      isPendingDelete: () => false,
      markForDelete: vi.fn(),
      snackbarProps: { open: false, message: '', onClose: vi.fn(), onUndo: vi.fn() },
    };
  },
}));

vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { useCommentListBase } from '../useCommentListBase';

const baseComment: Comment = {
  id: 'comment1',
  userId: 'user1',
  userName: 'Self',
  businessId: 'biz1',
  text: 'Hello',
  likeCount: 0,
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

describe('useCommentListBase — comment_delete wrap (#323)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnConfirmDelete = null;
    mockIsOffline = false;
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _t: string, _meta: object, _payload: object, fn: () => Promise<unknown>) => fn(),
    );
    mockDeleteComment.mockResolvedValue(undefined);
  });

  it('online path: invokes withOfflineSupport with isOffline=false and runs deleteComment directly', async () => {
    mockIsOffline = false;
    renderHook(() => useCommentListBase(defaultParams));

    expect(capturedOnConfirmDelete).not.toBeNull();
    await act(async () => {
      await capturedOnConfirmDelete!(baseComment);
    });

    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);
    const call = mockWithOfflineSupport.mock.calls[0]!;
    expect(call[0]).toBe(false); // isOffline
    expect(call[1]).toBe('comment_delete');
    expect(call[2]).toEqual({ userId: 'user1', businessId: 'biz1', businessName: 'Test Biz' });
    expect(call[3]).toEqual({ commentId: 'comment1' });
    expect(mockDeleteComment).toHaveBeenCalledWith('comment1', 'user1');
  });

  it('offline path: invokes withOfflineSupport with isOffline=true (delegates enqueue to interceptor)', async () => {
    mockIsOffline = true;
    // simulate interceptor enqueueing without invoking onlineAction
    mockWithOfflineSupport.mockImplementationOnce(async () => undefined);

    renderHook(() => useCommentListBase(defaultParams));

    await act(async () => {
      await capturedOnConfirmDelete!(baseComment);
    });

    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);
    expect(mockWithOfflineSupport.mock.calls[0]![0]).toBe(true);
    expect(mockWithOfflineSupport.mock.calls[0]![1]).toBe('comment_delete');
    // deleteComment must NOT be called when offline (interceptor enqueued instead)
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });
});
