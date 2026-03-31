import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {}, storage: {}, functions: {} }));
vi.mock('../../config/collections', () => ({ COLLECTIONS: { MENU_PHOTOS: 'menuPhotos' } }));
vi.mock('../../config/converters', () => ({ menuPhotoConverter: {} }));
vi.mock('../businessDataCache', () => ({ invalidateBusinessCache: vi.fn() }));
vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockCallableFn = vi.fn();
const mockHttpsCallable = vi.fn<(f: unknown, n: string) => typeof mockCallableFn>(() => mockCallableFn);
vi.mock('firebase/functions', () => ({
  httpsCallable: (functions: unknown, name: string) => mockHttpsCallable(functions, name),
}));

const mockGetDownloadURL = vi.fn();
const mockRef = vi.fn();
vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  uploadBytesResumable: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(),
}));

describe('reportMenuPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls httpsCallable with correct arguments', async () => {
    mockCallableFn.mockResolvedValueOnce({ data: {} });

    const { reportMenuPhoto } = await import('../menuPhotos');
    await reportMenuPhoto('photo-123');

    expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'reportMenuPhoto');
    expect(mockCallableFn).toHaveBeenCalledWith({ photoId: 'photo-123' });
  });

  it('propagates errors', async () => {
    mockCallableFn.mockRejectedValueOnce(new Error('callable failed'));

    const { reportMenuPhoto } = await import('../menuPhotos');
    await expect(reportMenuPhoto('photo-err')).rejects.toThrow('callable failed');
  });
});

describe('getMenuPhotoUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns download URL', async () => {
    const mockStorageRef = { fullPath: 'menus/test' };
    mockRef.mockReturnValueOnce(mockStorageRef);
    mockGetDownloadURL.mockResolvedValueOnce('https://storage.example.com/photo.jpg');

    const { getMenuPhotoUrl } = await import('../menuPhotos');
    const url = await getMenuPhotoUrl('menus/test/photo.jpg');

    expect(mockRef).toHaveBeenCalledWith({}, 'menus/test/photo.jpg');
    expect(mockGetDownloadURL).toHaveBeenCalledWith(mockStorageRef);
    expect(url).toBe('https://storage.example.com/photo.jpg');
  });

  it('propagates storage errors', async () => {
    mockRef.mockReturnValueOnce({});
    mockGetDownloadURL.mockRejectedValueOnce(new Error('storage error'));

    const { getMenuPhotoUrl } = await import('../menuPhotos');
    await expect(getMenuPhotoUrl('bad/path')).rejects.toThrow('storage error');
  });
});
