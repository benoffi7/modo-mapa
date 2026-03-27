import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetDb,
  mockGetStorage,
  mockAssertAdmin,
  mockExportDocuments,
  mockImportDocuments,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: unknown) => Promise<unknown>) | null>,
  mockGetDb: vi.fn(),
  mockGetStorage: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockExportDocuments: vi.fn(),
  mockImportDocuments: vi.fn(),
}));

const callIndex = vi.hoisted(() => ({ value: 0 }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, fn: (request: unknown) => Promise<unknown>) => {
    const names = ['createBackup', 'listBackups', 'restoreBackup', 'deleteBackup'];
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

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@google-cloud/firestore', () => {
  class MockFirestoreAdminClient {
    exportDocuments = mockExportDocuments;
    importDocuments = mockImportDocuments;
  }
  return {
    v1: {
      FirestoreAdminClient: MockFirestoreAdminClient,
    },
  };
});

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/sentry', () => ({
  captureException: vi.fn(),
}));

function createMockDb() {
  const mockTxGet = vi.fn();
  const mockTxSet = vi.fn();
  const mockTxUpdate = vi.fn();

  const mockRunTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const data = mockTxGet.mock.results?.[0]?.value;
    if (!data) {
      // Rate limit not exceeded
      mockTxGet.mockResolvedValue({ data: () => undefined });
    }
    await fn({ get: mockTxGet, set: mockTxSet, update: mockTxUpdate });
  });

  const mockDocRef = {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockCollection = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue(mockDocRef),
  });

  const db = {
    collection: mockCollection,
    doc: vi.fn().mockReturnValue(mockDocRef),
    runTransaction: mockRunTransaction,
  };
  mockGetDb.mockReturnValue(db);

  return { db, mockRunTransaction, mockTxGet, mockTxSet, mockTxUpdate };
}

function createMockStorage(files: Array<{ name: string }> = []) {
  const mockFileDelete = vi.fn().mockResolvedValue(undefined);
  const mockGetFiles = vi.fn().mockResolvedValue([
    files.map((f) => ({ ...f, delete: mockFileDelete })),
    null,
    { prefixes: files.map((f) => `backups/${f.name}/`) },
  ]);
  const mockBucket = vi.fn().mockReturnValue({
    getFiles: mockGetFiles,
    file: vi.fn().mockReturnValue({ delete: mockFileDelete }),
  });
  mockGetStorage.mockReturnValue({ bucket: mockBucket });
  return { mockFileDelete, mockGetFiles };
}

import '../../admin/backups';

describe('createBackup', () => {
  const handler = () => handlers.createBackup!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates backup and returns id', async () => {
    createMockDb();
    mockExportDocuments.mockResolvedValueOnce([{ promise: () => Promise.resolve() }]);

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: {},
    });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('createdAt');
    expect(mockExportDocuments).toHaveBeenCalled();
  });

  it('handles export failure', async () => {
    createMockDb();
    mockExportDocuments.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    await expect(handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: {},
    })).rejects.toThrow();
  });
});

describe('listBackups', () => {
  const handler = () => handlers.listBackups!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated backup list', async () => {
    createMockDb();
    createMockStorage([{ name: 'backup1' }, { name: 'backup2' }]);

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: { pageSize: 10 },
    }) as { backups: unknown[]; totalCount: number };

    expect(result.backups).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('returns empty list when no backups', async () => {
    createMockDb();
    createMockStorage([]);

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: {},
    }) as { backups: unknown[]; totalCount: number };

    expect(result.backups).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});

describe('restoreBackup', () => {
  const handler = () => handlers.restoreBackup!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing backupId', async () => {
    createMockDb();
    await expect(handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: {},
    })).rejects.toThrow('backupId es requerido');
  });

  it('throws on invalid backupId characters', async () => {
    createMockDb();
    await expect(handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { backupId: '../malicious' },
    })).rejects.toThrow('caracteres invalidos');
  });

  it('creates safety backup before restore', async () => {
    createMockDb();
    mockExportDocuments.mockResolvedValue([{ promise: () => Promise.resolve() }]);
    mockImportDocuments.mockResolvedValue([{ promise: () => Promise.resolve() }]);

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: { backupId: 'backup-2026-01-01' },
    }) as { success: true; safetyBackupId: string };

    expect(result.success).toBe(true);
    expect(result.safetyBackupId).toBeDefined();
    // Export should be called twice: once for safety backup, once for restore
    expect(mockExportDocuments).toHaveBeenCalledTimes(1);
    expect(mockImportDocuments).toHaveBeenCalledTimes(1);
  });
});

describe('deleteBackup', () => {
  const handler = () => handlers.deleteBackup!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing backupId', async () => {
    createMockDb();
    await expect(handler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: {},
    })).rejects.toThrow('backupId es requerido');
  });

  it('throws when backup not found (no files)', async () => {
    createMockDb();
    const mockGetFiles = vi.fn().mockResolvedValue([[]]);
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    await expect(handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: { backupId: 'nonexistent' },
    })).rejects.toThrow('Backup no encontrado');
  });

  it('deletes all files in backup prefix', async () => {
    createMockDb();
    const mockFileDelete = vi.fn().mockResolvedValue(undefined);
    const files = [
      { delete: mockFileDelete, name: 'f1' },
      { delete: mockFileDelete, name: 'f2' },
    ];
    const mockGetFiles = vi.fn().mockResolvedValue([files]);
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    const result = await handler()({
      auth: { uid: 'admin1', token: { admin: true, email: 'admin@test.com' } },
      data: { backupId: 'backup-123' },
    });

    expect(result).toEqual({ success: true });
    expect(mockFileDelete).toHaveBeenCalledTimes(2);
  });
});
