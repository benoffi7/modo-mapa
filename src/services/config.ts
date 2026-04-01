/**
 * Firestore service for the `config` collection.
 * Reads global app configuration documents.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

export interface AppVersionConfig {
  minVersion: string | undefined;
}

/**
 * Fetches the appVersion config document.
 * Returns { minVersion: undefined } if the document does not exist.
 */
export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'));
  if (!snap.exists()) return { minVersion: undefined };
  const data = snap.data() as { minVersion?: string };
  return { minVersion: data.minVersion };
}
