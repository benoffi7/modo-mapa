/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUploadBytesResumable = vi.fn();
const mockInvalidateBusinessCache = vi.fn();
const mockTrackEvent = vi.fn();

const mockDocRef = { id: 'photo-doc-1' };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({
    withConverter: vi.fn(() => 'converted-collection'),
  })),
  doc: vi.fn(() => mockDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(),
  serverTimestamp: () => 'server-ts',
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => 'storage-ref'),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {},
  storage: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { MENU_PHOTOS: 'menuPhotos' },
}));

vi.mock('../config/converters', () => ({
  menuPhotoConverter: {},
}));

vi.mock('../hooks/useBusinessDataCache', () => ({
  invalidateBusinessCache: (...args: unknown[]) => mockInvalidateBusinessCache(...args),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { uploadMenuPhoto, getApprovedMenuPhoto, getUserPendingPhotos, getMenuPhotosCollection } from './menuPhotos';

describe('getMenuPhotosCollection', () => {
  it('returns a collection reference', () => {
    const result = getMenuPhotosCollection();
    expect(result).toBeDefined();
  });
});

describe('uploadMenuPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    // Default: no pending photos
    mockGetDocs.mockResolvedValue({ size: 0 });
  });

  function makeUploadTask(autoComplete = true) {
    const listeners: Record<string, Function[]> = {};
    const task = {
      on: vi.fn((event: string, onProgress: Function, onError: Function, onComplete: Function) => {
        listeners[event] = [onProgress, onError, onComplete];
        if (autoComplete) {
          // Simulate immediate completion
          setTimeout(() => onComplete(), 0);
        }
      }),
      cancel: vi.fn(),
    };
    return { task, listeners };
  }

  it('rejects unsupported file types', async () => {
    const file = new File([''], 'doc.pdf', { type: 'application/pdf' });

    await expect(
      uploadMenuPhoto('user1', 'biz1', file),
    ).rejects.toThrow('Formato no soportado. Usa JPG, PNG o WebP.');
  });

  it('rejects files over 5MB', async () => {
    const file = new File([''], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });

    await expect(
      uploadMenuPhoto('user1', 'biz1', file),
    ).rejects.toThrow('La imagen es muy grande. Máximo 5 MB.');
  });

  it('rejects when user has 3+ pending photos', async () => {
    mockGetDocs.mockResolvedValue({ size: 3 });
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await expect(
      uploadMenuPhoto('user1', 'biz1', file),
    ).rejects.toThrow('Ya tenés 3 fotos pendientes de revisión. Esperá a que se revisen.');
  });

  it('uploads photo and creates Firestore doc on success', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const { task } = makeUploadTask();
    mockUploadBytesResumable.mockReturnValue(task);

    const promise = uploadMenuPhoto('user1', 'biz1', file);
    // Let the setTimeout in the mock execute
    await vi.waitFor(() => expect(task.on).toHaveBeenCalled());

    const result = await promise;

    expect(result.docId).toBe('photo-doc-1');
    expect(mockSetDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        userId: 'user1',
        businessId: 'biz1',
        status: 'pending',
        reportCount: 0,
      }),
    );
    expect(mockInvalidateBusinessCache).toHaveBeenCalledWith('biz1');
    expect(mockTrackEvent).toHaveBeenCalledWith('menu_photo_upload', { business_id: 'biz1' });
  });

  it('reports progress via callback', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const onProgress = vi.fn();
    const { task } = makeUploadTask(false);
    mockUploadBytesResumable.mockReturnValue(task);

    const promise = uploadMenuPhoto('user1', 'biz1', file, onProgress);
    await vi.waitFor(() => expect(task.on).toHaveBeenCalled());

    // Simulate progress
    const callbacks = task.on.mock.calls[0].slice(1) as [Function, Function, Function];
    const [progressCb, , completeCb] = callbacks;
    (progressCb as Function)({ bytesTransferred: 512, totalBytes: 1024 });
    expect(onProgress).toHaveBeenCalledWith(50);

    // Complete the upload
    await (completeCb as Function)();
    await promise;
  });

  it('rejects on upload error', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const { task } = makeUploadTask(false);
    mockUploadBytesResumable.mockReturnValue(task);

    const promise = uploadMenuPhoto('user1', 'biz1', file);
    await vi.waitFor(() => expect(task.on).toHaveBeenCalled());

    const [, errorCb] = task.on.mock.calls[0].slice(1) as [Function, Function];
    (errorCb as Function)(new Error('Upload failed'));

    await expect(promise).rejects.toThrow('Upload failed');
  });

  it('cancels upload via AbortSignal', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });

    const controller = new AbortController();
    const { task } = makeUploadTask(false);
    mockUploadBytesResumable.mockReturnValue(task);

    const promise = uploadMenuPhoto('user1', 'biz1', file, undefined, controller.signal);
    await vi.waitFor(() => expect(task.on).toHaveBeenCalled());

    controller.abort();

    await expect(promise).rejects.toThrow('Upload cancelado');
    expect(task.cancel).toHaveBeenCalled();
  });
});

describe('getApprovedMenuPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns photo when approved photo exists', async () => {
    const photoData = { id: 'p-1', status: 'approved', businessId: 'biz1' };
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ data: () => photoData }],
    });

    const result = await getApprovedMenuPhoto('biz1');
    expect(result).toEqual(photoData);
  });

  it('returns null when no approved photo', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    const result = await getApprovedMenuPhoto('biz1');
    expect(result).toBeNull();
  });
});

describe('getUserPendingPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user pending photos', async () => {
    const photos = [
      { id: 'p-1', status: 'pending' },
      { id: 'p-2', status: 'pending' },
    ];
    mockGetDocs.mockResolvedValue({
      docs: photos.map((p) => ({ data: () => p })),
    });

    const result = await getUserPendingPhotos('user1', 'biz1');
    expect(result).toEqual(photos);
  });

  it('returns empty array when no pending photos', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await getUserPendingPhotos('user1', 'biz1');
    expect(result).toEqual([]);
  });
});
