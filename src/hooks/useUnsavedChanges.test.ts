import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUnsavedChanges } from './useUnsavedChanges';

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isDirty=false with no values', () => {
    const { result } = renderHook(() => useUnsavedChanges());
    expect(result.current.isDirty).toBe(false);
  });

  it('isDirty=false with empty string', () => {
    const { result } = renderHook(() => useUnsavedChanges(''));
    expect(result.current.isDirty).toBe(false);
  });

  it('isDirty=false with whitespace-only strings', () => {
    const { result } = renderHook(() => useUnsavedChanges('   ', '\t\n', ''));
    expect(result.current.isDirty).toBe(false);
  });

  it('isDirty=true when at least one value has trimmed content', () => {
    const { result } = renderHook(() => useUnsavedChanges('', '  hello  ', ''));
    expect(result.current.isDirty).toBe(true);
  });

  it('confirmClose with isDirty=false executes callback inline and does not open dialog', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges(''));

    act(() => {
      result.current.confirmClose(cb);
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('confirmClose with isDirty=true opens dialog and stores callback in pendingClose ref', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges('typed text'));

    act(() => {
      result.current.confirmClose(cb);
    });

    expect(cb).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(true);
  });

  it('onDiscard closes dialog and executes pending callback', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges('dirty'));

    act(() => {
      result.current.confirmClose(cb);
    });
    expect(result.current.dialogProps.open).toBe(true);

    act(() => {
      result.current.dialogProps.onDiscard();
    });

    expect(result.current.dialogProps.open).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('onDiscard does not throw when pendingClose ref is null (defensive case)', () => {
    const { result } = renderHook(() => useUnsavedChanges('dirty'));

    expect(() => {
      act(() => {
        result.current.dialogProps.onDiscard();
      });
    }).not.toThrow();

    expect(result.current.dialogProps.open).toBe(false);
  });

  it('onKeepEditing closes dialog and clears ref without executing callback', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges('dirty'));

    act(() => {
      result.current.confirmClose(cb);
    });
    expect(result.current.dialogProps.open).toBe(true);

    act(() => {
      result.current.dialogProps.onKeepEditing();
    });

    expect(result.current.dialogProps.open).toBe(false);
    expect(cb).not.toHaveBeenCalled();

    // Confirm ref was cleared: a subsequent onDiscard with no new confirmClose should NOT call cb
    act(() => {
      result.current.dialogProps.onDiscard();
    });
    expect(cb).not.toHaveBeenCalled();
  });
});
