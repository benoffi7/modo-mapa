export interface UserOwnedCollection {
  collection: string;
  type: 'doc-by-uid' | 'query' | 'subcollection';
  /** Field name where the user's UID is stored (for type: 'query') */
  field?: string;
  /** Second field for bidirectional relations (e.g. follows: followerId + followedId) */
  biField?: string;
  /** Path template for subcollections (e.g. 'activityFeed/{uid}/items') */
  path?: string;
  /** Whether docs reference files in Cloud Storage that need cleanup */
  hasStorage?: boolean;
  /** Subcollections to delete before deleting parent docs */
  subcollections?: string[];
  /** Collections to cascade-delete (e.g. listItems when sharedLists are deleted) */
  cascade?: string[];
}

/**
 * Registry of all Firestore collections that contain user-owned data.
 * Used by deleteUserAccount callable to clean up all user data.
 *
 * IMPORTANT: When adding a new collection with user data, add it here.
 * The validation test (userOwnedCollections.test.ts) will fail if a
 * service file uses where('userId', ...) on a collection not listed here.
 */
export const USER_OWNED_COLLECTIONS: UserOwnedCollection[] = [
  // Doc ID = uid
  { collection: 'userSettings', type: 'doc-by-uid' },
  { collection: 'users', type: 'doc-by-uid' },
  // Query by field
  { collection: 'ratings', type: 'query', field: 'userId' },
  { collection: 'comments', type: 'query', field: 'userId' },
  { collection: 'commentLikes', type: 'query', field: 'userId' },
  { collection: 'favorites', type: 'query', field: 'userId' },
  { collection: 'userTags', type: 'query', field: 'userId' },
  { collection: 'customTags', type: 'query', field: 'userId' },
  { collection: 'priceLevels', type: 'query', field: 'userId' },
  { collection: 'feedback', type: 'query', field: 'userId', hasStorage: true },
  { collection: 'menuPhotos', type: 'query', field: 'userId', hasStorage: true, subcollections: ['reports'] },
  { collection: 'notifications', type: 'query', field: 'userId' },
  { collection: 'sharedLists', type: 'query', field: 'ownerId', cascade: ['listItems'] },
  { collection: 'listItems', type: 'query', field: 'addedBy' },
  { collection: 'follows', type: 'query', field: 'followerId', biField: 'followedId' },
  { collection: 'recommendations', type: 'query', field: 'fromUserId', biField: 'toUserId' },
  { collection: 'checkins', type: 'query', field: 'userId' },
  // Subcollection
  { collection: 'activityFeed', type: 'subcollection', path: 'activityFeed/{uid}/items' },
  // Rate limits cleanup
  { collection: '_rateLimits', type: 'query', field: 'userId' },
];
