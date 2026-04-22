/**
 * Firestore/Functions service for admin featured lists operations.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { SharedList } from '../types';

const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;

const toggleFeaturedFn = httpsCallable<
  { listId: string; featured: boolean; databaseId?: string },
  { success: boolean }
>(functions, 'toggleFeaturedList');

const getPublicListsFn = httpsCallable<
  { databaseId?: string },
  { lists: SharedList[] }
>(functions, 'getPublicLists');

export async function fetchPublicLists(): Promise<SharedList[]> {
  const result = await getPublicListsFn({ databaseId });
  return result.data.lists.map((l) => ({
    ...l,
    createdAt: new Date(),
    updatedAt: new Date(),
    editorIds: l.editorIds ?? [],
  }));
}

export async function toggleFeaturedList(
  listId: string,
  featured: boolean,
): Promise<void> {
  await toggleFeaturedFn({ listId, featured, databaseId });
}
