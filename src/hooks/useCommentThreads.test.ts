import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCommentThreads } from './useCommentThreads';
import type { Comment } from '../types';

function makeComment(id: string, parentId?: string, daysAgo = 0): Comment {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const base: Comment = {
    id,
    userId: 'u1',
    userName: 'Test',
    businessId: 'b1',
    text: `Comment ${id}`,
    createdAt: date,
    likeCount: 0,
  };
  if (parentId !== undefined) base.parentId = parentId;
  return base;
}

describe('useCommentThreads', () => {
  it('separates top-level comments from replies', () => {
    const comments = [
      makeComment('root1'),
      makeComment('reply1', 'root1'),
      makeComment('root2'),
    ];

    const { result } = renderHook(() => useCommentThreads(comments));
    expect(result.current.topLevelComments).toHaveLength(2);
    expect(result.current.repliesByParent.get('root1')).toHaveLength(1);
    expect(result.current.repliesByParent.has('root2')).toBe(false);
  });

  it('sorts replies chronologically (oldest first)', () => {
    const comments = [
      makeComment('root1'),
      makeComment('reply2', 'root1', 0),
      makeComment('reply1', 'root1', 2),
    ];

    const { result } = renderHook(() => useCommentThreads(comments));
    const replies = result.current.repliesByParent.get('root1')!;
    expect(replies[0].id).toBe('reply1');
    expect(replies[1].id).toBe('reply2');
  });

  it('toggleThread expands and collapses', () => {
    const comments = [makeComment('root1')];
    const { result } = renderHook(() => useCommentThreads(comments));

    expect(result.current.expandedThreads.has('root1')).toBe(false);

    act(() => result.current.toggleThread('root1'));
    expect(result.current.expandedThreads.has('root1')).toBe(true);

    act(() => result.current.toggleThread('root1'));
    expect(result.current.expandedThreads.has('root1')).toBe(false);
  });

  it('expandThread only expands, never collapses', () => {
    const comments = [makeComment('root1')];
    const { result } = renderHook(() => useCommentThreads(comments));

    act(() => result.current.expandThread('root1'));
    expect(result.current.expandedThreads.has('root1')).toBe(true);

    act(() => result.current.expandThread('root1'));
    expect(result.current.expandedThreads.has('root1')).toBe(true);
  });

  it('handles empty comments array', () => {
    const { result } = renderHook(() => useCommentThreads([]));
    expect(result.current.topLevelComments).toHaveLength(0);
    expect(result.current.repliesByParent.size).toBe(0);
  });
});
