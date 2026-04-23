import { useState, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { addComment, deleteComment, likeComment, unlikeComment } from '../services/comments';
import { withOfflineSupport } from '../services/offlineInterceptor';
import { withBusyFlag } from '../utils/busyFlag';
import { useProfileVisibility } from './useProfileVisibility';
import { useUndoDelete } from './useUndoDelete';
import { MAX_COMMENTS_PER_DAY } from '../constants/validation';
import { MSG_COMMENT } from '../constants/messages';
import type { Comment } from '../types';
import { logger } from '../utils/logger';

interface UseCommentListBaseParams {
  businessId: string;
  businessName?: string | undefined;
  comments: Comment[];
  userCommentLikes: Set<string>;
  onCommentsChange: () => void;
  deleteMessage: string;
  expandThread?: (id: string) => void;
}

export function useCommentListBase({
  businessId,
  businessName,
  comments,
  userCommentLikes,
  onCommentsChange,
  deleteMessage,
  expandThread,
}: UseCommentListBaseParams) {
  const { user, displayName } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);

  // Profile visibility
  const commentUserIds = useMemo(() => comments.map((c) => c.userId), [comments]);
  const profileVisibility = useProfileVisibility(commentUserIds);

  // Undo delete
  const onConfirmDeleteComment = useCallback(
    async (comment: Comment) => {
      if (!user) return;
      await deleteComment(comment.id, user.uid);
    },
    [user],
  );
  const { isPendingDelete, markForDelete, snackbarProps: deleteSnackbarProps } = useUndoDelete<Comment>({
    onConfirmDelete: onConfirmDeleteComment,
    onDeleteComplete: onCommentsChange,
    message: deleteMessage,
  });

  // Optimistic likes (unified: single Map with toggle + delta)
  const [optimisticLikes, setOptimisticLikes] = useState<Map<string, { toggled: boolean; delta: number }>>(new Map());
  // In-flight guard: prevents double-toggle on rapid taps
  const togglingIds = useRef<Set<string>>(new Set());

  const isLiked = useCallback((commentId: string) => {
    const entry = optimisticLikes.get(commentId);
    if (entry) return entry.toggled;
    return userCommentLikes.has(commentId);
  }, [userCommentLikes, optimisticLikes]);

  const getLikeCount = useCallback((comment: Comment) => {
    const delta = optimisticLikes.get(comment.id)?.delta ?? 0;
    return Math.max(0, comment.likeCount + delta);
  }, [optimisticLikes]);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLInputElement>(null);

  const userCommentsToday = useMemo(() => {
    const today = new Date().toDateString();
    return comments.filter((c) => c.userId === user?.uid && c.createdAt.toDateString() === today).length;
  }, [comments, user?.uid]);

  const handleToggleLike = useCallback(async (commentId: string) => {
    if (!user) return;
    if (togglingIds.current.has(commentId)) return;
    togglingIds.current.add(commentId);

    const currentlyLiked = isLiked(commentId);

    setOptimisticLikes((prev) => {
      const current = prev.get(commentId)?.delta ?? 0;
      return new Map(prev).set(commentId, {
        toggled: !currentlyLiked,
        delta: currentlyLiked ? current - 1 : current + 1,
      });
    });

    try {
      if (currentlyLiked) {
        await withOfflineSupport(
          isOffline, 'comment_unlike',
          { userId: user.uid, businessId, businessName },
          { commentId },
          () => unlikeComment(user.uid, commentId),
          toast,
        );
      } else {
        await withOfflineSupport(
          isOffline, 'comment_like',
          { userId: user.uid, businessId, businessName },
          { commentId },
          () => likeComment(user.uid, commentId),
          toast,
        );
      }
    } catch (error) {
      setOptimisticLikes((prev) => { const next = new Map(prev); next.delete(commentId); return next; });
      logger.error('Error toggling like:', error);
      toast.error(MSG_COMMENT.likeError);
    } finally {
      togglingIds.current.delete(commentId);
    }
  }, [user, isLiked, businessId, businessName, isOffline, toast]);

  const handleDelete = useCallback((comment: Comment) => {
    markForDelete(comment.id, comment);
  }, [markForDelete]);

  const handleStartReply = useCallback((comment: Comment) => {
    setReplyingTo({ id: comment.id, userName: comment.userName });
    setReplyText('');
    expandThread?.(comment.id);
    setTimeout(() => replyInputRef.current?.focus(), 100);
  }, [expandThread]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyText('');
  }, []);

  const handleSubmitReply = useCallback(async () => {
    if (!user || !replyingTo || !replyText.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      const trimmedReply = replyText.trim();
      await withBusyFlag('comment_submit', async () => {
        await withOfflineSupport(
          isOffline, 'comment_create',
          { userId: user.uid, businessId, businessName },
          { userName: displayName || 'Anónimo', text: trimmedReply, parentId: replyingTo.id },
          () => addComment(user.uid, displayName || 'Anónimo', businessId, trimmedReply, replyingTo.id),
          toast,
        );
      });
      setReplyingTo(null);
      setReplyText('');
      onCommentsChange();
      if (!isOffline) toast.success(MSG_COMMENT.replySuccess);
    } catch (error) {
      logger.error('Error adding reply:', error);
      toast.error(MSG_COMMENT.replyError);
    }
    setIsSubmitting(false);
  }, [user, replyingTo, replyText, userCommentsToday, isOffline, businessId, businessName, displayName, onCommentsChange, toast]);

  const handleShowProfile = useCallback((userId: string, userName: string) => {
    setProfileUser({ id: userId, name: userName });
  }, []);

  const closeProfile = useCallback(() => {
    setProfileUser(null);
  }, []);

  return {
    user,
    displayName,
    isOffline,
    profileVisibility,
    isPendingDelete,
    handleDelete,
    deleteSnackbarProps,
    isLiked,
    getLikeCount,
    handleToggleLike,
    replyingTo,
    replyText,
    replyInputRef,
    setReplyText,
    handleStartReply,
    handleCancelReply,
    handleSubmitReply,
    isSubmitting,
    profileUser,
    handleShowProfile,
    closeProfile,
    userCommentsToday,
  };
}
