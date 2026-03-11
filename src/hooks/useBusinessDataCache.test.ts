import {
  getBusinessCache,
  setBusinessCache,
  invalidateBusinessCache,
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
});
