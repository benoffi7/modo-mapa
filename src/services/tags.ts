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
import { trackEvent } from '../utils/analytics';
import { VALID_TAG_IDS } from '../constants/tags';
import { MAX_CUSTOM_TAG_LENGTH } from '../constants/validation';
import type { PredefinedTagId } from '../types';

// ── User Tags (predefined) ────────────────────────────────────────────

export async function addUserTag(
  userId: string,
  businessId: string,
  tagId: PredefinedTagId | string,
): Promise<void> {
  if (!VALID_TAG_IDS.includes(tagId)) {
    throw new Error(`Invalid tagId: ${tagId}`);
  }

  const docId = `${userId}__${businessId}__${tagId}`;
  await setDoc(doc(db, COLLECTIONS.USER_TAGS, docId), {
    userId,
    businessId,
    tagId,
    createdAt: serverTimestamp(),
  });
  trackEvent('tag_vote', { business_id: businessId, tag_name: tagId });
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
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_CUSTOM_TAG_LENGTH) {
    throw new Error('Custom tag label must be 1-30 characters');
  }

  await addDoc(collection(db, COLLECTIONS.CUSTOM_TAGS), {
    userId,
    businessId,
    label,
    createdAt: serverTimestamp(),
  });
  trackEvent('custom_tag_create', { business_id: businessId });
}

export async function updateCustomTag(tagId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_CUSTOM_TAG_LENGTH) {
    throw new Error('Custom tag label must be 1-30 characters');
  }

  await updateDoc(doc(db, COLLECTIONS.CUSTOM_TAGS, tagId), { label: trimmed });
}

export async function deleteCustomTag(tagId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.CUSTOM_TAGS, tagId));
}
