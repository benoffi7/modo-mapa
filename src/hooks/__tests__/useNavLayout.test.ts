import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useNavLayout } from '../useNavLayout';

describe('useNavLayout', () => {
  it('returns bottom position with TAB_BAR_HEIGHT offset by default', () => {
    const { result } = renderHook(() => useNavLayout());

    expect(result.current.position).toBe('bottom');
    expect(result.current.offset).toBe(64);
  });

  it('returns stable reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useNavLayout());
    const first = result.current;
    rerender();
    expect(result.current).toEqual(first);
  });
});
