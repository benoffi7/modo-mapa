import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCommentEdit } from './useCommentEdit';
import type { Comment } from '../types';

function makeComment(id: string, text: string): Comment {
  return {
    id,
    userId: 'u1',
    userName: 'Test',
    businessId: 'b1',
    text,
    createdAt: new Date(),
    likeCount: 0,
  };
}

describe('useCommentEdit', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() =>
      useCommentEdit({ onSave: vi.fn() }),
    );
    expect(result.current.editingId).toBeNull();
    expect(result.current.editText).toBe('');
    expect(result.current.isSavingEdit).toBe(false);
  });

  it('startEdit sets editing state', () => {
    const { result } = renderHook(() =>
      useCommentEdit({ onSave: vi.fn() }),
    );
    act(() => result.current.startEdit(makeComment('c1', 'Hello')));
    expect(result.current.editingId).toBe('c1');
    expect(result.current.editText).toBe('Hello');
  });

  it('cancelEdit clears editing state', () => {
    const { result } = renderHook(() =>
      useCommentEdit({ onSave: vi.fn() }),
    );
    act(() => result.current.startEdit(makeComment('c1', 'Hello')));
    act(() => result.current.cancelEdit());
    expect(result.current.editingId).toBeNull();
    expect(result.current.editText).toBe('');
  });

  it('saveEdit calls onSave and clears state', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSaveComplete = vi.fn();
    const { result } = renderHook(() =>
      useCommentEdit({ onSave, onSaveComplete }),
    );

    act(() => result.current.startEdit(makeComment('c1', 'Hello')));
    await act(async () => {
      await result.current.saveEdit();
    });

    expect(onSave).toHaveBeenCalledWith('c1', 'Hello');
    expect(onSaveComplete).toHaveBeenCalled();
    expect(result.current.editingId).toBeNull();
    expect(result.current.editText).toBe('');
  });

  it('saveEdit does nothing when editText is empty', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useCommentEdit({ onSave }),
    );

    act(() => result.current.startEdit(makeComment('c1', 'Hello')));
    act(() => result.current.setEditText('   '));
    await act(async () => {
      await result.current.saveEdit();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('setEditText updates the text', () => {
    const { result } = renderHook(() =>
      useCommentEdit({ onSave: vi.fn() }),
    );
    act(() => result.current.startEdit(makeComment('c1', 'Hello')));
    act(() => result.current.setEditText('Updated'));
    expect(result.current.editText).toBe('Updated');
  });
});
