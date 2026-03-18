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
  // Delete all items in the list first
  const itemsSnap = await getDocs(
    query(collection(db, COLLECTIONS.LIST_ITEMS), where('listId', '==', listId)),
  );
  const deletes = itemsSnap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);

  // Delete the list itself
  await deleteDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId));
  invalidateQueryCache(COLLECTIONS.SHARED_LISTS, ownerId);
  trackEvent('list_deleted', { list_id: listId });
}

export async function addBusinessToList(listId: string, businessId: string): Promise<void> {
  const itemId = `${listId}__${businessId}`;
  await setDoc(doc(db, COLLECTIONS.LIST_ITEMS, itemId), {
    listId,
    businessId,
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
  // Check user list count
  const userLists = await getDocs(
    query(collection(db, COLLECTIONS.SHARED_LISTS), where('ownerId', '==', targetUserId)),
  );
  if (userLists.size >= MAX_LISTS) {
    throw new Error('Límite de 10 listas alcanzado');
  }

  // Fetch source list
  const sourceSnap = await getDoc(
    doc(db, COLLECTIONS.SHARED_LISTS, sourceListId).withConverter(sharedListConverter),
  );
  if (!sourceSnap.exists()) throw new Error('Lista no encontrada');
  const source = sourceSnap.data();

  // Verify source is public or caller is owner
  if (!source.isPublic && source.ownerId !== targetUserId) {
    throw new Error('No se puede copiar una lista privada');
  }

  // Create new list
  const newListId = await createList(targetUserId, source.name, source.description);

  // Copy items
  const items = await fetchListItems(sourceListId);
  for (const item of items) {
    await addBusinessToList(newListId, item.businessId);
  }

  trackEvent('list_copied', { source_list_id: sourceListId, item_count: items.length });
  return newListId;
}

export async function fetchFeaturedLists(): Promise<SharedList[]> {
  const snap = await getDocs(
    query(
      getSharedListsCollection(),
      where('featured', '==', true),
      orderBy('updatedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}
