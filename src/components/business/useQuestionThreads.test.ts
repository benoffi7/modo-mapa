import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useQuestionThreads } from './useQuestionThreads';
import type { Comment } from '../../types';

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

function makeComment(
  id: string,
  overrides: Partial<Comment> = {},
): Comment {
  return {
    id,
    userId: 'u1',
    userName: 'Test',
    businessId: 'b1',
    text: `Text ${id}`,
    createdAt: new Date('2024-01-01'),
    likeCount: 0,
    ...overrides,
  };
}

describe('useQuestionThreads', () => {
  it('separates questions from answers', () => {
    const comments = [
      makeComment('q1', { type: 'question' }),
      makeComment('a1', { parentId: 'q1', type: 'comment' }),
      makeComment('q2', { type: 'question' }),
    ];

    const { result } = renderHook(() => useQuestionThreads(comments, 'b1'));
    expect(result.current.questions).toHaveLength(2);
    expect(result.current.answersByQuestion.get('q1')).toHaveLength(1);
  });

  it('sorts answers by likeCount descending', () => {
    const comments = [
      makeComment('q1', { type: 'question' }),
      makeComment('a1', { parentId: 'q1', likeCount: 1 }),
      makeComment('a2', { parentId: 'q1', likeCount: 5 }),
    ];

    const { result } = renderHook(() => useQuestionThreads(comments, 'b1'));
    const answers = result.current.answersByQuestion.get('q1')!;
    expect(answers[0].id).toBe('a2');
    expect(answers[1].id).toBe('a1');
  });

  it('filters out answers whose parent is not a question', () => {
    const comments = [
      makeComment('q1', { type: 'question' }),
      makeComment('c1', { type: 'comment' }), // regular comment, not a question
      makeComment('a1', { parentId: 'c1' }), // answer to regular comment
      makeComment('a2', { parentId: 'q1' }), // answer to question
    ];

    const { result } = renderHook(() => useQuestionThreads(comments, 'b1'));
    expect(result.current.answersByQuestion.has('c1')).toBe(false);
    expect(result.current.answersByQuestion.get('q1')).toHaveLength(1);
  });

  it('toggleQuestion expands and collapses', () => {
    const comments = [makeComment('q1', { type: 'question' })];
    const { result } = renderHook(() => useQuestionThreads(comments, 'b1'));

    expect(result.current.expandedQuestions.has('q1')).toBe(false);

    act(() => result.current.toggleQuestion('q1'));
    expect(result.current.expandedQuestions.has('q1')).toBe(true);

    act(() => result.current.toggleQuestion('q1'));
    expect(result.current.expandedQuestions.has('q1')).toBe(false);
  });

  it('getAnswerCount uses replyCount if available', () => {
    const comments = [
      makeComment('q1', { type: 'question', replyCount: 5 }),
    ];

    const { result } = renderHook(() => useQuestionThreads(comments, 'b1'));
    expect(result.current.getAnswerCount(comments[0])).toBe(5);
  });

  it('getAnswerCount falls back to local answer count', () => {
    const comments = [
      makeComment('q1', { type: 'question' }),
      makeComment('a1', { parentId: 'q1' }),
      makeComment('a2', { parentId: 'q1' }),
    ];

    const { result } = renderHook(() => useQuestionThreads(comments, 'b1'));
    expect(result.current.getAnswerCount(comments[0])).toBe(2);
  });
});
