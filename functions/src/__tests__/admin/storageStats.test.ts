import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handler,
  mockAssertAdmin,
  mockGetStorage,
} = vi.hoisted(() => ({
  handler: { fn: null as ((request: unknown) => Promise<unknown>) | null },
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockGetStorage: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, fn: (request: unknown) => Promise<unknown>) => {
    handler.fn = fn;
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
  logger: { error: vi.fn() },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: mockGetStorage,
}));

vi.mock('../../utils/sentry', () => ({
  captureException: vi.fn(),
}));

import '../../admin/storageStats';

describe('getStorageStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handler is registered', () => {
    expect(handler.fn).not.toBeNull();
  });

  it('returns total bytes and file count', async () => {
    const files = [
      { metadata: { size: 1000 } },
      { metadata: { size: 2000 } },
      { metadata: { size: 500 } },
    ];
    const mockGetFiles = vi.fn().mockResolvedValue([files]);
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { totalBytes: number; fileCount: number; updatedAt: string };

    expect(result.totalBytes).toBe(3500);
    expect(result.fileCount).toBe(3);
    expect(result.updatedAt).toBeDefined();
  });

  it('returns zero when no files', async () => {
    const mockGetFiles = vi.fn().mockResolvedValue([[]]);
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { totalBytes: number; fileCount: number };

    expect(result.totalBytes).toBe(0);
    expect(result.fileCount).toBe(0);
  });

  it('handles files with missing size metadata', async () => {
    const files = [
      { metadata: { size: 1000 } },
      { metadata: {} },
    ];
    const mockGetFiles = vi.fn().mockResolvedValue([files]);
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    const result = await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    }) as { totalBytes: number; fileCount: number };

    expect(result.totalBytes).toBe(1000);
    expect(result.fileCount).toBe(2);
  });

  it('queries menuPhotos/ prefix', async () => {
    const mockGetFiles = vi.fn().mockResolvedValue([[]]);
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    await handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    });

    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'menuPhotos/' });
  });

  it('throws internal error when storage fails', async () => {
    const mockGetFiles = vi.fn().mockRejectedValue(new Error('Storage error'));
    const mockBucket = vi.fn().mockReturnValue({ getFiles: mockGetFiles });
    mockGetStorage.mockReturnValue({ bucket: mockBucket });

    await expect(handler.fn!({
      auth: { uid: 'admin1', token: { admin: true } },
    })).rejects.toThrow('Error obteniendo estadísticas de storage');
  });
});
