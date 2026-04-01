import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockIncrementCounter,
  mockTrackWrite,
  mockGetStorage,
  mockSharp,
  mockCheckRateLimit,
  mockLogAbuse,
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
    mockCheckRateLimit: vi.fn().mockResolvedValue(false),
    mockLogAbuse: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
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
        data: () => ({ storagePath: 'menus/u1/biz_001/photo123_original', businessId: 'biz_001', userId: 'u1' }),
        ref: { update: mockUpdate },
      },
    });

    expect(mockSharp).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      thumbnailPath: 'menus/u1/biz_001/photo123_thumb.jpg',
    });
  });

  it('increments counters', async () => {
    createMockDb();

    await onCreated()({
      params: { photoId: 'photo123' },
      data: {
        data: () => ({ storagePath: 'menus/u1/biz_001/photo123_original', businessId: 'biz_001', userId: 'u1' }),
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
        data: () => ({ storagePath: 'menus/u1/biz_001/photo123_original', businessId: 'biz_001', userId: 'u1' }),
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
        data: () => ({ storagePath: 'menus/u2/biz_123/original_file', businessId: 'biz_123', userId: 'u2' }),
        ref: { update: mockUpdate },
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      thumbnailPath: 'menus/u2/biz_123/myPhotoId_thumb.jpg',
    });
  });

  it('skips thumbnail and counters when rate limit exceeded', async () => {
    createMockDb();
    mockCheckRateLimit.mockResolvedValueOnce(true);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockRefDelete = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { photoId: 'photo123' },
      data: {
        data: () => ({ storagePath: 'menus/u1/biz_001/photo123_original', businessId: 'biz_001', userId: 'u1' }),
        ref: { update: mockUpdate, delete: mockRefDelete },
      },
    });

    expect(mockRefDelete).toHaveBeenCalled();
    expect(mockSharp).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockIncrementCounter).not.toHaveBeenCalled();
    expect(mockTrackWrite).not.toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u1',
      type: 'rate_limit',
      collection: 'menuPhotos',
      detail: 'Exceeded 10 menuPhotos/day',
    });
  });

  it('processes normally when rate limit not exceeded', async () => {
    createMockDb();
    mockCheckRateLimit.mockResolvedValueOnce(false);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { photoId: 'photo123' },
      data: {
        data: () => ({ storagePath: 'menus/u1/biz_001/photo123_original', businessId: 'biz_001', userId: 'u1' }),
        ref: { update: mockUpdate },
      },
    });

    expect(mockSharp).toHaveBeenCalled();
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'menuPhotos', 1);
    expect(mockLogAbuse).not.toHaveBeenCalled();
  });

  // #250: storagePath validation tests
  describe('storagePath validation', () => {
    it('rejects empty storagePath and logs abuse', async () => {
      createMockDb();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      await onCreated()({
        params: { photoId: 'p1' },
        data: {
          data: () => ({ storagePath: '', businessId: 'biz_001', userId: 'u1' }),
          ref: { update: mockUpdate },
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'rejected', rejectionReason: 'invalid_storage_path' });
      expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        userId: 'u1',
        type: 'invalid_input',
        collection: 'menuPhotos',
      }));
      expect(mockSharp).not.toHaveBeenCalled();
      expect(mockIncrementCounter).not.toHaveBeenCalled();
    });

    it('rejects path traversal attack (../feedback-media/)', async () => {
      createMockDb();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      await onCreated()({
        params: { photoId: 'p1' },
        data: {
          data: () => ({ storagePath: '../feedback-media/secret.jpg', businessId: 'biz_001', userId: 'u1' }),
          ref: { update: mockUpdate },
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'rejected', rejectionReason: 'invalid_storage_path' });
      expect(mockLogAbuse).toHaveBeenCalled();
      expect(mockSharp).not.toHaveBeenCalled();
    });

    it('rejects storagePath without menus/ prefix', async () => {
      createMockDb();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      await onCreated()({
        params: { photoId: 'p1' },
        data: {
          data: () => ({ storagePath: 'other/u1/biz_001/file', businessId: 'biz_001', userId: 'u1' }),
          ref: { update: mockUpdate },
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'rejected', rejectionReason: 'invalid_storage_path' });
    });

    it('rejects storagePath with userId mismatch', async () => {
      createMockDb();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      await onCreated()({
        params: { photoId: 'p1' },
        data: {
          data: () => ({ storagePath: 'menus/otherUser/biz_001/file_original', businessId: 'biz_001', userId: 'u1' }),
          ref: { update: mockUpdate },
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'rejected', rejectionReason: 'storage_path_user_mismatch' });
      expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        detail: expect.stringContaining('userId mismatch'),
      }));
      expect(mockSharp).not.toHaveBeenCalled();
    });

    it('rejects storagePath with businessId mismatch', async () => {
      createMockDb();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      await onCreated()({
        params: { photoId: 'p1' },
        data: {
          data: () => ({ storagePath: 'menus/u1/biz_999/file_original', businessId: 'biz_001', userId: 'u1' }),
          ref: { update: mockUpdate },
        },
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'rejected', rejectionReason: 'storage_path_business_mismatch' });
      expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        detail: expect.stringContaining('businessId mismatch'),
      }));
      expect(mockSharp).not.toHaveBeenCalled();
    });

    it('accepts valid storagePath and proceeds to thumbnail generation', async () => {
      createMockDb();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);

      await onCreated()({
        params: { photoId: 'photo456' },
        data: {
          data: () => ({ storagePath: 'menus/u1/biz_001/photo456_original', businessId: 'biz_001', userId: 'u1' }),
          ref: { update: mockUpdate },
        },
      });

      expect(mockSharp).toHaveBeenCalled();
      expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'menuPhotos', 1);
    });
  });
});
