import { useState, useCallback } from 'react';

interface OptimisticLikeEntry {
  toggled: boolean;
  delta: number;
}

interface UseOptimisticLikesOptions {
  /** The set of comment IDs the user has already liked (server state) */
  userLikes: Set<string>;
  /** Async action to toggle a like. Receives commentId and currentlyLiked. */
  toggleAction: (commentId: string, currentlyLiked: boolean) => Promise<void>;
}

export function useOptimisticLikes({ userLikes, toggleAction }: UseOptimisticLikesOptions) {
  const [optimistic, setOptimistic] = useState<Map<string, OptimisticLikeEntry>>(new Map());

  const isLiked = useCallback((commentId: string): boolean => {
    const entry = optimistic.get(commentId);
    if (entry) return entry.toggled;
    return userLikes.has(commentId);
  }, [userLikes, optimistic]);

  const getLikeCount = useCallback((commentId: string, serverCount: number): number => {
    const delta = optimistic.get(commentId)?.delta ?? 0;
    return Math.max(0, serverCount + delta);
  }, [optimistic]);

  const toggleLike = useCallback(async (commentId: string) => {
    const currentlyLiked = (() => {
      const entry = optimistic.get(commentId);
      if (entry) return entry.toggled;
      return userLikes.has(commentId);
    })();

    // Optimistic update
    setOptimistic((prev) => {
      const current = prev.get(commentId)?.delta ?? 0;
      return new Map(prev).set(commentId, {
        toggled: !currentlyLiked,
        delta: currentlyLiked ? current - 1 : current + 1,
      });
    });

    try {
      await toggleAction(commentId, currentlyLiked);
    } catch {
      // Revert on error
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(commentId);
        return next;
      });
      throw undefined; // re-signal error for callers to handle
    }
  }, [optimistic, userLikes, toggleAction]);

  return { isLiked, getLikeCount, toggleLike };
}
