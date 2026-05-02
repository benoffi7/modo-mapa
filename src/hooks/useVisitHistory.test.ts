import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/businessMap', () => ({
  getBusinessById: vi.fn((id: string) => {
    if (id === 'biz_001') {
      return { id: 'biz_001', name: 'Café Central', category: 'cafe', lat: -34.6, lng: -58.4, address: 'Av 1', tags: [] };
    }
    return undefined;
  }),
}));

import { useVisitHistory } from './useVisitHistory';
import { STORAGE_KEY_VISITS, MAX_VISIT_HISTORY } from '../constants';
import { getBusinessById } from '../utils/businessMap';

describe('useVisitHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts empty when no visits stored', () => {
    const { result } = renderHook(() => useVisitHistory());
    expect(result.current.visits).toEqual([]);
  });

  it('records a new visit and resolves business via getBusinessById singleton', () => {
    const { result } = renderHook(() => useVisitHistory());

    act(() => { result.current.recordVisit('biz_001'); });

    expect(result.current.visits).toHaveLength(1);
    expect(result.current.visits[0].businessId).toBe('biz_001');
    expect(result.current.visits[0].business).not.toBeNull();
    expect(result.current.visits[0].business?.id).toBe('biz_001');
    expect(getBusinessById).toHaveBeenCalledWith('biz_001');
  });

  it('returns business: null for visits with unknown businessId (singleton miss / unhydrated)', () => {
    localStorage.setItem(
      STORAGE_KEY_VISITS,
      JSON.stringify([{ businessId: 'biz_unknown', lastVisited: '2026-01-01T00:00:00.000Z', visitCount: 1 }]),
    );

    const { result } = renderHook(() => useVisitHistory());

    expect(result.current.visits).toHaveLength(1);
    expect(result.current.visits[0].business).toBeNull();
  });

  it('increments visitCount when recording a repeat visit', () => {
    const { result } = renderHook(() => useVisitHistory());

    act(() => { result.current.recordVisit('biz_001'); });
    act(() => { result.current.recordVisit('biz_001'); });

    expect(result.current.visits).toHaveLength(1);
    expect(result.current.visits[0].visitCount).toBe(2);
  });

  it('clears history', () => {
    const { result } = renderHook(() => useVisitHistory());

    act(() => { result.current.recordVisit('biz_001'); });
    act(() => { result.current.clearHistory(); });

    expect(result.current.visits).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY_VISITS)).toBeNull();
  });

  it('caps visits at MAX_VISIT_HISTORY when inserting a new business', () => {
    // Pre-populate localStorage with MAX_VISIT_HISTORY entries
    const seeded = Array.from({ length: MAX_VISIT_HISTORY }, (_, i) => ({
      businessId: `seed_${i}`,
      lastVisited: `2026-01-${String((i % 30) + 1).padStart(2, '0')}T00:00:00.000Z`,
      visitCount: 1,
    }));
    localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(seeded));

    const { result } = renderHook(() => useVisitHistory());
    expect(result.current.visits).toHaveLength(MAX_VISIT_HISTORY);

    act(() => { result.current.recordVisit('biz_overflow'); });

    expect(result.current.visits).toHaveLength(MAX_VISIT_HISTORY);
    // New entry is at head
    expect(result.current.visits[0].businessId).toBe('biz_overflow');
    // Oldest seed (the last one in the prepended list) is dropped
    const ids = result.current.visits.map((v) => v.businessId);
    expect(ids).not.toContain(`seed_${MAX_VISIT_HISTORY - 1}`);
  });

  it('returns empty visits when localStorage payload is corrupt JSON (parse fallback)', () => {
    localStorage.setItem(STORAGE_KEY_VISITS, '{not-json');
    const { result } = renderHook(() => useVisitHistory());
    expect(result.current.visits).toEqual([]);
  });
});
