import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCommentSort } from './useCommentSort';
import type { Comment } from '../types';

function makeComment(id: string, likeCount: number, daysAgo: number): Comment {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    userId: 'u1',
    userName: 'Test',
    businessId: 'b1',
    text: `Comment ${id}`,
    createdAt: date,
    likeCount,
  };
}

describe('useCommentSort', () => {
  const comments = [
    makeComment('old', 2, 5),
    makeComment('new', 1, 0),
    makeComment('mid', 10, 2),
  ];

  it('defaults to recent sort', () => {
    const { result } = renderHook(() => useCommentSort(comments));
    expect(result.current.sortMode).toBe('recent');
    expect(result.current.sorted[0].id).toBe('new');
    expect(result.current.sorted[2].id).toBe('old');
  });

  it('sorts by oldest', () => {
    const { result } = renderHook(() => useCommentSort(comments));
    act(() => result.current.setSortMode('oldest'));
    expect(result.current.sorted[0].id).toBe('old');
    expect(result.current.sorted[2].id).toBe('new');
  });

  it('sorts by most liked', () => {
    const { result } = renderHook(() => useCommentSort(comments));
    act(() => result.current.setSortMode('useful'));
    expect(result.current.sorted[0].id).toBe('mid');
    expect(result.current.sorted[0].likeCount).toBe(10);
  });

  it('returns empty array for empty input', () => {
    const { result } = renderHook(() => useCommentSort([]));
    expect(result.current.sorted).toEqual([]);
  });
});
