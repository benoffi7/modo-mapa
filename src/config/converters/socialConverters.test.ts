import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import {
  followConverter,
  activityFeedItemConverter,
  checkinConverter,
  recommendationConverter,
} from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

// ---------------------------------------------------------------------------
// followConverter
// ---------------------------------------------------------------------------
describe('followConverter', () => {
  it('round-trips correctly', () => {
    const follow = { followerId: 'u1', followedId: 'u2', createdAt: NOW };
    const serialized = followConverter.toFirestore(follow);
    expect(serialized).toEqual(follow);

    const snap = mockSnapshot(follow);
    expect(followConverter.fromFirestore(snap)).toEqual(follow);
  });
});

// ---------------------------------------------------------------------------
// activityFeedItemConverter
// ---------------------------------------------------------------------------
describe('activityFeedItemConverter', () => {
  const base = {
    actorId: 'u1',
    actorName: 'Ana',
    type: 'rating',
    businessId: 'b1',
    businessName: 'Cafe',
    referenceId: 'ref1',
    createdAt: NOW,
    expiresAt: NOW,
  };

  it('toFirestore serializes all fields', () => {
    const item = { id: 'a1', ...base };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = activityFeedItemConverter.toFirestore(item as any);
    expect(result).toEqual(base);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore deserializes with referenceId default', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { referenceId: _ref, ...noRef } = base;
    const snap = mockSnapshot(noRef, 'a1');
    const result = activityFeedItemConverter.fromFirestore(snap);
    expect(result.id).toBe('a1');
    expect(result.referenceId).toBe('');
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot(base, 'a1');
    const result = activityFeedItemConverter.fromFirestore(snap);
    expect(result.id).toBe('a1');
    expect(result.referenceId).toBe('ref1');
    expect(result.actorName).toBe('Ana');
  });
});

// ---------------------------------------------------------------------------
// checkinConverter
// ---------------------------------------------------------------------------
describe('checkinConverter', () => {
  const base = {
    userId: 'u1',
    businessId: 'b1',
    businessName: 'Cafe',
    createdAt: NOW,
  };

  it('toFirestore serializes without location', () => {
    const checkin = { id: 'ck1', ...base };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = checkinConverter.toFirestore(checkin as any);
    expect(result).toEqual(base);
    expect(result).not.toHaveProperty('location');
  });

  it('toFirestore includes location when present', () => {
    const checkin = { id: 'ck1', ...base, location: { lat: -34.6, lng: -58.4 } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = checkinConverter.toFirestore(checkin as any);
    expect(result.location).toEqual({ lat: -34.6, lng: -58.4 });
  });

  it('fromFirestore deserializes without location', () => {
    const snap = mockSnapshot(base, 'ck1');
    const result = checkinConverter.fromFirestore(snap);
    expect(result.id).toBe('ck1');
    expect(result.userId).toBe('u1');
    expect(result).not.toHaveProperty('location');
  });

  it('fromFirestore deserializes with location', () => {
    const snap = mockSnapshot({ ...base, location: { lat: -34.6, lng: -58.4 } }, 'ck1');
    const result = checkinConverter.fromFirestore(snap);
    expect(result.location).toEqual({ lat: -34.6, lng: -58.4 });
  });
});

// ---------------------------------------------------------------------------
// recommendationConverter
// ---------------------------------------------------------------------------
describe('recommendationConverter', () => {
  const base = {
    senderId: 'u1',
    senderName: 'Ana',
    recipientId: 'u2',
    businessId: 'b1',
    businessName: 'Cafe',
    message: 'Try this!',
    read: true,
    createdAt: NOW,
  };

  it('toFirestore serializes all fields', () => {
    const rec = { id: 'r1', ...base };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = recommendationConverter.toFirestore(rec as any);
    expect(result).toEqual(base);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({ senderId: 'u1', senderName: 'Ana', recipientId: 'u2', businessId: 'b1', createdAt: NOW }, 'r1');
    const result = recommendationConverter.fromFirestore(snap);
    expect(result.id).toBe('r1');
    expect(result.businessName).toBe('');
    expect(result.message).toBe('');
    expect(result.read).toBe(false);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot(base, 'r1');
    const result = recommendationConverter.fromFirestore(snap);
    expect(result.id).toBe('r1');
    expect(result.businessName).toBe('Cafe');
    expect(result.message).toBe('Try this!');
    expect(result.read).toBe(true);
  });
});
