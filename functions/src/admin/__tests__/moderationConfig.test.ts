import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlerRef,
  mockGetDb,
  mockAssertAdmin,
  mockCheckCallableRateLimit,
  mockLogAbuse,
} = vi.hoisted(() => ({
  handlerRef: { fn: null as ((request: any) => Promise<any>) | null },
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCheckCallableRateLimit: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    handlerRef.fn = fn;
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

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: () => mockGetDb(),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: any[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/callableRateLimit', () => ({
  checkCallableRateLimit: (...args: any[]) => mockCheckCallableRateLimit(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: any[]) => mockLogAbuse(...args),
}));

function createMockDb(prevBannedWords: string[] = []) {
  const mockConfigDoc = {
    exists: prevBannedWords.length > 0,
    data: () => ({ bannedWords: prevBannedWords }),
  };
  const mockConfigRef = {
    get: vi.fn().mockResolvedValue(mockConfigDoc),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const mockCollection = vi.fn(() => ({
    doc: vi.fn(() => mockConfigRef),
  }));
  const db = { collection: mockCollection };
  mockGetDb.mockReturnValue(db);
  return { db, mockConfigRef, mockCollection };
}

// Import AFTER mocks
import '../moderationConfig';

describe('updateModerationConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getHandler = () => handlerRef.fn!;

  it('rejects non-admin users', async () => {
    createMockDb();
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(
      getHandler()({ auth: { uid: 'user1' }, data: { bannedWords: [] } }),
    ).rejects.toThrow('Admin only');
  });

  it('rejects if bannedWords is not an array', async () => {
    createMockDb();
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: { bannedWords: 'not-array' } }),
    ).rejects.toThrow('bannedWords must be an array');
  });

  it('rejects if a word is too long', async () => {
    createMockDb();
    const longWord = 'a'.repeat(51);
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: { bannedWords: [longWord] } }),
    ).rejects.toThrow('Each bannedWord must be 50 characters or less');
  });

  it('rejects if array exceeds 500 items', async () => {
    createMockDb();
    const words = Array.from({ length: 501 }, (_, i) => `word${i}`);
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: { bannedWords: words } }),
    ).rejects.toThrow('bannedWords array exceeds 500 items');
  });

  it('rejects if a word is not a string', async () => {
    createMockDb();
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: { bannedWords: [123] } }),
    ).rejects.toThrow('Each bannedWord must be a string');
  });

  it('checks rate limit', async () => {
    createMockDb();
    mockCheckCallableRateLimit.mockRejectedValueOnce(new Error('Rate limit'));
    await expect(
      getHandler()({ auth: { uid: 'admin1' }, data: { bannedWords: ['word1'] } }),
    ).rejects.toThrow('Rate limit');
  });

  it('successfully updates and writes audit log', async () => {
    const { mockConfigRef } = createMockDb(['old']);
    const result = await getHandler()({
      auth: { uid: 'admin1' },
      data: { bannedWords: ['new1', 'new2'] },
    });

    expect(result).toEqual({ success: true });
    expect(mockConfigRef.set).toHaveBeenCalledWith(
      { bannedWords: ['new1', 'new2'] },
      { merge: true },
    );
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'admin1',
        type: 'config_edit',
        collection: 'config',
      }),
    );
  });
});
