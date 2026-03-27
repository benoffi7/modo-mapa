import { useState, useMemo, useCallback } from 'react';
import type { Comment } from '../types';

interface UseCommentThreadsResult {
  topLevelComments: Comment[];
  repliesByParent: Map<string, Comment[]>;
  expandedThreads: Set<string>;
  toggleThread: (commentId: string) => void;
  expandThread: (commentId: string) => void;
}

/**
 * Groups flat comments into threads: top-level + replies by parentId.
 * Replies are sorted chronologically (oldest first).
 */
export function useCommentThreads(comments: Comment[]): UseCommentThreadsResult {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const topLevel: Comment[] = [];
    const replies = new Map<string, Comment[]>();

    for (const c of comments) {
      if (c.parentId) {
        const existing = replies.get(c.parentId) ?? [];
        existing.push(c);
        replies.set(c.parentId, existing);
      } else {
        topLevel.push(c);
      }
    }

    // Sort replies chronologically
    for (const [key, arr] of replies) {
      replies.set(key, arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    }

    return { topLevelComments: topLevel, repliesByParent: replies };
  }, [comments]);

  const toggleThread = useCallback((commentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  const expandThread = useCallback((commentId: string) => {
    setExpandedThreads((prev) => new Set(prev).add(commentId));
  }, []);

  return { topLevelComments, repliesByParent, expandedThreads, toggleThread, expandThread };
}
