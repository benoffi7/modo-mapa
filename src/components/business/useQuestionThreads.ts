import { useState, useMemo, useCallback } from 'react';
import { trackEvent } from '../../utils/analytics';
import type { Comment } from '../../types';

interface UseQuestionThreadsResult {
  questions: Comment[];
  answersByQuestion: Map<string, Comment[]>;
  expandedQuestions: Set<string>;
  toggleQuestion: (questionId: string) => void;
  expandQuestion: (questionId: string) => void;
  getAnswerCount: (question: Comment) => number;
}

/**
 * Separates comments into questions and answers, with Q&A-specific logic:
 * - Answers sorted by likeCount descending (best answer first)
 * - Questions sorted by date descending
 * - Only answers whose parentId matches a question are included
 * - Analytics tracking on expand
 */
export function useQuestionThreads(comments: Comment[], businessId: string): UseQuestionThreadsResult {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const { questions, answersByQuestion } = useMemo(() => {
    const qs: Comment[] = [];
    const answers = new Map<string, Comment[]>();

    for (const c of comments) {
      if (c.type === 'question' && !c.parentId) {
        qs.push(c);
      } else if (c.parentId) {
        const existing = answers.get(c.parentId) ?? [];
        existing.push(c);
        answers.set(c.parentId, existing);
      }
    }

    // Sort answers by likeCount desc (best answer first)
    for (const [key, arr] of answers) {
      answers.set(key, arr.sort((a, b) => b.likeCount - a.likeCount));
    }

    // Sort questions by date desc
    qs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Filter answers to only those belonging to questions
    const questionIds = new Set(qs.map((q) => q.id));
    const filtered = new Map<string, Comment[]>();
    for (const [parentId, answerList] of answers) {
      if (questionIds.has(parentId)) {
        filtered.set(parentId, answerList);
      }
    }

    return { questions: qs, answersByQuestion: filtered };
  }, [comments]);

  const toggleQuestion = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
        trackEvent('question_viewed', { business_id: businessId, question_id: questionId });
      }
      return next;
    });
  }, [businessId]);

  const expandQuestion = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => new Set(prev).add(questionId));
  }, []);

  const getAnswerCount = useCallback((question: Comment): number => {
    const localAnswers = answersByQuestion.get(question.id);
    return question.replyCount ?? localAnswers?.length ?? 0;
  }, [answersByQuestion]);

  return { questions, answersByQuestion, expandedQuestions, toggleQuestion, expandQuestion, getAnswerCount };
}
