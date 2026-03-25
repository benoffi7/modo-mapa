import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { sharedListConverter, listItemConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import { MAX_LISTS } from '../constants/lists';
import type { SharedList, ListItem } from '../types';

export function getSharedListsCollection(): CollectionReference<SharedList> {
  return collection(db, COLLECTIONS.SHARED_LISTS).withConverter(sharedListConverter) as CollectionReference<SharedList>;
}

export function getListItemsCollection(): CollectionReference<ListItem> {
  return collection(db, COLLECTIONS.LIST_ITEMS).withConverter(listItemConverter) as CollectionReference<ListItem>;
}

export async function createList(userId: string, name: string, description: string = ''): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.SHARED_LISTS), {
    ownerId: userId,
    name: name.trim(),
    description: description.trim(),
    isPublic: false,
    itemCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.SHARED_LISTS, userId);
  trackEvent('list_created', { list_id: ref.id });
  return ref.id;
}

export async function toggleListPublic(listId: string, isPublic: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId), {
    isPublic,
    updatedAt: serverTimestamp(),
  });
}

export async function updateList(listId: string, name: string, description: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId), {
    name: name.trim(),
    description: description.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteList(listId: string, ownerId: string): Promise<void> {
  const itemsSnap = await getDocs(
    query(collection(db, COLLECTIONS.LIST_ITEMS), where('listId', '==', listId)),
  );

  // Firestore batches support max 500 operations
  const allDocs = [...itemsSnap.docs.map((d) => d.ref), doc(db, COLLECTIONS.SHARED_LISTS, listId)];
  for (let i = 0; i < allDocs.length; i += 500) {
    const batch = writeBatch(db);
    for (const ref of allDocs.slice(i, i + 500)) {
      batch.delete(ref);
    }
    await batch.commit();
  }

  invalidateQueryCache(COLLECTIONS.SHARED_LISTS, ownerId);
  trackEvent('list_deleted', { list_id: listId });
}

export async function addBusinessToList(listId: string, businessId: string, addedBy?: string): Promise<void> {
  const itemId = `${listId}__${businessId}`;
  await setDoc(doc(db, COLLECTIONS.LIST_ITEMS, itemId), {
    listId,
    businessId,
    ...(addedBy ? { addedBy } : {}),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId), {
    itemCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  trackEvent('list_item_added', { list_id: listId, business_id: businessId });
}

export async function removeBusinessFromList(listId: string, businessId: string): Promise<void> {
  const itemId = `${listId}__${businessId}`;
  await deleteDoc(doc(db, COLLECTIONS.LIST_ITEMS, itemId));
  await updateDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId), {
    itemCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  trackEvent('list_item_removed', { list_id: listId, business_id: businessId });
}

export async function fetchListItems(listId: string): Promise<ListItem[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.LIST_ITEMS).withConverter(listItemConverter),
      where('listId', '==', listId),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function copyList(sourceListId: string, targetUserId: string): Promise<string> {
  // Fetch source list and items outside transaction (read-only, no race risk)
  const sourceSnap = await getDoc(
    doc(db, COLLECTIONS.SHARED_LISTS, sourceListId).withConverter(sharedListConverter),
  );
  if (!sourceSnap.exists()) throw new Error('Lista no encontrada');
  const source = sourceSnap.data();

  if (!source.isPublic && source.ownerId !== targetUserId) {
    throw new Error('No se puede copiar una lista privada');
  }

  const items = await fetchListItems(sourceListId);

  // Transaction: check limit + create list + copy items atomically
  const newListId = await runTransaction(db, async (transaction) => {
    // Check user list count inside transaction to prevent race
    const userListsSnap = await getDocs(
      query(collection(db, COLLECTIONS.SHARED_LISTS), where('ownerId', '==', targetUserId)),
    );
    if (userListsSnap.size >= MAX_LISTS) {
      throw new Error('Límite de 10 listas alcanzado');
    }

    // Create new list doc
    const newRef = doc(collection(db, COLLECTIONS.SHARED_LISTS));
    transaction.set(newRef, {
      ownerId: targetUserId,
      name: source.name.trim(),
      description: source.description.trim(),
      isPublic: false,
      itemCount: items.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Copy items
    for (const item of items) {
      const itemRef = doc(db, COLLECTIONS.LIST_ITEMS, `${newRef.id}__${item.businessId}`);
      transaction.set(itemRef, {
        listId: newRef.id,
        businessId: item.businessId,
        createdAt: serverTimestamp(),
      });
    }

    return newRef.id;
  });

  invalidateQueryCache(COLLECTIONS.SHARED_LISTS, targetUserId);
  trackEvent('list_copied', { source_list_id: sourceListId, item_count: items.length });
  return newListId;
}

export async function fetchFeaturedLists(): Promise<SharedList[]> {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../config/firebase');
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
  const fn = httpsCallable<{ databaseId?: string }, { lists: SharedList[] }>(functions, 'getFeaturedLists');
  const result = await fn({ databaseId });
  return result.data.lists.map((l) => ({
    ...l,
    createdAt: new Date(),
    updatedAt: new Date(),
    editorIds: l.editorIds ?? [],
  }));
}

export async function inviteEditor(listId: string, targetEmail: string): Promise<void> {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../config/firebase');
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
  const fn = httpsCallable<{ listId: string; targetEmail: string; databaseId?: string }, { success: boolean }>(functions, 'inviteListEditor');
  await fn({ listId, targetEmail, databaseId });
}

export async function removeEditor(listId: string, targetUid: string): Promise<void> {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../config/firebase');
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
  const fn = httpsCallable<{ listId: string; targetUid: string; databaseId?: string }, { success: boolean }>(functions, 'removeListEditor');
  await fn({ listId, targetUid, databaseId });
}

export async function fetchSharedList(listId: string): Promise<SharedList | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.SHARED_LISTS, listId).withConverter(sharedListConverter),
  );
  return snap.exists() ? snap.data() : null;
}

export async function fetchUserLists(userId: string): Promise<SharedList[]> {
  const snap = await getDocs(
    query(getSharedListsCollection(), where('ownerId', '==', userId), orderBy('updatedAt', 'desc')),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchEditorName(uid: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    const data = snap.data() as { displayName?: string } | undefined;
    return data?.displayName ?? 'Usuario';
  } catch {
    return 'Usuario';
  }
}

export async function fetchAllAccessibleLists(userId: string): Promise<SharedList[]> {
  const [owned, editor] = await Promise.all([
    fetchUserLists(userId),
    fetchSharedWithMe(userId),
  ]);
  const ownedIds = new Set(owned.map((l) => l.id));
  return [...owned, ...editor.filter((l) => !ownedIds.has(l.id))];
}

export async function fetchSharedWithMe(userId: string): Promise<SharedList[]> {
  const snap = await getDocs(
    query(
      getSharedListsCollection(),
      where('editorIds', 'array-contains', userId),
      orderBy('updatedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}
