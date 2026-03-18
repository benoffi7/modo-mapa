import {
  getBusinessCache,
  setBusinessCache,
  invalidateBusinessCache,
  patchBusinessCache,
} from './useBusinessDataCache';

describe('useBusinessDataCache', () => {
  beforeEach(() => {
    // Clear cache between tests
    invalidateBusinessCache('biz_001');
    invalidateBusinessCache('biz_002');
  });

  const mockData = {
    isFavorite: true,
    ratings: [{ userId: 'u1', businessId: 'biz_001', score: 4, createdAt: new Date(), updatedAt: new Date() }],
    comments: [],
    userTags: [],
    customTags: [],
    userCommentLikes: new Set<string>(),
    priceLevels: [],
    menuPhoto: null,
  };

  it('returns null for uncached business', () => {
    expect(getBusinessCache('biz_001')).toBeNull();
  });

  it('returns cached data within TTL', () => {
    setBusinessCache('biz_001', mockData);
    const cached = getBusinessCache('biz_001');
    expect(cached).not.toBeNull();
    expect(cached!.isFavorite).toBe(true);
    expect(cached!.ratings).toHaveLength(1);
  });

  it('returns null after TTL expires', () => {
    setBusinessCache('biz_001', mockData);

    // Manually expire by manipulating the timestamp
    vi.useFakeTimers();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getBusinessCache('biz_001')).toBeNull();
    vi.useRealTimers();
  });

  it('invalidate removes cached entry', () => {
    setBusinessCache('biz_001', mockData);
    expect(getBusinessCache('biz_001')).not.toBeNull();

    invalidateBusinessCache('biz_001');
    expect(getBusinessCache('biz_001')).toBeNull();
  });

  it('caches different businesses independently', () => {
    setBusinessCache('biz_001', mockData);
    setBusinessCache('biz_002', { ...mockData, isFavorite: false });

    expect(getBusinessCache('biz_001')!.isFavorite).toBe(true);
    expect(getBusinessCache('biz_002')!.isFavorite).toBe(false);

    invalidateBusinessCache('biz_001');
    expect(getBusinessCache('biz_001')).toBeNull();
    expect(getBusinessCache('biz_002')).not.toBeNull();
  });

  it('deletes expired entry from internal cache on access', () => {
    setBusinessCache('biz_001', mockData);

    // First access should return data
    expect(getBusinessCache('biz_001')).not.toBeNull();

    // Advance Date.now past TTL
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 5 * 60 * 1000 + 1);

    // Should return null and delete the entry
    expect(getBusinessCache('biz_001')).toBeNull();

    // Restore Date.now so subsequent get uses real time
    vi.restoreAllMocks();

    // Entry should still be gone (was deleted, not just filtered)
    // Re-set a fresh entry to confirm cache key is free
    setBusinessCache('biz_001', { ...mockData, isFavorite: false });
    const fresh = getBusinessCache('biz_001');
    expect(fresh).not.toBeNull();
    expect(fresh!.isFavorite).toBe(false);
  });

  describe('patchBusinessCache', () => {
    it('does nothing when entry does not exist', () => {
      // Should not throw, and cache should remain empty
      const result = patchBusinessCache('biz_001', { isFavorite: true });
      expect(result).toBeUndefined();
      expect(getBusinessCache('biz_001')).toBeNull();
    });

    it('patches an existing cached entry', () => {
      setBusinessCache('biz_001', mockData);

      patchBusinessCache('biz_001', { isFavorite: false });

      const cached = getBusinessCache('biz_001');
      expect(cached).not.toBeNull();
      expect(cached!.isFavorite).toBe(false);
      // Other fields remain unchanged
      expect(cached!.ratings).toHaveLength(1);
    });

    it('updates timestamp when patching', () => {
      setBusinessCache('biz_001', mockData);
      const before = getBusinessCache('biz_001')!.timestamp;

      const futureNow = before + 1000;
      vi.spyOn(Date, 'now').mockReturnValue(futureNow);

      patchBusinessCache('biz_001', { isFavorite: false });

      vi.restoreAllMocks();

      // Use a fresh spyOn so getBusinessCache sees the entry as within TTL
      vi.spyOn(Date, 'now').mockReturnValue(futureNow);
      const cached = getBusinessCache('biz_001');
      expect(cached).not.toBeNull();
      expect(cached!.timestamp).toBe(futureNow);

      vi.restoreAllMocks();
    });
  });
});
