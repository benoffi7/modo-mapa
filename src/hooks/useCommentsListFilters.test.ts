import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/businessMap', () => ({
  getBusinessById: vi.fn((id: string) => {
    if (id === 'biz_001') {
      return { id: 'biz_001', name: 'Café Central', category: 'cafe', lat: -34.6, lng: -58.4, address: 'Av 1', tags: [] };
    }
    if (id === 'biz_002') {
      return { id: 'biz_002', name: 'Pizzería Roma', category: 'pizza', lat: -34.61, lng: -58.41, address: 'Av 2', tags: [] };
    }
    return undefined;
  }),
}));

import { useCommentsListFilters } from './useCommentsListFilters';
import { getBusinessById } from '../utils/businessMap';
import type { Comment } from '../types';

function makeComment(id: string, businessId: string, text = 'comentario', likeCount = 0): Comment {
  return {
    id,
    businessId,
    userId: 'user_1',
    userName: 'Usuario',
    text,
    likeCount,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Comment;
}

describe('useCommentsListFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves business via getBusinessById singleton for each item', () => {
    const rawItems = [makeComment('c1', 'biz_001'), makeComment('c2', 'biz_002')];
    const { result } = renderHook(() =>
      useCommentsListFilters({
        rawItems,
        isPendingDelete: () => false,
        hasMore: false,
        loadAll: vi.fn(),
      }),
    );

    expect(result.current.comments).toHaveLength(2);
    expect(result.current.comments[0].business?.id).toBe('biz_001');
    expect(result.current.comments[1].business?.id).toBe('biz_002');
    expect(getBusinessById).toHaveBeenCalledWith('biz_001');
    expect(getBusinessField('biz_002')).toBeDefined();
  });

  it('returns business: null when businessId is unknown (singleton miss / unhydrated)', () => {
    const rawItems = [makeComment('c1', 'biz_unknown')];
    const { result } = renderHook(() =>
      useCommentsListFilters({
        rawItems,
        isPendingDelete: () => false,
        hasMore: false,
        loadAll: vi.fn(),
      }),
    );

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].business).toBeNull();
  });

  it('filters out items pending delete', () => {
    const rawItems = [makeComment('c1', 'biz_001'), makeComment('c2', 'biz_002')];
    const { result } = renderHook(() =>
      useCommentsListFilters({
        rawItems,
        isPendingDelete: (id) => id === 'c1',
        hasMore: false,
        loadAll: vi.fn(),
      }),
    );

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].id).toBe('c2');
  });

  it('builds businessOptions from resolved businesses (deduplicated)', () => {
    const rawItems = [
      makeComment('c1', 'biz_001'),
      makeComment('c2', 'biz_001'),
      makeComment('c3', 'biz_002'),
      makeComment('c4', 'biz_unknown'),
    ];
    const { result } = renderHook(() =>
      useCommentsListFilters({
        rawItems,
        isPendingDelete: () => false,
        hasMore: false,
        loadAll: vi.fn(),
      }),
    );

    expect(result.current.businessOptions).toHaveLength(2);
    expect(result.current.businessOptions.map((b) => b.id).sort()).toEqual(['biz_001', 'biz_002']);
  });
});

// Helper used in the first test — keeps the assertion explicit on the singleton spy
function getBusinessField(id: string) {
  return (getBusinessById as unknown as ReturnType<typeof vi.fn>).mock.results.find(
    (_, idx) => (getBusinessById as unknown as ReturnType<typeof vi.fn>).mock.calls[idx]?.[0] === id,
  )?.value;
}
