/**
 * Firestore service for the `achievements` collection.
 *
 * All Firestore reads/writes for achievements go through this module so
 * components never import Firestore SDK directly.
 */
import { collection, getDocs, doc, setDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import type { Achievement } from '../types';

/** Fetch all achievements ordered by `order` field. */
export async function fetchAchievements(): Promise<Achievement[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.ACHIEVEMENTS), orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Achievement));
}

/**
 * Save all achievements — deletes removed ones, upserts current ones.
 * Each doc gets an `updatedAt` timestamp.
 */
export async function saveAllAchievements(achievements: Achievement[]): Promise<void> {
  const existingSnap = await getDocs(collection(db, COLLECTIONS.ACHIEVEMENTS));
  const currentIds = new Set(achievements.map((a) => a.id));

  for (const d of existingSnap.docs) {
    if (!currentIds.has(d.id)) await deleteDoc(d.ref);
  }

  for (const a of achievements) {
    const { id, ...data } = a;
    await setDoc(doc(db, COLLECTIONS.ACHIEVEMENTS, id), { ...data, updatedAt: new Date() });
  }
}

/** Delete a single achievement by ID. */
export async function deleteAchievement(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.ACHIEVEMENTS, id));
}
