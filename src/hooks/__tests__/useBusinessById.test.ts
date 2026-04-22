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
    const result = useBusinessById(existingId);
    expect(result.status).toBe('found');
    expect(result.business).not.toBeNull();
    expect(result.business?.id).toBe(existingId);
  });

  it('returns not_found + null for a valid-format ID that does not exist', () => {
    const result = useBusinessById('biz_999999');
    expect(result.status).toBe('not_found');
    expect(result.business).toBeNull();
  });

  it('returns invalid_id for a malformed ID', () => {
    const result = useBusinessById('not-a-valid-id');
    expect(result.status).toBe('invalid_id');
    expect(result.business).toBeNull();
  });

  it('returns invalid_id for undefined', () => {
    const result = useBusinessById(undefined);
    expect(result.status).toBe('invalid_id');
    expect(result.business).toBeNull();
  });

  it('returns invalid_id for empty string', () => {
    const result = useBusinessById('');
    expect(result.status).toBe('invalid_id');
    expect(result.business).toBeNull();
  });

  it('returns invalid_id for an ID with too many digits', () => {
    const result = useBusinessById('biz_1234567');
    expect(result.status).toBe('invalid_id');
    expect(result.business).toBeNull();
  });
});
