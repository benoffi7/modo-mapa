import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUndoDelete } from './useUndoDelete';

describe('useUndoDelete', () => {
  const mockOnConfirmDelete = vi.fn();
  const mockOnDeleteComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockOnConfirmDelete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial state with no pending deletes', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    expect(result.current.isPendingDelete('any-id')).toBe(false);
    expect(result.current.snackbarProps.open).toBe(false);
    expect(result.current.snackbarProps.message).toBe('Eliminado');
    expect(result.current.snackbarProps.autoHideDuration).toBe(5000);
  });

  it('marks an item for deletion and shows snackbar', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });

    expect(result.current.isPendingDelete('item-1')).toBe(true);
    expect(result.current.snackbarProps.open).toBe(true);
  });

  it('confirms delete after timeout', async () => {
    const { result } = renderHook(() =>
      useUndoDelete({
        onConfirmDelete: mockOnConfirmDelete,
        onDeleteComplete: mockOnDeleteComplete,
        timeout: 3000,
      }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });

    expect(mockOnConfirmDelete).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(mockOnConfirmDelete).toHaveBeenCalledWith({ name: 'Test' });
    expect(mockOnDeleteComplete).toHaveBeenCalled();
  });

  it('undoes a specific delete by id', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });
    expect(result.current.isPendingDelete('item-1')).toBe(true);

    act(() => { result.current.undoDelete('item-1'); });

    expect(result.current.isPendingDelete('item-1')).toBe(false);
    expect(result.current.snackbarProps.open).toBe(false);
  });

  it('undoLast undoes the most recent delete', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'First' }); });
    act(() => { result.current.markForDelete('item-2', { name: 'Second' }); });

    act(() => { result.current.undoLast(); });

    expect(result.current.isPendingDelete('item-2')).toBe(false);
    // item-1 is still pending
    expect(result.current.isPendingDelete('item-1')).toBe(true);
  });

  it('uses custom message', () => {
    const { result } = renderHook(() =>
      useUndoDelete({
        onConfirmDelete: mockOnConfirmDelete,
        message: 'Comentario eliminado',
      }),
    );

    expect(result.current.snackbarProps.message).toBe('Comentario eliminado');
  });

  it('uses custom timeout', async () => {
    const { result } = renderHook(() =>
      useUndoDelete({
        onConfirmDelete: mockOnConfirmDelete,
        timeout: 2000,
      }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });

    await act(async () => { vi.advanceTimersByTime(1999); });
    expect(mockOnConfirmDelete).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(1); });
    expect(mockOnConfirmDelete).toHaveBeenCalled();
  });

  it('replaces timer when marking same id again', async () => {
    const { result } = renderHook(() =>
      useUndoDelete({
        onConfirmDelete: mockOnConfirmDelete,
        timeout: 3000,
      }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'First' }); });
    // Advance partially
    await act(async () => { vi.advanceTimersByTime(2000); });

    // Re-mark with different item
    act(() => { result.current.markForDelete('item-1', { name: 'Replaced' }); });

    // Original timer would fire at 3000, but it was replaced
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mockOnConfirmDelete).not.toHaveBeenCalled();

    // New timer fires at 3000 from re-mark
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mockOnConfirmDelete).toHaveBeenCalledWith({ name: 'Replaced' });
  });

  it('does not call onConfirmDelete after undo', async () => {
    const { result } = renderHook(() =>
      useUndoDelete({
        onConfirmDelete: mockOnConfirmDelete,
        timeout: 3000,
      }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });
    act(() => { result.current.undoDelete('item-1'); });

    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(mockOnConfirmDelete).not.toHaveBeenCalled();
  });

  it('handles onConfirmDelete error silently', async () => {
    mockOnConfirmDelete.mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });

    // Should not throw
    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(mockOnConfirmDelete).toHaveBeenCalled();
  });

  it('snackbarProps.onClose hides snackbar', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });
    expect(result.current.snackbarProps.open).toBe(true);

    act(() => { result.current.snackbarProps.onClose(); });
    expect(result.current.snackbarProps.open).toBe(false);
  });

  it('snackbarProps.onUndo calls undoLast', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });

    act(() => { result.current.snackbarProps.onUndo(); });

    expect(result.current.isPendingDelete('item-1')).toBe(false);
  });

  it('undoDelete for non-existent id does not crash', () => {
    const { result } = renderHook(() =>
      useUndoDelete({ onConfirmDelete: mockOnConfirmDelete }),
    );

    act(() => { result.current.undoDelete('nonexistent'); });
    expect(result.current.snackbarProps.open).toBe(false);
  });

  it('cleans up timers on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useUndoDelete({
        onConfirmDelete: mockOnConfirmDelete,
        timeout: 3000,
      }),
    );

    act(() => { result.current.markForDelete('item-1', { name: 'Test' }); });

    unmount();

    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(mockOnConfirmDelete).not.toHaveBeenCalled();
  });
});
