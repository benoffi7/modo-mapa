import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { userSettingsConverter } from '../config/converters';
import type { UserSettings } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  profilePublic: false,
  notificationsEnabled: false,
  notifyLikes: false,
  notifyPhotos: false,
  notifyRankings: false,
  updatedAt: new Date(),
};

export async function fetchUserSettings(userId: string): Promise<UserSettings> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.USER_SETTINGS, userId).withConverter(userSettingsConverter),
  );
  return snap.exists() ? snap.data() : { ...DEFAULT_SETTINGS };
}

export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'updatedAt'>>,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.USER_SETTINGS, userId),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
