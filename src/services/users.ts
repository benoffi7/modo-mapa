/**
 * Firestore service for user-related queries.
 */
import { collection, getDocs, query, where, limit, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../utils/logger';

/**
 * Fetches the profilePublic field for a list of user IDs in batches of 30.
 * Returns a map of userId -> profilePublic (false if doc not found).
 */
export async function fetchProfileVisibility(
  userIds: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (userIds.length === 0) return result;

  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    batches.push(userIds.slice(i, i + 30));
  }

  const now = Date.now();
  void now; // used by caller for TTL

  try {
    const snapshots = await Promise.all(
      batches.map((batch) =>
        getDocs(
          query(
            collection(db, COLLECTIONS.USERS),
            where(documentId(), 'in', batch),
          ),
        ),
      ),
    );

    const fetched = new Set<string>();
    for (const snap of snapshots) {
      for (const d of snap.docs) {
        result.set(d.id, d.data().profilePublic === true);
        fetched.add(d.id);
      }
    }

    // Default false for IDs not found
    for (const uid of userIds) {
      if (!fetched.has(uid)) result.set(uid, false);
    }
  } catch {
    // Default false on error
    for (const uid of userIds) result.set(uid, false);
  }

  return result;
}

export interface UserSearchResult {
  userId: string;
  displayName: string;
}

/**
 * Search users by displayName prefix. Only returns users with public profiles.
 */
export async function searchUsers(
  searchTerm: string,
  maxResults = 10,
): Promise<UserSearchResult[]> {
  if (!searchTerm || searchTerm.length < 2) return [];

  const lower = searchTerm.toLowerCase();

  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.USERS),
      where('displayNameLower', '>=', lower),
      where('displayNameLower', '<=', lower + '\uf8ff'),
      limit(maxResults * 3),
    ),
  );

  if (snap.empty) return [];

  // Filter by denormalized profilePublic on users doc (synced by onUserSettingsWritten trigger)
  const results: UserSearchResult[] = [];
  for (const userDoc of snap.docs) {
    const data = userDoc.data() as { displayName?: string; profilePublic?: boolean };
    if (data.profilePublic === false) continue;

    results.push({
      userId: userDoc.id,
      displayName: data.displayName ?? userDoc.id,
    });
    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Fetch display names for a list of user IDs in batch.
 */
export async function fetchUserDisplayNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  // Firestore `in` queries support max 30 items
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.USERS), where('__name__', 'in', batch)),
      );
      for (const d of snap.docs) {
        names.set(d.id, (d.data() as { displayName?: string }).displayName ?? d.id);
      }
    } catch (err) {
      if (import.meta.env.DEV) logger.error('fetchUserDisplayNames batch failed:', err);
    }
  }
  return names;
}
