import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockIsEmulator,
  mockUpdate,
  mockGet,
  mockGetDb,
  mockAssertAdmin,
  capturedConfigs,
  SENTINEL_PUBLIC,
  SENTINEL_ADMIN,
} = vi.hoisted(() => ({
  mockIsEmulator: { value: true },
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockGet: vi.fn(),
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn(),
  // Captura el primer arg (config) de cada `onCall(...)` en orden de declaracion
  // del modulo `featuredLists.ts`. Orden actual:
  //   index 0 → toggleFeaturedList
  //   index 1 → getPublicLists
  //   index 2 → getFeaturedLists
  capturedConfigs: [] as Array<{ enforceAppCheck?: unknown }>,
  // Sentinels distintos para assertear WHICH constant se uso en cada onCall
  // (ENFORCE_APP_CHECK vs ENFORCE_APP_CHECK_ADMIN). Valores cualesquiera
  // siempre que sean distinguibles.
  SENTINEL_PUBLIC: 'SENTINEL_ENFORCE_APP_CHECK',
  SENTINEL_ADMIN: 'SENTINEL_ENFORCE_APP_CHECK_ADMIN',
}));

vi.mock('../../helpers/env', () => ({
  get IS_EMULATOR() { return mockIsEmulator.value; },
  ENFORCE_APP_CHECK: SENTINEL_PUBLIC,
  ENFORCE_APP_CHECK_ADMIN: SENTINEL_ADMIN,
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (cfg: { enforceAppCheck?: unknown }, handler: (...args: unknown[]) => unknown) => {
    capturedConfigs.push(cfg);
    return handler;
  },
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

vi.mock('../../utils/callableRateLimit', () => ({
  checkCallableRateLimit: vi.fn().mockResolvedValue(undefined),
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

/** Build a chainable mock query that supports .where().orderBy().limit().startAfter().get() */
function setupCollectionDb(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
  cursorExists = false,
) {
  const mockDocs = docs.map((d) => ({
    id: d.id,
    data: () => d.data,
  }));

  const mockCollGet = vi.fn().mockResolvedValue({ docs: mockDocs, size: mockDocs.length });

  // Chainable object — every method returns an object that has all of them
  // so the builder can be called in any order without TypeError.
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.startAfter = vi.fn().mockReturnValue(chain);
  chain.get = mockCollGet;

  const mockCollection = vi.fn().mockReturnValue(chain);

  const mockCursorGet = vi.fn().mockResolvedValue({ exists: cursorExists });
  const mockDoc = vi.fn().mockReturnValue({
    get: (path?: unknown) => (path === undefined ? mockCursorGet() : mockGet()),
    update: mockUpdate,
  });

  const db = {
    collection: mockCollection,
    doc: mockDoc,
  };
  mockGetDb.mockReturnValue(db);
  return { db, mockCollection, chain, mockCursorGet };
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

  it('returns all public lists with nextCursor null when short page', async () => {
    const { chain } = setupCollectionDb([
      { id: 'l1', data: { ownerId: 'u1', name: 'Mi Lista', description: 'Desc', isPublic: true, featured: true, itemCount: 5 } },
      { id: 'l2', data: { ownerId: 'u2', name: 'Otra', description: '', isPublic: true, featured: false, itemCount: 0 } },
    ]);

    const result = await publicHandler({ auth: { uid: 'admin' }, data: {} }) as { lists: unknown[]; nextCursor: string | null };

    expect(result.lists).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
    expect(chain.limit).toHaveBeenCalledWith(100); // default pageSize
  });

  it('returns empty list when no public lists exist', async () => {
    setupCollectionDb([]);

    const result = await publicHandler({ auth: { uid: 'admin' }, data: {} }) as { lists: unknown[]; nextCursor: string | null };

    expect(result.lists).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
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

  it('clamps pageSize to MAX_PAGE_SIZE (500)', async () => {
    const { chain } = setupCollectionDb([]);
    await publicHandler({ auth: { uid: 'admin' }, data: { pageSize: 10_000 } });
    expect(chain.limit).toHaveBeenCalledWith(500);
  });

  it('uses custom pageSize when valid', async () => {
    const { chain } = setupCollectionDb([]);
    await publicHandler({ auth: { uid: 'admin' }, data: { pageSize: 50 } });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('returns nextCursor when page is full', async () => {
    // Exactly 2 docs requested, 2 returned → full page
    const { chain } = setupCollectionDb([
      { id: 'l1', data: { name: 'a' } },
      { id: 'l2', data: { name: 'b' } },
    ]);
    const result = await publicHandler({ auth: { uid: 'admin' }, data: { pageSize: 2 } }) as { nextCursor: string | null };
    expect(result.nextCursor).toBe('l2');
    expect(chain.limit).toHaveBeenCalledWith(2);
  });

  it('applies startAfter cursor when provided and cursor exists', async () => {
    const { chain } = setupCollectionDb([], true);
    await publicHandler({ auth: { uid: 'admin' }, data: { startAfter: 'l1' } });
    expect(chain.startAfter).toHaveBeenCalled();
  });

  it('ignores startAfter cursor when doc does not exist', async () => {
    const { chain } = setupCollectionDb([], false);
    await publicHandler({ auth: { uid: 'admin' }, data: { startAfter: 'ghost' } });
    expect(chain.startAfter).not.toHaveBeenCalled();
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

    const result = await featuredHandler({ auth: { uid: 'user1' }, data: {} }) as { lists: unknown[]; nextCursor: string | null };

    expect(result.lists).toHaveLength(1);
    expect(result.lists[0]).toEqual(expect.objectContaining({
      id: 'l1',
      featured: true,
    }));
    expect(result.nextCursor).toBeNull();
  });

  it('returns empty list when no featured lists', async () => {
    setupCollectionDb([]);

    const result = await featuredHandler({ auth: { uid: 'user1' }, data: {} }) as { lists: unknown[]; nextCursor: string | null };

    expect(result.lists).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('honors pageSize parameter and returns nextCursor', async () => {
    const { chain } = setupCollectionDb([
      { id: 'l1', data: { name: 'a' } },
      { id: 'l2', data: { name: 'b' } },
    ]);
    const result = await featuredHandler({ auth: { uid: 'user1' }, data: { pageSize: 2 } }) as { nextCursor: string | null };
    expect(result.nextCursor).toBe('l2');
    expect(chain.limit).toHaveBeenCalledWith(2);
  });

  it('rejects non-positive or non-numeric pageSize and falls back to default', async () => {
    const { chain } = setupCollectionDb([]);
    await featuredHandler({ auth: { uid: 'u1' }, data: { pageSize: -5 } });
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('clamps pageSize > 100 to local cap (FEATURED_LISTS_MAX_PAGE_SIZE)', async () => {
    const { chain } = setupCollectionDb([]);
    await featuredHandler({ auth: { uid: 'u1' }, data: { pageSize: 500 } });
    // getPublicLists clampa a 500; getFeaturedLists clampa a 100 (cap local)
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('clamps pageSize way above MAX_PAGE_SIZE to local cap (not 500)', async () => {
    const { chain } = setupCollectionDb([]);
    await featuredHandler({ auth: { uid: 'u1' }, data: { pageSize: 10_000 } });
    expect(chain.limit).toHaveBeenCalledWith(100);
    // Counter-assert: NO usar 500 (el cap global)
    expect(chain.limit).not.toHaveBeenCalledWith(500);
  });

  it('honors valid pageSize below local cap', async () => {
    const { chain } = setupCollectionDb([]);
    await featuredHandler({ auth: { uid: 'u1' }, data: { pageSize: 25 } });
    expect(chain.limit).toHaveBeenCalledWith(25);
  });
});

describe('getFeaturedLists onCall config', () => {
  it('is configured with ENFORCE_APP_CHECK (not ENFORCE_APP_CHECK_ADMIN)', () => {
    // Orden de exports en functions/src/admin/featuredLists.ts:
    //   0 → toggleFeaturedList   (admin)
    //   1 → getPublicLists       (admin)
    //   2 → getFeaturedLists     (publico — fix de inconsistencia)
    const GET_FEATURED_LISTS_CONFIG_INDEX = 2;
    const cfg = capturedConfigs[GET_FEATURED_LISTS_CONFIG_INDEX];

    expect(cfg).toBeDefined();
    expect(cfg.enforceAppCheck).toBe(SENTINEL_PUBLIC);
    // Counter-assert: NO debe ser el sentinel admin
    expect(cfg.enforceAppCheck).not.toBe(SENTINEL_ADMIN);
  });

  it('toggleFeaturedList and getPublicLists keep ENFORCE_APP_CHECK_ADMIN', () => {
    expect(capturedConfigs[0].enforceAppCheck).toBe(SENTINEL_ADMIN); // toggleFeaturedList
    expect(capturedConfigs[1].enforceAppCheck).toBe(SENTINEL_ADMIN); // getPublicLists
  });
});
