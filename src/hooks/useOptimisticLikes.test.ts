import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useOptimisticLikes } from './useOptimisticLikes';

describe('useOptimisticLikes', () => {
  const userLikes = new Set(['c1']);

  it('returns server state when no optimistic updates', () => {
    const { result } = renderHook(() =>
      useOptimisticLikes({ userLikes, toggleAction: vi.fn() }),
    );
    expect(result.current.isLiked('c1')).toBe(true);
    expect(result.current.isLiked('c2')).toBe(false);
  });

  it('returns correct like count from server', () => {
    const { result } = renderHook(() =>
      useOptimisticLikes({ userLikes, toggleAction: vi.fn() }),
    );
    expect(result.current.getLikeCount('c1', 5)).toBe(5);
    expect(result.current.getLikeCount('c2', 0)).toBe(0);
  });

  it('optimistically toggles like on', async () => {
    const toggleAction = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOptimisticLikes({ userLikes: new Set(), toggleAction }),
    );

    await act(async () => {
      await result.current.toggleLike('c1');
    });

    expect(result.current.isLiked('c1')).toBe(true);
    expect(result.current.getLikeCount('c1', 3)).toBe(4);
    expect(toggleAction).toHaveBeenCalledWith('c1', false);
  });

  it('optimistically toggles like off', async () => {
    const toggleAction = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOptimisticLikes({ userLikes: new Set(['c1']), toggleAction }),
    );

    await act(async () => {
      await result.current.toggleLike('c1');
    });

    expect(result.current.isLiked('c1')).toBe(false);
    expect(result.current.getLikeCount('c1', 5)).toBe(4);
    expect(toggleAction).toHaveBeenCalledWith('c1', true);
  });

  it('reverts optimistic state on error', async () => {
    const toggleAction = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      useOptimisticLikes({ userLikes: new Set(), toggleAction }),
    );

    await act(async () => {
      try { await result.current.toggleLike('c1'); } catch { /* expected */ }
    });

    // Should revert to server state
    expect(result.current.isLiked('c1')).toBe(false);
    expect(result.current.getLikeCount('c1', 3)).toBe(3);
  });

  it('getLikeCount never returns negative', () => {
    const { result } = renderHook(() =>
      useOptimisticLikes({ userLikes, toggleAction: vi.fn() }),
    );
    expect(result.current.getLikeCount('c1', 0)).toBe(0);
  });
});
