import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  setSelectedBusiness: vi.fn(),
  setActiveTab: vi.fn(),
  setSearchParams: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
}));

vi.mock('../../context/SelectionContext', () => ({
  useSelection: () => ({ setSelectedBusiness: mocks.setSelectedBusiness }),
}));

vi.mock('../../context/TabContext', () => ({
  useTab: () => ({ setActiveTab: mocks.setActiveTab }),
}));

vi.mock('../usePriceLevelFilter', () => ({ usePriceLevelFilter: () => new Map() }));
vi.mock('../../context/FiltersContext', () => ({
  useFilters: () => ({ searchQuery: '', activeFilters: [], activePriceFilter: null }),
  FiltersContext: { Provider: ({ children }: { children: unknown }) => children },
}));

import { useDeepLinks } from '../useDeepLinks';
import { allBusinesses } from '../useBusinesses';

const STORAGE_KEY = 'mm_last_business_sheet';
const validId = allBusinesses[0].id;

describe('useDeepLinks — sessionStorage restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.searchParams = new URLSearchParams();
  });

  it('restores sheet from sessionStorage on mount', () => {
    sessionStorage.setItem(STORAGE_KEY, validId);
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ id: validId }),
    );
    expect(mocks.setActiveTab).toHaveBeenCalledWith('buscar');
  });

  it('removes sessionStorage key after consuming it', () => {
    sessionStorage.setItem(STORAGE_KEY, validId);
    renderHook(() => useDeepLinks());
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores sessionStorage key with invalid ID format', () => {
    sessionStorage.setItem(STORAGE_KEY, 'invalid-id');
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).not.toHaveBeenCalled();
  });

  it('ignores sessionStorage key with valid-format but non-existent ID', () => {
    sessionStorage.setItem(STORAGE_KEY, 'biz_999999');
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).not.toHaveBeenCalled();
  });

  it('still clears an unknown ID from sessionStorage on mount', () => {
    sessionStorage.setItem(STORAGE_KEY, 'biz_999999');
    renderHook(() => useDeepLinks());
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does nothing when sessionStorage is empty', () => {
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).not.toHaveBeenCalled();
  });
});

describe('useDeepLinks — ?business= backward compat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.searchParams = new URLSearchParams();
  });

  it('opens sheet for valid ?business= param (backward compat)', () => {
    mocks.searchParams = new URLSearchParams(`business=${validId}`);
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ id: validId }),
    );
    expect(mocks.setActiveTab).toHaveBeenCalledWith('buscar');
  });

  it('ignores invalid ?business= param without crashing', () => {
    mocks.searchParams = new URLSearchParams('business=%3Cscript%3E');
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).not.toHaveBeenCalled();
  });

  it('ignores valid-format but non-existent ?business= param', () => {
    mocks.searchParams = new URLSearchParams('business=biz_999999');
    renderHook(() => useDeepLinks());
    expect(mocks.setSelectedBusiness).not.toHaveBeenCalled();
  });

  it('cleans up ?business= param from URL regardless of validity', () => {
    mocks.searchParams = new URLSearchParams('business=biz_999999');
    renderHook(() => useDeepLinks());
    expect(mocks.setSearchParams).toHaveBeenCalled();
  });
});
