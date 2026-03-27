import { useState, useMemo } from 'react';
import type { Comment } from '../types';

export type SortMode = 'recent' | 'oldest' | 'useful';

/**
 * Sorts a list of Comments by the selected sort mode.
 */
export function useCommentSort(items: Comment[]) {
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const sorted = useMemo(() => {
    const list = [...items];
    switch (sortMode) {
      case 'recent':
        return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      case 'oldest':
        return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      case 'useful':
        return list.sort((a, b) => b.likeCount - a.likeCount);
    }
  }, [items, sortMode]);

  return { sortMode, setSortMode, sorted };
}
