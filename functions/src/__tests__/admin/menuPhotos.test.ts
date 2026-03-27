import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetDb,
  mockGetStorage,
  mockAssertAdmin,
  mockCreateNotification,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: unknown) => Promise<unknown>) | null>,
  mockGetDb: vi.fn(),
  mockGetStorage: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
}));

const callIndex = vi.hoisted(() => ({ value: 0 }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, fn: (request: unknown) => Promise<unknown>) => {
    const names = ['approveMenuPhoto', 'rejectMenuPhoto', 'deleteMenuPhoto', 'reportMenuPhoto'];
    handlers[names[callIndex.value++]] = fn;
    return fn;
  },
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
    increment: vi.fn((n: number) => ({ __increment: n })),
  },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK: false,
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

function createMockDb(overrides?: {
  photoExists?: boolean;
  photoData?: Record<string, unknown>;
  existingApprovedDocs?: Array<{ ref: { id: string } }>;
}) {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockBatchUpdate = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatch = vi.fn().mockReturnValue({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  });

  const photoData = overrides?.photoData ?? {
    status: 'pending',
    userId: 'user1',
    businessId: 'biz1',
    businessName: 'TestBiz',
    storagePath: 'menus/biz1/photo.jpg',
    thumbnailPath: 'menus/biz1/photo_thumb.jpg',
  };

  const existingApprovedDocs = overrides?.existingApprovedDocs ?? [];
  const mockApprovedGet = vi.fn().mockResolvedValue({ docs: existingApprovedDocs });
  const mockApprovedWhere2 = vi.fn().mockReturnValue({ get: mockApprovedGet });
  const mockApprovedWhere = vi.fn().mockReturnValue({ where: mockApprovedWhere2 });

  // Transaction mock
  const mockTxGet = vi.fn().mockResolvedValue({ exists: false });
  const mockTxSet = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockRunTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({ get: mockTxGet, set: mockTxSet, update: mockTxUpdate });
  });

  const mockDocRef = {
    get: vi.fn().mockResolvedValue({
      exists: overrides?.photoExists ?? true,
      data: () => photoData,
    }),
    update: mockUpdate,
    delete: mockDelete,
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({ id: 'report-ref' }),
    }),
  };

  const mockCollection = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue(mockDocRef),
    where: mockApprovedWhere,
  });

  const db = {
    collection: mockCollection,
    batch: mockBatch,
    runTransaction: mockRunTransaction,
  };
  mockGetDb.mockReturnValue(db);

  return { db, mockUpdate, mockDelete, mockBatchUpdate, mockBatchCommit, mockDocRef, mockTxGet, mockTxSet, mockTxUpdate, mockRunTransaction };
}

function createMockStorage() {
  const mockFileDelete = vi.fn().mockResolvedValue(undefined);
  const mockFile = vi.fn().mockReturnValue({ delete: mockFileDelete });
  const mockBucket = vi.fn().mockReturnValue({ file: mockFile });
  mockGetStorage.mockReturnValue({ bucket: mockBucket });
  return { mockFileDelete, mockFile };
}

import '../../admin/menuPhotos';

describe('approveMenuPhoto', () => {
  const handler = () => handlers.approveMenuPhoto!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing photoId', async () => {
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} }))
      .rejects.toThrow('photoId required');
  });

  it('throws when photo not found', async () => {
    createMockDb({ photoExists: false });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Photo not found');
  });

  it('throws when photo status is not pending or rejected', async () => {
    createMockDb({ photoData: { status: 'approved', userId: 'u1', businessId: 'b1' } });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Photo must be pending or rejected');
  });

  it('approves photo and notifies user', async () => {
    const { mockBatchCommit } = createMockDb();
    const result = await handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } });

    expect(result).toEqual({ success: true });
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user1',
        type: 'photo_approved',
      }),
    );
  });

  it('replaces existing approved photos for same business', async () => {
    const existingDoc = { ref: { id: 'old_photo' } };
    const { mockBatchUpdate } = createMockDb({ existingApprovedDocs: [existingDoc] });

    await handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } });

    expect(mockBatchUpdate).toHaveBeenCalledWith(existingDoc.ref, { status: 'replaced' });
  });
});

describe('rejectMenuPhoto', () => {
  const handler = () => handlers.rejectMenuPhoto!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing photoId', async () => {
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} }))
      .rejects.toThrow('photoId required');
  });

  it('throws when photo not found', async () => {
    createMockDb({ photoExists: false });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Photo not found');
  });

  it('rejects photo with reason and notifies user', async () => {
    const { mockUpdate } = createMockDb();
    const result = await handler()({
      auth: { uid: 'admin1' },
      data: { photoId: 'p1', reason: 'Blurry image' },
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected',
      rejectionReason: 'Blurry image',
    }));
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'photo_rejected',
        message: expect.stringContaining('Blurry image'),
      }),
    );
  });

  it('rejects photo without reason', async () => {
    const { mockUpdate } = createMockDb();
    await handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      rejectionReason: '',
    }));
  });
});

describe('deleteMenuPhoto', () => {
  const handler = () => handlers.deleteMenuPhoto!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing photoId', async () => {
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} }))
      .rejects.toThrow('photoId required');
  });

  it('throws when photo not found', async () => {
    createMockDb({ photoExists: false });
    createMockStorage();
    await expect(handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Photo not found');
  });

  it('deletes files from storage and Firestore doc', async () => {
    const { mockDelete } = createMockDb();
    const { mockFile } = createMockStorage();

    const result = await handler()({ auth: { uid: 'admin1' }, data: { photoId: 'p1' } });

    expect(result).toEqual({ success: true });
    expect(mockFile).toHaveBeenCalledWith('menus/biz1/photo.jpg');
    expect(mockFile).toHaveBeenCalledWith('menus/biz1/photo_thumb.jpg');
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('reportMenuPhoto', () => {
  const handler = () => handlers.reportMenuPhoto!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when not authenticated', async () => {
    await expect(handler()({ auth: undefined, data: { photoId: 'p1' } }))
      .rejects.toThrow('Must be signed in');
  });

  it('throws on missing photoId', async () => {
    // Make assertAdmin not throw for reportMenuPhoto (it checks auth directly)
    await expect(handler()({ auth: { uid: 'u1' }, data: {} }))
      .rejects.toThrow('photoId required');
  });

  it('throws when photo not found', async () => {
    createMockDb({ photoExists: false });
    await expect(handler()({ auth: { uid: 'u1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Photo not found');
  });

  it('throws when photo is not approved', async () => {
    createMockDb({ photoData: { status: 'pending', userId: 'u1', businessId: 'b1' } });
    await expect(handler()({ auth: { uid: 'u1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Only approved photos can be reported');
  });

  it('reports approved photo successfully using transaction', async () => {
    createMockDb({ photoData: { status: 'approved', userId: 'u1', businessId: 'b1' } });
    const result = await handler()({ auth: { uid: 'reporter1' }, data: { photoId: 'p1' } });

    expect(result).toEqual({ success: true });
  });

  it('throws when user already reported photo', async () => {
    const { mockTxGet } = createMockDb({
      photoData: { status: 'approved', userId: 'u1', businessId: 'b1' },
    });
    mockTxGet.mockResolvedValueOnce({ exists: true });

    await expect(handler()({ auth: { uid: 'reporter1' }, data: { photoId: 'p1' } }))
      .rejects.toThrow('Ya reportaste esta foto');
  });
});
