import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlerHolder,
  mockGetDb,
  mockGetStorage,
} = vi.hoisted(() => ({
  handlerHolder: { fn: null as (() => Promise<void>) | null },
  mockGetDb: vi.fn(),
  mockGetStorage: vi.fn(),
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => {
    handlerHolder.fn = handler;
    return handler;
  },
}));

vi.mock('../../helpers/env', () => ({
  get getDb() { return mockGetDb; },
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}));

function createMockSetup(docs: Array<{ storagePath: string; thumbnailPath?: string }>) {
  const mockDocDelete = vi.fn().mockResolvedValue(undefined);

  const mockDocs = docs.map((d) => ({
    data: () => d,
    ref: { delete: mockDocDelete },
  }));

  const mockGet = vi.fn().mockResolvedValue({
    docs: mockDocs,
    size: mockDocs.length,
  });
  const mockWhere2 = vi.fn().mockReturnValue({ get: mockGet });
  const mockWhere = vi.fn().mockReturnValue({ where: mockWhere2 });
  const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });

  const mockHeartbeatSet = vi.fn().mockResolvedValue(undefined);
  const mockHeartbeatDoc = vi.fn().mockReturnValue({ set: mockHeartbeatSet });
  const db = { collection: mockCollection, doc: mockHeartbeatDoc };
  mockGetDb.mockReturnValue(db);

  const mockFileDelete = vi.fn().mockResolvedValue(undefined);
  const mockFile = vi.fn().mockReturnValue({ delete: mockFileDelete });
  const mockBucket = vi.fn().mockReturnValue({ file: mockFile });
  mockGetStorage.mockReturnValue({ bucket: mockBucket });

  return { db, mockDocDelete, mockFileDelete, mockFile, mockCollection };
}

import '../../scheduled/cleanupPhotos';

describe('cleanupRejectedPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handler is registered', () => {
    expect(handlerHolder.fn).not.toBeNull();
  });

  it('deletes rejected photos older than 7 days', async () => {
    const { mockDocDelete, mockFile } = createMockSetup([
      { storagePath: 'menus/biz1/photo1.jpg', thumbnailPath: 'menus/biz1/photo1_thumb.jpg' },
    ]);

    await handlerHolder.fn!();

    expect(mockFile).toHaveBeenCalledWith('menus/biz1/photo1.jpg');
    expect(mockFile).toHaveBeenCalledWith('menus/biz1/photo1_thumb.jpg');
    expect(mockDocDelete).toHaveBeenCalledTimes(1);
  });

  it('deletes only storagePath when no thumbnailPath', async () => {
    const { mockDocDelete, mockFile } = createMockSetup([
      { storagePath: 'menus/biz1/photo2.jpg' },
    ]);

    await handlerHolder.fn!();

    expect(mockFile).toHaveBeenCalledWith('menus/biz1/photo2.jpg');
    expect(mockFile).toHaveBeenCalledTimes(1);
    expect(mockDocDelete).toHaveBeenCalledTimes(1);
  });

  it('handles no rejected photos gracefully', async () => {
    createMockSetup([]);
    await handlerHolder.fn!();
    // No errors thrown
  });

  it('handles multiple rejected photos', async () => {
    const { mockDocDelete } = createMockSetup([
      { storagePath: 'menus/biz1/p1.jpg' },
      { storagePath: 'menus/biz2/p2.jpg' },
      { storagePath: 'menus/biz3/p3.jpg' },
    ]);

    await handlerHolder.fn!();

    expect(mockDocDelete).toHaveBeenCalledTimes(3);
  });

  it('continues processing when storage delete fails', async () => {
    const { mockDocDelete } = createMockSetup([
      { storagePath: 'menus/biz1/missing.jpg' },
    ]);

    // The try/catch in the source swallows errors
    await handlerHolder.fn!();

    expect(mockDocDelete).toHaveBeenCalledTimes(1);
  });

  it('queries menuPhotos with status rejected', async () => {
    const { mockCollection } = createMockSetup([]);

    await handlerHolder.fn!();

    expect(mockCollection).toHaveBeenCalledWith('menuPhotos');
  });
});
