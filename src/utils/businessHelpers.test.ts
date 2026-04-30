import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../hooks/useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz1', name: 'Café Central' },
    { id: 'biz2', name: 'Pizzería Roma' },
  ],
}));

vi.mock('../constants/tags', () => ({
  PREDEFINED_TAGS: [
    { id: 'barato', label: 'Barato' },
    { id: 'rapido', label: 'Rápido' },
  ],
}));

import { getBusinessName, getTagLabel } from './businessHelpers';
import { __resetBusinessMap } from './businessMap';

beforeEach(() => {
  // Reset the singleton so it rebuilds from the mocked allBusinesses
  __resetBusinessMap();
});

describe('getBusinessName', () => {
  it('returns name for existing business', () => {
    expect(getBusinessName('biz1')).toBe('Café Central');
  });

  it('returns id as fallback for unknown business', () => {
    expect(getBusinessName('unknown')).toBe('unknown');
  });

  it('returns empty string for empty id', () => {
    expect(getBusinessName('')).toBe('');
  });
});

describe('getTagLabel', () => {
  it('returns label for existing tag', () => {
    expect(getTagLabel('barato')).toBe('Barato');
  });

  it('returns id as fallback for unknown tag', () => {
    expect(getTagLabel('unknown_tag')).toBe('unknown_tag');
  });
});
