import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import { userProfileConverter, userSettingsConverter } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

// ---------------------------------------------------------------------------
// userProfileConverter
// ---------------------------------------------------------------------------
describe('userProfileConverter', () => {
  it('toFirestore serializes all fields', () => {
    const result = userProfileConverter.toFirestore({ displayName: 'Ana', createdAt: NOW });
    expect(result).toEqual({ displayName: 'Ana', createdAt: NOW });
  });

  it('fromFirestore deserializes a complete document', () => {
    const snap = mockSnapshot({ displayName: 'Ana', createdAt: NOW });
    const result = userProfileConverter.fromFirestore(snap);
    expect(result).toEqual({ displayName: 'Ana', createdAt: NOW });
  });
});

// ---------------------------------------------------------------------------
// userSettingsConverter
// ---------------------------------------------------------------------------
describe('userSettingsConverter', () => {
  const full = {
    profilePublic: true, notificationsEnabled: true,
    notifyLikes: true, notifyPhotos: true, notifyRankings: true,
    notifyFeedback: false, notifyReplies: false, notifyFollowers: false, notifyRecommendations: false,
    analyticsEnabled: true, updatedAt: NOW,
  };

  it('toFirestore serializes all fields', () => {
    expect(userSettingsConverter.toFirestore(full)).toEqual(full);
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({});
    const result = userSettingsConverter.fromFirestore(snap);
    expect(result.profilePublic).toBe(false);
    expect(result.notificationsEnabled).toBe(false);
    expect(result.notifyLikes).toBe(false);
    expect(result.notifyPhotos).toBe(false);
    expect(result.notifyRankings).toBe(false);
    expect(result.notifyFeedback).toBe(true);
    expect(result.notifyReplies).toBe(true);
    expect(result.notifyFollowers).toBe(true);
    expect(result.notifyRecommendations).toBe(true);
    expect(result.analyticsEnabled).toBe(false);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot(full);
    const result = userSettingsConverter.fromFirestore(snap);
    expect(result.profilePublic).toBe(true);
    expect(result.notifyFeedback).toBe(false);
    expect(result.notifyReplies).toBe(false);
  });
});
