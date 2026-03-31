import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Business } from '../types';

const mockUpdateUserSettings = vi.fn();

let mockTags: string[] = [];
let mockTagsLoading = false;

vi.mock('./useFollowedTags', () => ({
  useFollowedTags: () => ({ tags: mockTags, loading: mockTagsLoading }),
}));

vi.mock('../services/userSettings', () => ({
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const fakeBusiness = (id: string, tags: string[]): Business => ({
  id,
  name: `Business ${id}`,
  address: 'Some address',
  category: 'restaurant',
  lat: -34.6,
  lng: -58.4,
  tags,
  phone: null,
});

let mockAllBusinesses: Business[] = [];
vi.mock('./useBusinesses', () => ({
  get allBusinesses() {
    return mockAllBusinesses;
  },
}));

import { useInterestsFeed } from './useInterestsFeed';

describe('useInterestsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockTags = ['barato', 'delivery'];
    mockTagsLoading = false;
    mockAllBusinesses = [
      fakeBusiness('b1', ['barato', 'rapido']),
      fakeBusiness('b2', ['delivery']),
      fakeBusiness('b3', ['barato', 'delivery']),
      fakeBusiness('b4', ['apto_veganos']),
    ];
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  it('groups businesses by followed tag', () => {
    const { result } = renderHook(() => useInterestsFeed());

    expect(result.current.groups).toHaveLength(2);
    const baratoGroup = result.current.groups.find((g) => g.tag === 'barato');
    expect(baratoGroup).toBeDefined();
    expect(baratoGroup!.businesses.map((b) => b.business.id)).toEqual(['b1', 'b3']);

    const deliveryGroup = result.current.groups.find((g) => g.tag === 'delivery');
    expect(deliveryGroup).toBeDefined();
    expect(deliveryGroup!.businesses.map((b) => b.business.id)).toEqual(['b2', 'b3']);
  });

  it('returns empty groups when no tags are followed', () => {
    mockTags = [];
    const { result } = renderHook(() => useInterestsFeed());

    expect(result.current.groups).toEqual([]);
    expect(result.current.totalNew).toBe(0);
  });

  it('filters out tags with zero matching businesses', () => {
    mockTags = ['barato', 'apto_celiacos']; // apto_celiacos has no businesses
    const { result } = renderHook(() => useInterestsFeed());

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].tag).toBe('barato');
  });

  it('totalNew is 0 in v1 (no lastSeenAt tracking)', () => {
    const { result } = renderHook(() => useInterestsFeed());

    expect(result.current.totalNew).toBe(0);
    for (const group of result.current.groups) {
      expect(group.newCount).toBe(0);
    }
  });

  it('markSeen calls updateUserSettings with followedTagsLastSeenAt', () => {
    const { result } = renderHook(() => useInterestsFeed());

    act(() => {
      result.current.markSeen();
    });

    expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
      followedTagsLastSeenAt: expect.any(Date),
    }));
  });

  it('markSeen is a no-op when user is null', () => {
    mockUser = null;
    const { result } = renderHook(() => useInterestsFeed());

    act(() => {
      result.current.markSeen();
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('limits businesses per tag to INTERESTS_MAX_BUSINESSES_PER_TAG', () => {
    // Create 10 businesses all tagged 'barato'
    mockAllBusinesses = Array.from({ length: 10 }, (_, i) =>
      fakeBusiness(`b${i}`, ['barato']),
    );
    mockTags = ['barato'];

    const { result } = renderHook(() => useInterestsFeed());

    expect(result.current.groups[0].businesses).toHaveLength(5); // INTERESTS_MAX_BUSINESSES_PER_TAG
  });

  it('passes loading state from useFollowedTags', () => {
    mockTagsLoading = true;
    const { result } = renderHook(() => useInterestsFeed());

    expect(result.current.loading).toBe(true);
  });
});
