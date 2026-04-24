import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  commentsProps: null as Record<string, unknown> | null,
  questionsProps: null as Record<string, unknown> | null,
}));

vi.mock('../BusinessComments', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.commentsProps = props;
    return <div data-testid="business-comments-stub" />;
  },
}));

vi.mock('../BusinessQuestions', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.questionsProps = props;
    return <div data-testid="business-questions-stub" />;
  },
}));

import OpinionesTab from '../OpinionesTab';

const baseProps = {
  comments: [],
  regularComments: [],
  userCommentLikes: new Set<string>(),
  isLoading: false,
  onCommentsChange: vi.fn(),
};

describe('OpinionesTab', () => {
  beforeEach(() => {
    mocks.commentsProps = null;
    mocks.questionsProps = null;
    baseProps.onCommentsChange = vi.fn();
  });

  it('renderiza sin requerir onDirtyChange', () => {
    render(<OpinionesTab {...baseProps} />);
    expect(screen.getByTestId('business-comments-stub')).toBeInTheDocument();
    expect(screen.getByTestId('business-questions-stub')).toBeInTheDocument();
  });

  it('no forwardea onDirtyChange a BusinessComments (prop eliminada)', () => {
    render(<OpinionesTab {...baseProps} />);
    expect(mocks.commentsProps).not.toBeNull();
    expect(mocks.commentsProps).not.toHaveProperty('onDirtyChange');
  });

  it('al montar, el sub-tab Comentarios esta visible y Preguntas oculto', () => {
    const { container } = render(<OpinionesTab {...baseProps} />);
    const commentsPanel = container.querySelector('[data-testid="business-comments-stub"]')!.parentElement as HTMLElement;
    const questionsPanel = container.querySelector('[data-testid="business-questions-stub"]')!.parentElement as HTMLElement;
    expect(window.getComputedStyle(commentsPanel).display).toBe('block');
    expect(window.getComputedStyle(questionsPanel).display).toBe('none');
  });

  it('click en el tab Preguntas cambia la visibilidad', () => {
    const { container } = render(<OpinionesTab {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Preguntas' }));
    const commentsPanel = container.querySelector('[data-testid="business-comments-stub"]')!.parentElement as HTMLElement;
    const questionsPanel = container.querySelector('[data-testid="business-questions-stub"]')!.parentElement as HTMLElement;
    expect(window.getComputedStyle(commentsPanel).display).toBe('none');
    expect(window.getComputedStyle(questionsPanel).display).toBe('block');
  });

  it('forwardea onCommentsChange a BusinessComments y BusinessQuestions', () => {
    const onCommentsChange = vi.fn();
    render(<OpinionesTab {...baseProps} onCommentsChange={onCommentsChange} />);
    expect(mocks.commentsProps?.onCommentsChange).toBe(onCommentsChange);
    expect(mocks.questionsProps?.onCommentsChange).toBe(onCommentsChange);
  });
});
