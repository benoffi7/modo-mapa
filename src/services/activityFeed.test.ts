import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({
    withConverter: vi.fn(() => 'converted-collection'),
  })),
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { ACTIVITY_FEED: 'activityFeed' },
}));

vi.mock('../config/converters', () => ({
  activityFeedItemConverter: {},
}));

import { getActivityFeedCollection } from './activityFeed';
import { collection } from 'firebase/firestore';

describe('getActivityFeedCollection', () => {
  it('returns a collection reference for the user', () => {
    const result = getActivityFeedCollection('user1');
    expect(result).toBeDefined();
    expect(collection).toHaveBeenCalledWith({}, 'activityFeed', 'user1', 'items');
  });

  it('returns different references for different users', () => {
    getActivityFeedCollection('user1');
    getActivityFeedCollection('user2');

    expect(collection).toHaveBeenCalledWith({}, 'activityFeed', 'user1', 'items');
    expect(collection).toHaveBeenCalledWith({}, 'activityFeed', 'user2', 'items');
  });

  it('applies the activityFeedItemConverter', () => {
    const result = getActivityFeedCollection('user1');
    // The mock returns a withConverter-wrapped result
    expect(result).toBe('converted-collection');
  });
});
