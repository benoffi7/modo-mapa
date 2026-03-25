/**
 * Firestore service for user-related queries.
 */
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../utils/logger';

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

  // Filter by profilePublic (check userSettings for each candidate)
  const results: UserSearchResult[] = [];
  for (const userDoc of snap.docs) {
    const data = userDoc.data() as { displayName?: string };
    const settingsSnap = await getDoc(doc(db, COLLECTIONS.USER_SETTINGS, userDoc.id));
    const isPrivate = settingsSnap.exists()
      && (settingsSnap.data() as { profilePublic?: boolean }).profilePublic === false;

    if (!isPrivate) {
      results.push({
        userId: userDoc.id,
        displayName: data.displayName ?? userDoc.id,
      });
      if (results.length >= maxResults) break;
    }
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
