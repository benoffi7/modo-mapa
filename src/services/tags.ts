/**
 * Firestore service for `userTags` and `customTags` collections.
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

// ── User Tags (predefined) ────────────────────────────────────────────

export async function addUserTag(
  userId: string,
  businessId: string,
  tagId: string,
): Promise<void> {
  const docId = `${userId}__${businessId}__${tagId}`;
  await setDoc(doc(db, COLLECTIONS.USER_TAGS, docId), {
    userId,
    businessId,
    tagId,
    createdAt: serverTimestamp(),
  });
}

export async function removeUserTag(
  userId: string,
  businessId: string,
  tagId: string,
): Promise<void> {
  const docId = `${userId}__${businessId}__${tagId}`;
  await deleteDoc(doc(db, COLLECTIONS.USER_TAGS, docId));
}

// ── Custom Tags ────────────────────────────────────────────────────────

export async function createCustomTag(
  userId: string,
  businessId: string,
  label: string,
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.CUSTOM_TAGS), {
    userId,
    businessId,
    label,
    createdAt: serverTimestamp(),
  });
}

export async function updateCustomTag(tagId: string, label: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.CUSTOM_TAGS, tagId), { label });
}

export async function deleteCustomTag(tagId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.CUSTOM_TAGS, tagId));
}
