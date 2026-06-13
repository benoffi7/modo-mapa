import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockeamos firebase-admin antes de importar el script — vitest hoists vi.mock.
// En tests siempre inyectamos `db`, pero igual mockeamos para evitar
// side-effects si el cache de getDb() se llenara.
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}));

const {
  parseMode,
  extractCommentId,
  audit,
  applyBackfill,
  printAuditReport,
  run,
  BATCH_SIZE,
  GETALL_CHUNK_SIZE,
  FREE_TIER_WRITES_PER_DAY,
} = await import('../backfill-commentlikes-businessid.mjs');

/**
 * Construye un mock de db con:
 *   - `commentLikes` collection: `.get()` devuelve `likes`, `.doc(id)` un ref.
 *   - `comments` collection: `.doc(id)` un ref; `getAll(...refs)` resuelve cada
 *     comment desde `commentsById`.
 *   - `batch()` con `update`/`delete`/`commit` spies.
 */
function makeMockDb(likes, commentsById, { batchCommit } = {}) {
  const snapDocs = likes.map((l) => ({
    id: l.id,
    data: () => l.data,
  }));

  const updateSpy = vi.fn();
  const deleteSpy = vi.fn();
  const commitSpy = vi.fn(async () => {
    if (typeof batchCommit === 'function') await batchCommit();
  });
  const batchFactory = vi.fn(() => ({
    update: updateSpy,
    delete: deleteSpy,
    commit: commitSpy,
  }));

  const getAllSpy = vi.fn(async (...refs) =>
    refs.map((ref) => {
      const found = commentsById[ref.__commentId];
      return {
        exists: () => found !== undefined,
        data: () => found,
      };
    }),
  );

  const db = {
    collection: vi.fn((name) => {
      if (name === 'commentLikes') {
        return {
          get: vi.fn(async () => ({ size: snapDocs.length, docs: snapDocs })),
          doc: vi.fn((id) => ({ __commentLikeId: id })),
        };
      }
      if (name === 'comments') {
        return {
          doc: vi.fn((id) => ({ __commentId: id })),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    }),
    getAll: getAllSpy,
    batch: batchFactory,
  };

  return { db, updateSpy, deleteSpy, commitSpy, batchFactory, getAllSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseMode', () => {
  it('returns "audit" by default', () => {
    expect(parseMode([])).toBe('audit');
    expect(parseMode(undefined)).toBe('audit');
  });

  it('returns "apply" when --apply is passed', () => {
    expect(parseMode(['--apply'])).toBe('apply');
  });

  it('--apply wins when both flags present', () => {
    expect(parseMode(['--audit', '--apply'])).toBe('apply');
  });
});

describe('extractCommentId', () => {
  it('usa el campo commentId si existe', () => {
    expect(extractCommentId({ id: 'u1__c1', data: { commentId: 'cX' } })).toBe('cX');
  });

  it('deriva del doc id compuesto si no hay campo', () => {
    expect(extractCommentId({ id: 'u1__c1', data: {} })).toBe('c1');
  });

  it('devuelve undefined si no se puede derivar', () => {
    expect(extractCommentId({ id: 'sinSeparador', data: {} })).toBeUndefined();
  });
});

describe('audit', () => {
  it('clasifica withBusinessId / toBackfill / orphan', async () => {
    const likes = [
      { id: 'u1__c1', data: { userId: 'u1', commentId: 'c1', businessId: 'biz_001' } }, // skip
      { id: 'u1__c2', data: { userId: 'u1', commentId: 'c2' } }, // toBackfill (comment existe)
      { id: 'u1__c3', data: { userId: 'u1', commentId: 'c3' } }, // orphan (comment borrado)
    ];
    const commentsById = { c2: { businessId: 'biz_002' } };
    const { db } = makeMockDb(likes, commentsById);

    const report = await audit(db);

    expect(report.total).toBe(3);
    expect(report.withBusinessId).toBe(1);
    expect(report.toBackfill).toEqual([{ likeId: 'u1__c2', businessId: 'biz_002' }]);
    expect(report.orphan).toEqual([{ likeId: 'u1__c3' }]);
  });

  it('businessId invalido NO cuenta como withBusinessId (se reclasifica)', async () => {
    const likes = [
      { id: 'u1__c1', data: { userId: 'u1', commentId: 'c1', businessId: 'no_valido' } },
    ];
    const commentsById = { c1: { businessId: 'biz_009' } };
    const { db } = makeMockDb(likes, commentsById);

    const report = await audit(db);
    expect(report.withBusinessId).toBe(0);
    expect(report.toBackfill).toEqual([{ likeId: 'u1__c1', businessId: 'biz_009' }]);
  });

  it('agrupa los reads de comments en chunks de 30 (getAll)', async () => {
    const likes = Array.from({ length: 35 }, (_, i) => ({
      id: `u1__c${i}`,
      data: { userId: 'u1', commentId: `c${i}` },
    }));
    const commentsById = {};
    const { db, getAllSpy } = makeMockDb(likes, commentsById);

    await audit(db);
    expect(GETALL_CHUNK_SIZE).toBe(30);
    // 35 candidatos → 2 chunks (30 + 5)
    expect(getAllSpy).toHaveBeenCalledTimes(2);
  });
});

describe('applyBackfill', () => {
  it('setea businessId en toBackfill y elimina orphans', async () => {
    const { db, updateSpy, deleteSpy, commitSpy } = makeMockDb([], {});
    const plan = {
      toBackfill: [{ likeId: 'u1__c2', businessId: 'biz_002' }],
      orphan: [{ likeId: 'u1__c3' }],
    };

    const result = await applyBackfill(db, plan);

    expect(result).toEqual({ updated: 1, deleted: 1 });
    expect(updateSpy).toHaveBeenCalledWith({ __commentLikeId: 'u1__c2' }, { businessId: 'biz_002' });
    expect(deleteSpy).toHaveBeenCalledWith({ __commentLikeId: 'u1__c3' });
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('es idempotente: plan vacio → 0 ops, sin commit', async () => {
    const { db, commitSpy } = makeMockDb([], {});
    const result = await applyBackfill(db, { toBackfill: [], orphan: [] });
    expect(result).toEqual({ updated: 0, deleted: 0 });
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('respeta BATCH_SIZE (commitea por lotes)', async () => {
    const { db, commitSpy } = makeMockDb([], {});
    const toBackfill = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => ({
      likeId: `like_${i}`,
      businessId: 'biz_001',
    }));
    await applyBackfill(db, { toBackfill, orphan: [] });
    // 501 ops → 2 commits (500 + 1)
    expect(commitSpy).toHaveBeenCalledTimes(2);
  });
});

describe('audit + apply (--audit no escribe)', () => {
  it('run en modo audit no commitea ningun batch', async () => {
    const likes = [
      { id: 'u1__c2', data: { userId: 'u1', commentId: 'c2' } },
    ];
    const commentsById = { c2: { businessId: 'biz_002' } };
    const { db, commitSpy } = makeMockDb(likes, commentsById);

    const result = await run({ db, argv: ['--audit'], logger: { log: vi.fn(), error: vi.fn() } });
    expect(result.mode).toBe('audit');
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('run en modo apply backfillea y luego re-run es no-op (idempotencia)', async () => {
    // Primera corrida: el like sin businessId se backfillea.
    const likesV1 = [{ id: 'u1__c2', data: { userId: 'u1', commentId: 'c2' } }];
    const commentsById = { c2: { businessId: 'biz_002' } };
    const first = makeMockDb(likesV1, commentsById);
    const r1 = await run({ db: first.db, argv: ['--apply'], logger: { log: vi.fn(), error: vi.fn() } });
    expect(r1.updated).toBe(1);

    // Segunda corrida: el doc ya tiene businessId → 0 ops, sin commit.
    const likesV2 = [{ id: 'u1__c2', data: { userId: 'u1', commentId: 'c2', businessId: 'biz_002' } }];
    const second = makeMockDb(likesV2, commentsById);
    const r2 = await run({ db: second.db, argv: ['--apply'], logger: { log: vi.fn(), error: vi.fn() } });
    expect(r2.updated).toBe(0);
    expect(r2.deleted).toBe(0);
    expect(second.commitSpy).not.toHaveBeenCalled();
  });
});

describe('printAuditReport', () => {
  it('imprime el conteo de legacy docs y el cap del free tier', () => {
    const logs = [];
    const logger = { log: (...a) => logs.push(a.join(' ')) };
    const report = {
      total: 3,
      withBusinessId: 1,
      toBackfill: [{ likeId: 'u1__c2', businessId: 'biz_002' }],
      orphan: [{ likeId: 'u1__c3' }],
    };
    printAuditReport(report, 'audit', logger);
    const joined = logs.join('\n');
    expect(joined).toContain('Legacy docs a escribir: 2');
    expect(joined).toContain(`Cap free tier writes/dia: ${FREE_TIER_WRITES_PER_DAY}`);
  });
});
