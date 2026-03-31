/**
 * Firestore + Storage service for the `menuPhotos` collection.
 */
import { collection, doc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import type { CollectionReference, DocumentReference } from 'firebase/firestore';
import type { UploadTask } from 'firebase/storage';
import { db, storage, functions } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { menuPhotoConverter } from '../config/converters';
import { invalidateBusinessCache } from './businessDataCache';
import { trackEvent } from '../utils/analytics';
import type { MenuPhoto } from '../types';

export function getMenuPhotosCollection(): CollectionReference<MenuPhoto> {
  return collection(db, COLLECTIONS.MENU_PHOTOS)
    .withConverter(menuPhotoConverter) as CollectionReference<MenuPhoto>;
}

/**
 * Upload a menu photo. Returns a promise that resolves when the upload
 * completes and the Firestore doc is created with status 'pending'.
 */
export async function uploadMenuPhoto(
  userId: string,
  businessId: string,
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<{ docId: string }> {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen es muy grande. Máximo 5 MB.');
  }

  // Check pending count for this user
  const pendingSnap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
  ));
  if (pendingSnap.size >= 3) {
    throw new Error('Ya tenés 3 fotos pendientes de revisión. Esperá a que se revisen.');
  }

  // Create Firestore doc ref to get ID
  const docRef: DocumentReference = doc(collection(db, COLLECTIONS.MENU_PHOTOS));
  const storagePath = `menus/${userId}/${businessId}/${docRef.id}_original`;

  // Upload to Storage with explicit content type
  const storageRef = ref(storage, storagePath);
  const uploadTask: UploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'image/jpeg',
  });

  return new Promise((resolve, reject) => {
    // Allow external cancellation via AbortSignal
    if (signal) {
      signal.addEventListener('abort', () => {
        uploadTask.cancel();
        reject(new Error('Upload cancelado'));
      }, { once: true });
    }

    uploadTask.on('state_changed',
      (snapshot) => {
        if (onProgress) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          await setDoc(docRef, {
            userId,
            businessId,
            storagePath,
            thumbnailPath: '',
            status: 'pending',
            createdAt: serverTimestamp(),
            reportCount: 0,
          });
          invalidateBusinessCache(businessId);
          trackEvent('menu_photo_upload', { business_id: businessId });
          resolve({ docId: docRef.id });
        } catch (err) {
          reject(err);
        }
      },
    );
  });
}

/**
 * Get the approved menu photo for a business (if any).
 */
export async function getApprovedMenuPhoto(businessId: string): Promise<MenuPhoto | null> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('businessId', '==', businessId),
    where('status', '==', 'approved'),
  ));
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Get user's pending photos for a business.
 */
export async function getUserPendingPhotos(
  userId: string,
  businessId: string,
): Promise<MenuPhoto[]> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('userId', '==', userId),
    where('businessId', '==', businessId),
    where('status', '==', 'pending'),
  ));
  return snap.docs.map((d) => d.data());
}

/**
 * Report a menu photo via Cloud Function callable.
 */
export async function reportMenuPhoto(photoId: string): Promise<void> {
  const report = httpsCallable(functions, 'reportMenuPhoto');
  await report({ photoId });
}

/**
 * Get download URL for a menu photo from Storage.
 */
export async function getMenuPhotoUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}
