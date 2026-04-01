/**
 * Functions service for admin photo review operations.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export async function approveMenuPhoto(photoId: string): Promise<void> {
  const fn = httpsCallable(functions, 'approveMenuPhoto');
  await fn({ photoId });
}

export async function rejectMenuPhoto(photoId: string, reason: string): Promise<void> {
  const fn = httpsCallable(functions, 'rejectMenuPhoto');
  await fn({ photoId, reason });
}

export async function deleteMenuPhoto(photoId: string): Promise<void> {
  const fn = httpsCallable(functions, 'deleteMenuPhoto');
  await fn({ photoId });
}
