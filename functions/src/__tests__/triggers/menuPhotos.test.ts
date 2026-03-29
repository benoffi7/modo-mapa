import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockIncrementCounter,
  mockTrackWrite,
  mockGetStorage,
  mockSharp,
} = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockDownload = vi.fn().mockResolvedValue([Buffer.from('fake-image')]);
  const mockFile = vi.fn().mockReturnValue({
    download: mockDownload,
    save: mockSave,
  });
  const mockBucket = vi.fn().mockReturnValue({ file: mockFile });
  const mockGetStorage = vi.fn().mockReturnValue({ bucket: mockBucket });

  const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from('thumb'));
  const mockJpeg = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
  const mockResize = vi.fn().mockReturnValue({ jpeg: mockJpeg });
  const mockSharp = vi.fn().mockReturnValue({ resize: mockResize });

  return {
    handlers: {} as Record<string, (event: unknown) => Promise<void>>,
    mockGetFirestore: vi.fn(),
    mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
    mockTrackWrite: vi.fn().mockResolvedValue(undefined),
    mockGetStorage,
    mockSharp,
    mockFile,
    mockSave,
    mockDownload,
    mockBucket,
    mockResize,
    mockJpeg,
    mockToBuffer,
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}));

vi.mock('sharp', () => ({ default: mockSharp }));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
}));

function createMockDb() {
  const db = {};
  mockGetFirestore.mockReturnValue(db);
  return { db };
}

import '../../triggers/menuPhotos';

describe('onMenuPhotoCreated', () => {
  const onCreated = () => handlers['created:menuPhotos/{photoId}'];

  beforeEach(() => vi.clearAllMocks());

  it('skips if no snapshot data', async () => {
    await onCreated()({ data: null, params: { photoId: 'p1' } });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('generates thumbnail and updates doc', async () => {
    createMockDb();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { photoId: 'photo123' },
      data: {
        data: () => ({ storagePath: 'menus/u1/biz1/photo123.jpg', businessId: 'biz1', userId: 'u1' }),
        ref: { update: mockUpdate },
      },
    });

    expect(mockSharp).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      thumbnailPath: 'menus/u1/biz1/photo123_thumb.jpg',
    });
  });

  it('increments counters', async () => {
    createMockDb();

    await onCreated()({
      params: { photoId: 'photo123' },
      data: {
        data: () => ({ storagePath: 'menus/u1/biz1/photo123.jpg', businessId: 'biz1', userId: 'u1' }),
        ref: { update: vi.fn().mockResolvedValue(undefined) },
      },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'menuPhotos', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'menuPhotos');
  });

  it('still increments counters when thumbnail generation fails', async () => {
    createMockDb();
    mockSharp.mockImplementationOnce(() => {
      throw new Error('sharp failed');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await onCreated()({
      params: { photoId: 'photo123' },
      data: {
        data: () => ({ storagePath: 'menus/u1/biz1/photo123.jpg', businessId: 'biz1', userId: 'u1' }),
        ref: { update: vi.fn() },
      },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'menuPhotos', 1);
    consoleSpy.mockRestore();
  });

  it('constructs correct thumbnail path using businessId and photoId', async () => {
    createMockDb();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { photoId: 'myPhotoId' },
      data: {
        data: () => ({ storagePath: 'menus/u2/bizABC/original.jpg', businessId: 'bizABC', userId: 'u2' }),
        ref: { update: mockUpdate },
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      thumbnailPath: 'menus/u2/bizABC/myPhotoId_thumb.jpg',
    });
  });
});
