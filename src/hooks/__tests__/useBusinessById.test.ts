import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../usePriceLevelFilter', () => ({ usePriceLevelFilter: () => new Map() }));
vi.mock('../../context/FiltersContext', () => ({
  useFilters: () => ({ searchQuery: '', activeFilters: [], activePriceFilter: null }),
  FiltersContext: { Provider: ({ children }: { children: unknown }) => children },
}));

import { useBusinessById } from '../useBusinessById';
import { allBusinesses } from '../useBusinesses';

describe('useBusinessById', () => {
  const existingId = allBusinesses[0].id;

  it('returns found + business for a valid existing ID', () => {
    const { result } = renderHook(() => useBusinessById(existingId));
    expect(result.current.status).toBe('found');
    expect(result.current.business).not.toBeNull();
    expect(result.current.business?.id).toBe(existingId);
  });

  it('returns not_found + null for a valid-format ID that does not exist', () => {
    const { result } = renderHook(() => useBusinessById('biz_999999'));
    expect(result.current.status).toBe('not_found');
    expect(result.current.business).toBeNull();
  });

  it('returns invalid_id for a malformed ID', () => {
    const { result } = renderHook(() => useBusinessById('not-a-valid-id'));
    expect(result.current.status).toBe('invalid_id');
    expect(result.current.business).toBeNull();
  });

  it('returns invalid_id for undefined', () => {
    const { result } = renderHook(() => useBusinessById(undefined));
    expect(result.current.status).toBe('invalid_id');
    expect(result.current.business).toBeNull();
  });

  it('returns invalid_id for empty string', () => {
    const { result } = renderHook(() => useBusinessById(''));
    expect(result.current.status).toBe('invalid_id');
    expect(result.current.business).toBeNull();
  });

  it('returns invalid_id for an ID with too many digits', () => {
    const { result } = renderHook(() => useBusinessById('biz_1234567'));
    expect(result.current.status).toBe('invalid_id');
    expect(result.current.business).toBeNull();
  });
});
