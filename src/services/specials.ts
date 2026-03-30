/**
 * Firestore service for the `specials` collection.
 *
 * All Firestore reads/writes for specials go through this module so
 * components never import Firestore SDK directly.
 */
import { collection, getDocs, doc, setDoc, deleteDoc, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import type { Special } from '../types';

/** Fetch all specials ordered by `order` field (admin use). */
export async function fetchSpecials(): Promise<Special[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.SPECIALS), orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Special));
}

/** Fetch only active specials ordered by `order` field (user-facing use). */
export async function fetchActiveSpecials(): Promise<Special[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.SPECIALS), where('active', '==', true), orderBy('order')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Special));
}

/**
 * Save all specials — deletes removed ones, upserts current ones.
 * Each doc gets an `updatedAt` timestamp.
 */
export async function saveAllSpecials(specials: Special[]): Promise<void> {
  const existingSnap = await getDocs(collection(db, COLLECTIONS.SPECIALS));
  const currentIds = new Set(specials.map((s) => s.id));

  for (const d of existingSnap.docs) {
    if (!currentIds.has(d.id)) await deleteDoc(d.ref);
  }

  for (const s of specials) {
    const { id, ...data } = s;
    await setDoc(doc(db, COLLECTIONS.SPECIALS, id), { ...data, updatedAt: new Date() });
  }
}
