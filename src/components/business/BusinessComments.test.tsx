import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Comment } from '../../types';

const mocks = vi.hoisted(() => ({
  isOffline: true,
  user: { uid: 'me' } as { uid: string } | null,
  editComment: vi.fn().mockResolvedValue(undefined),
  withOfflineSupport: vi.fn().mockResolvedValue(undefined),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => mocks.toast,
}));

vi.mock('../../context/BusinessScopeContext', () => ({
  useBusinessScope: () => ({ businessId: 'biz1', businessName: 'Café Luna' }),
}));

vi.mock('../../services/comments', () => ({
  addComment: vi.fn().mockResolvedValue(undefined),
  editComment: (...a: unknown[]) => mocks.editComment(...a),
}));

vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: (...a: unknown[]) => mocks.withOfflineSupport(...a),
}));

vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: (_f: string, fn: () => Promise<void>) => fn(),
}));

// useCommentListBase: stub minimal contract used by BusinessComments.
vi.mock('../../hooks/useCommentListBase', () => ({
  useCommentListBase: () => ({
    user: mocks.user,
    displayName: 'Yo',
    isOffline: mocks.isOffline,
    profileVisibility: new Map(),
    isPendingDelete: () => false,
    handleDelete: vi.fn(),
    deleteSnackbarProps: { open: false, message: '', onUndo: vi.fn(), autoHideDuration: 5000, onClose: vi.fn() },
    isLiked: () => false,
    getLikeCount: () => 0,
    handleToggleLike: vi.fn(),
    replyingTo: null,
    replyText: '',
    replyInputRef: { current: null },
    setReplyText: vi.fn(),
    handleStartReply: vi.fn(),
    handleCancelReply: vi.fn(),
    handleSubmitReply: vi.fn(),
    isSubmitting: false,
    profileUser: null,
    handleShowProfile: vi.fn(),
    closeProfile: vi.fn(),
    userCommentsToday: 0,
  }),
}));

// CommentRow stub: muestra el texto y expone controles de edicion.
vi.mock('./CommentRow', () => ({
  default: ({ comment, isEditing, editText, onStartEdit, onEditTextChange, onSaveEdit }: {
    comment: Comment;
    isEditing: boolean;
    editText: string;
    onStartEdit?: (c: Comment) => void;
    onEditTextChange?: (t: string) => void;
    onSaveEdit?: () => void;
  }) => (
    <div>
      <span data-testid={`text-${comment.id}`}>{comment.text}</span>
      {!isEditing && (
        <button onClick={() => onStartEdit?.(comment)}>edit-{comment.id}</button>
      )}
      {isEditing && (
        <>
          <input
            data-testid={`edit-input-${comment.id}`}
            value={editText}
            onChange={(e) => onEditTextChange?.(e.target.value)}
          />
          <button onClick={() => onSaveEdit?.()}>save-{comment.id}</button>
        </>
      )}
    </div>
  ),
}));

vi.mock('./CommentInput', () => ({ default: () => <div /> }));
vi.mock('./InlineReplyForm', () => ({ default: () => <div /> }));
vi.mock('../common/CommentListFooter', () => ({ default: () => <div /> }));

import BusinessComments from './BusinessComments';

function makeComment(id: string, text: string): Comment {
  return {
    id,
    userId: 'me',
    userName: 'Yo',
    businessId: 'biz1',
    text,
    createdAt: new Date('2024-01-01'),
    likeCount: 0,
  } as Comment;
}

describe('BusinessComments — #340 W2: edit optimista offline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOffline = true;
    mocks.user = { uid: 'me' };
  });

  it('offline: tras editar, muestra el texto nuevo aunque el refetch traiga el viejo', async () => {
    const original = makeComment('c1', 'texto viejo');
    const { rerender } = render(
      <BusinessComments
        comments={[original]}
        userCommentLikes={new Set()}
        isLoading={false}
        onCommentsChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('text-c1').textContent).toBe('texto viejo');

    fireEvent.click(screen.getByText('edit-c1'));
    fireEvent.change(screen.getByTestId('edit-input-c1'), { target: { value: 'texto nuevo' } });
    await act(async () => {
      fireEvent.click(screen.getByText('save-c1'));
    });

    // Override optimista aplicado.
    expect(screen.getByTestId('text-c1').textContent).toBe('texto nuevo');

    // El refetch (parent) re-renderiza con el texto viejo: el override debe persistir.
    rerender(
      <BusinessComments
        comments={[makeComment('c1', 'texto viejo')]}
        userCommentLikes={new Set()}
        isLoading={false}
        onCommentsChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('text-c1').textContent).toBe('texto nuevo');
  });

  it('limpia el override cuando el refetch ya refleja el texto editado (sincronizado)', async () => {
    const { rerender } = render(
      <BusinessComments
        comments={[makeComment('c1', 'texto viejo')]}
        userCommentLikes={new Set()}
        isLoading={false}
        onCommentsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('edit-c1'));
    fireEvent.change(screen.getByTestId('edit-input-c1'), { target: { value: 'texto nuevo' } });
    await act(async () => {
      fireEvent.click(screen.getByText('save-c1'));
    });
    expect(screen.getByTestId('text-c1').textContent).toBe('texto nuevo');

    // Replay sincroniza → refetch trae el texto editado. El override se limpia (sin romper UI).
    await act(async () => {
      rerender(
        <BusinessComments
          comments={[makeComment('c1', 'texto nuevo')]}
          userCommentLikes={new Set()}
          isLoading={false}
          onCommentsChange={vi.fn()}
        />,
      );
    });

    expect(screen.getByTestId('text-c1').textContent).toBe('texto nuevo');
  });
});
