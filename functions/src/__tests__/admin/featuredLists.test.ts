import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockIsEmulator,
  mockUpdate,
  mockGet,
  mockGetDb,
  mockAssertAdmin,
} = vi.hoisted(() => ({
  mockIsEmulator: { value: true },
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockGet: vi.fn(),
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn(),
}));

vi.mock('../../helpers/env', () => ({
  get IS_EMULATOR() { return mockIsEmulator.value; },
  ENFORCE_APP_CHECK: false,
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: (...args: unknown[]) => unknown) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

import { toggleFeaturedList, getPublicLists, getFeaturedLists } from '../../admin/featuredLists';

const toggleHandler = toggleFeaturedList as unknown as (request: unknown) => Promise<unknown>;
const publicHandler = getPublicLists as unknown as (request: unknown) => Promise<unknown>;
const featuredHandler = getFeaturedLists as unknown as (request: unknown) => Promise<unknown>;

function setupDocDb() {
  const db = {
    doc: vi.fn().mockReturnValue({ get: mockGet, update: mockUpdate }),
  };
  mockGetDb.mockReturnValue(db);
  return db;
}

function setupCollectionDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const mockDocs = docs.map((d) => ({
    id: d.id,
    data: () => d.data,
  }));

  const mockCollGet = vi.fn().mockResolvedValue({ docs: mockDocs });
  const mockOrderBy = vi.fn().mockReturnValue({ get: mockCollGet });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });

  const db = {
    collection: mockCollection,
    doc: vi.fn().mockReturnValue({ get: mockGet, update: mockUpdate }),
  };
  mockGetDb.mockReturnValue(db);
  return { db, mockCollection };
}

describe('toggleFeaturedList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws on missing listId', async () => {
    setupDocDb();
    await expect(toggleHandler({ auth: { uid: 'admin' }, data: { featured: true } }))
      .rejects.toThrow('listId required');
  });

  it('throws on non-boolean featured', async () => {
    setupDocDb();
    await expect(toggleHandler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: 'yes' } }))
      .rejects.toThrow('featured must be boolean');
  });

  it('throws when list not found', async () => {
    setupDocDb();
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(toggleHandler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: true } }))
      .rejects.toThrow('Lista no encontrada');
  });

  it('throws when featuring a private list', async () => {
    setupDocDb();
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isPublic: false }) });
    await expect(toggleHandler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: true } }))
      .rejects.toThrow('Solo listas públicas pueden ser destacadas');
  });

  it('allows unfeaturing a private list', async () => {
    setupDocDb();
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isPublic: false }) });
    const result = await toggleHandler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: false } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ featured: false });
  });

  it('features a public list successfully', async () => {
    setupDocDb();
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isPublic: true }) });
    const result = await toggleHandler({ auth: { uid: 'admin' }, data: { listId: 'l1', featured: true } });
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ featured: true });
  });
});

describe('getPublicLists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all public lists', async () => {
    setupCollectionDb([
      { id: 'l1', data: { ownerId: 'u1', name: 'Mi Lista', description: 'Desc', isPublic: true, featured: true, itemCount: 5 } },
      { id: 'l2', data: { ownerId: 'u2', name: 'Otra', description: '', isPublic: true, featured: false, itemCount: 0 } },
    ]);

    const result = await publicHandler({ auth: { uid: 'admin' }, data: {} }) as { lists: unknown[] };

    expect(result.lists).toHaveLength(2);
    expect(result.lists[0]).toEqual(expect.objectContaining({
      id: 'l1',
      name: 'Mi Lista',
      isPublic: true,
      featured: true,
    }));
  });

  it('returns empty list when no public lists exist', async () => {
    setupCollectionDb([]);

    const result = await publicHandler({ auth: { uid: 'admin' }, data: {} }) as { lists: unknown[] };

    expect(result.lists).toHaveLength(0);
  });

  it('defaults missing fields', async () => {
    setupCollectionDb([
      { id: 'l1', data: {} },
    ]);

    const result = await publicHandler({ auth: { uid: 'admin' }, data: {} }) as {
      lists: Array<{ name: string; ownerId: string; itemCount: number }>;
    };

    expect(result.lists[0].name).toBe('');
    expect(result.lists[0].ownerId).toBe('');
    expect(result.lists[0].itemCount).toBe(0);
  });
});

describe('getFeaturedLists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when not authenticated', async () => {
    await expect(featuredHandler({ auth: undefined, data: {} }))
      .rejects.toThrow('Must be signed in');
  });

  it('returns featured lists for authenticated user', async () => {
    setupCollectionDb([
      { id: 'l1', data: { ownerId: 'u1', name: 'Featured', description: 'A list', isPublic: true, featured: true, itemCount: 3, updatedAt: 'ts' } },
    ]);

    const result = await featuredHandler({ auth: { uid: 'user1' }, data: {} }) as { lists: unknown[] };

    expect(result.lists).toHaveLength(1);
    expect(result.lists[0]).toEqual(expect.objectContaining({
      id: 'l1',
      featured: true,
    }));
  });

  it('returns empty list when no featured lists', async () => {
    setupCollectionDb([]);

    const result = await featuredHandler({ auth: { uid: 'user1' }, data: {} }) as { lists: unknown[] };

    expect(result.lists).toHaveLength(0);
  });
});
