import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockeamos firebase-admin antes de importar el script — vitest hoists vi.mock.
// El script solo invoca `getApps`/`initializeApp`/`applicationDefault` cuando
// se llama a `getDb()` sin inyectar `db`; en tests siempre inyectamos `db`,
// pero igual mockeamos para evitar side-effects si el cache se llenara.
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
  classifyDoc,
  audit,
  applyMigration,
  checkCredentials,
  run,
  NEW_DISPLAYNAME_REGEX,
  BATCH_SIZE,
  SAMPLE_LIMIT,
} = await import('../migrate-displayname-lower-sync.mjs');

/**
 * Construye un mock de `db.collection('users').get()` con la coleccion de docs
 * provista. Cada doc expone `id`, `data()` y `ref` (para `batch.update`).
 */
function makeMockDb(docs, { batchCommit } = {}) {
  const docMap = new Map();
  const snapDocs = docs.map((d) => {
    const ref = { id: d.id, _path: `users/${d.id}` };
    docMap.set(d.id, ref);
    return {
      id: d.id,
      ref,
      data: () => d.data,
    };
  });

  const updateSpy = vi.fn();
  const commitSpy = vi.fn(async () => {
    if (typeof batchCommit === 'function') await batchCommit();
  });
  const batchFactory = vi.fn(() => ({
    update: updateSpy,
    commit: commitSpy,
  }));

  const db = {
    collection: vi.fn((name) => {
      if (name !== 'users') throw new Error(`unexpected collection: ${name}`);
      return {
        get: vi.fn(async () => ({ size: snapDocs.length, docs: snapDocs })),
        doc: vi.fn((id) => {
          if (!docMap.has(id)) {
            const ref = { id, _path: `users/${id}` };
            docMap.set(id, ref);
          }
          return docMap.get(id);
        }),
      };
    }),
    batch: batchFactory,
  };

  return { db, updateSpy, commitSpy, batchFactory };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseMode', () => {
  it('returns "audit" by default', () => {
    expect(parseMode([])).toBe('audit');
    expect(parseMode(undefined)).toBe('audit');
  });

  it('returns "audit" explicitly when --audit is passed', () => {
    expect(parseMode(['--audit'])).toBe('audit');
  });

  it('returns "apply" when --apply is passed', () => {
    expect(parseMode(['--apply'])).toBe('apply');
  });

  it('prefers --apply when both flags are present', () => {
    expect(parseMode(['--audit', '--apply'])).toBe('apply');
  });
});

describe('checkCredentials', () => {
  it('returns false when GOOGLE_APPLICATION_CREDENTIALS is missing', () => {
    const errorSpy = vi.fn();
    const ok = checkCredentials({}, { error: errorSpy });
    expect(ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    const allArgs = errorSpy.mock.calls.flat().join(' ');
    expect(allArgs).toMatch(/GOOGLE_APPLICATION_CREDENTIALS/);
  });

  it('returns true when GOOGLE_APPLICATION_CREDENTIALS is set', () => {
    const errorSpy = vi.fn();
    const ok = checkCredentials({ GOOGLE_APPLICATION_CREDENTIALS: './sa.json' }, { error: errorSpy });
    expect(ok).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('NEW_DISPLAYNAME_REGEX', () => {
  it('accepts valid display names', () => {
    expect(NEW_DISPLAYNAME_REGEX.test('Juan')).toBe(true);
    expect(NEW_DISPLAYNAME_REGEX.test('Maria Lopez')).toBe(true);
    expect(NEW_DISPLAYNAME_REGEX.test('Ana_99')).toBe(true);
    expect(NEW_DISPLAYNAME_REGEX.test('A')).toBe(true);
  });

  it('rejects names with leading or trailing whitespace', () => {
    expect(NEW_DISPLAYNAME_REGEX.test(' Pedro')).toBe(false);
    expect(NEW_DISPLAYNAME_REGEX.test('Pedro ')).toBe(false);
    expect(NEW_DISPLAYNAME_REGEX.test('   ')).toBe(false);
  });

  it('rejects names ending with a dot (tradeoff documented in PRD)', () => {
    expect(NEW_DISPLAYNAME_REGEX.test('Mr.')).toBe(false);
    expect(NEW_DISPLAYNAME_REGEX.test('L.')).toBe(false);
  });
});

describe('classifyDoc', () => {
  it('returns null for docs without displayName', () => {
    expect(classifyDoc({ id: 'a', data: {} })).toBeNull();
    expect(classifyDoc({ id: 'a', data: { displayName: '' } })).toBeNull();
    expect(classifyDoc({ id: 'a', data: { displayName: 123 } })).toBeNull();
  });

  it('flags missing displayNameLower', () => {
    const c = classifyDoc({ id: 'u1', data: { displayName: 'Juan' } });
    expect(c?.missing).toBe(true);
    expect(c?.desync).toBe(false);
    expect(c?.expectedLower).toBe('juan');
  });

  it('flags desync when lower !== name.toLowerCase()', () => {
    const c = classifyDoc({
      id: 'u2',
      data: { displayName: 'Juan', displayNameLower: 'pedro' },
    });
    expect(c?.missing).toBe(false);
    expect(c?.desync).toBe(true);
    expect(c?.currentLower).toBe('pedro');
    expect(c?.expectedLower).toBe('juan');
  });

  it('does not flag desync when lower matches', () => {
    const c = classifyDoc({
      id: 'u3',
      data: { displayName: 'Juan', displayNameLower: 'juan' },
    });
    expect(c?.missing).toBe(false);
    expect(c?.desync).toBe(false);
  });

  it('flags invalidRegex independently of missing/desync', () => {
    const c1 = classifyDoc({ id: 'u4', data: { displayName: ' Pedro' } });
    expect(c1?.invalidRegex).toBe(true);
    expect(c1?.missing).toBe(true);

    const c2 = classifyDoc({
      id: 'u5',
      data: { displayName: 'Mr.', displayNameLower: 'mr.' },
    });
    expect(c2?.invalidRegex).toBe(true);
    expect(c2?.missing).toBe(false);
    expect(c2?.desync).toBe(false);
  });
});

describe('audit (happy path)', () => {
  it('detecta missing, desync e invalidRegex separadamente', async () => {
    const { db } = makeMockDb([
      // Valido — no aparece en counts.
      { id: 'ok1', data: { displayName: 'Juan', displayNameLower: 'juan' } },
      // Missing.
      { id: 'm1', data: { displayName: 'Maria' } },
      { id: 'm2', data: { displayName: 'Pedro' } },
      // Desync.
      { id: 'd1', data: { displayName: 'Ana', displayNameLower: 'ANA' } },
      // Invalid regex (no missing — tiene lower correcto).
      { id: 'r1', data: { displayName: 'Mr.', displayNameLower: 'mr.' } },
      // Doble: invalid regex + missing.
      { id: 'mr1', data: { displayName: ' Espacio' } },
      // Sin displayName — ignorado.
      { id: 'skip1', data: {} },
    ]);

    const report = await audit(db);

    expect(report.total).toBe(7);
    expect(report.counts.missing).toBe(2 + 1); // m1, m2, mr1
    expect(report.counts.desync).toBe(1); // d1
    expect(report.counts.invalidRegex).toBe(2); // r1, mr1
    expect(report.toFix.map((f) => f.id).sort()).toEqual(['d1', 'm1', 'm2', 'mr1']);
    // mr1 cae en missing pero su expectedLower es " espacio" (la regex es responsabilidad de las rules, no del lower).
    expect(report.toFix.find((f) => f.id === 'mr1')?.expectedLower).toBe(' espacio');
    expect(report.samples.missing.length).toBeGreaterThan(0);
    expect(report.samples.desync.length).toBe(1);
    expect(report.samples.invalidRegex.length).toBe(2);
  });

  it('limita los samples a SAMPLE_LIMIT por categoria', async () => {
    const docs = [];
    for (let i = 0; i < SAMPLE_LIMIT + 5; i++) {
      docs.push({ id: `m${i}`, data: { displayName: `Name${i}` } });
    }
    const { db } = makeMockDb(docs);
    const report = await audit(db);

    expect(report.counts.missing).toBe(SAMPLE_LIMIT + 5);
    expect(report.samples.missing.length).toBe(SAMPLE_LIMIT);
  });

  it('skipea docs sin displayName string sin contarlos en counts', async () => {
    const { db } = makeMockDb([
      { id: 's1', data: {} },
      { id: 's2', data: { displayName: null } },
      { id: 's3', data: { displayName: 42 } },
    ]);

    const report = await audit(db);
    expect(report.counts.missing).toBe(0);
    expect(report.counts.desync).toBe(0);
    expect(report.toFix).toHaveLength(0);
  });
});

describe('applyMigration (happy path)', () => {
  it('corrige missing y desync, no toca invalidRegex puro', async () => {
    const docs = [
      { id: 'ok1', data: { displayName: 'Juan', displayNameLower: 'juan' } },
      { id: 'm1', data: { displayName: 'Maria' } }, // missing → fix
      { id: 'd1', data: { displayName: 'Ana', displayNameLower: 'ANA' } }, // desync → fix
      { id: 'r1', data: { displayName: 'Mr.', displayNameLower: 'mr.' } }, // invalidRegex puro → NO fix
    ];
    const { db, updateSpy, commitSpy } = makeMockDb(docs);

    const report = await audit(db);
    const updated = await applyMigration(db, report.toFix, { logger: { log: vi.fn() } });

    expect(updated).toBe(2);
    // updates llamados con expectedLower correcto.
    const updateCalls = updateSpy.mock.calls.map(([ref, payload]) => ({ id: ref.id, payload }));
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls.find((c) => c.id === 'm1')?.payload).toEqual({ displayNameLower: 'maria' });
    expect(updateCalls.find((c) => c.id === 'd1')?.payload).toEqual({ displayNameLower: 'ana' });
    expect(updateCalls.find((c) => c.id === 'r1')).toBeUndefined();
    // un solo commit (2 docs < BATCH_SIZE).
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('idempotencia: segunda corrida tras apply exitoso es no-op', async () => {
    // Fase 1: docs con problemas.
    const docs = [
      { id: 'm1', data: { displayName: 'Maria' } },
      { id: 'd1', data: { displayName: 'Ana', displayNameLower: 'ANA' } },
    ];
    const { db: db1 } = makeMockDb(docs);
    const report1 = await audit(db1);
    expect(report1.toFix).toHaveLength(2);
    const updated1 = await applyMigration(db1, report1.toFix, { logger: { log: vi.fn() } });
    expect(updated1).toBe(2);

    // Fase 2: simular el estado post-apply (los docs ya tienen displayNameLower correcto).
    const docsAfter = [
      { id: 'm1', data: { displayName: 'Maria', displayNameLower: 'maria' } },
      { id: 'd1', data: { displayName: 'Ana', displayNameLower: 'ana' } },
    ];
    const { db: db2, updateSpy, commitSpy, batchFactory } = makeMockDb(docsAfter);

    const report2 = await audit(db2);
    expect(report2.counts.missing).toBe(0);
    expect(report2.counts.desync).toBe(0);
    expect(report2.toFix).toHaveLength(0);

    const updated2 = await applyMigration(db2, report2.toFix, { logger: { log: vi.fn() } });
    expect(updated2).toBe(0);
    // Critico: ningun batch creado, ningun update, ningun commit en la 2da pasada.
    expect(batchFactory).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('respeta BATCH_SIZE: commitea cada 500 updates', async () => {
    const total = BATCH_SIZE + 3;
    const toFix = [];
    for (let i = 0; i < total; i++) {
      toFix.push({ id: `u${i}`, expectedLower: `name${i}` });
    }
    const { db, commitSpy } = makeMockDb([]);
    const updated = await applyMigration(db, toFix, { logger: { log: vi.fn() } });

    expect(updated).toBe(total);
    // dos commits: uno tras llegar a BATCH_SIZE, otro con los 3 restantes.
    expect(commitSpy).toHaveBeenCalledTimes(2);
  });

  it('retorna 0 cuando toFix esta vacio (no crea batch)', async () => {
    const { db, batchFactory } = makeMockDb([]);
    const updated = await applyMigration(db, [], { logger: { log: vi.fn() } });
    expect(updated).toBe(0);
    expect(batchFactory).not.toHaveBeenCalled();
  });
});

describe('run (orchestrator)', () => {
  it('precondition fail: sin GOOGLE_APPLICATION_CREDENTIALS retorna ok:false', async () => {
    const errorSpy = vi.fn();
    const result = await run({
      db: undefined, // no se usa porque corta antes.
      argv: ['--audit'],
      env: {}, // sin la env var
      logger: { log: vi.fn(), error: errorSpy },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing-credentials');
    }
    expect(errorSpy).toHaveBeenCalled();
  });

  it('audit mode: corre audit, NO escribe', async () => {
    const { db, batchFactory, updateSpy, commitSpy } = makeMockDb([
      { id: 'm1', data: { displayName: 'Maria' } },
    ]);

    const result = await run({
      db,
      argv: ['--audit'],
      env: { GOOGLE_APPLICATION_CREDENTIALS: './sa.json' },
      logger: { log: vi.fn(), error: vi.fn() },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe('audit');
      expect(result.report.counts.missing).toBe(1);
      expect(result.updated).toBe(0);
    }
    expect(batchFactory).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('apply mode: corre audit + applyMigration y reporta updated > 0', async () => {
    const { db } = makeMockDb([
      { id: 'm1', data: { displayName: 'Maria' } },
      { id: 'd1', data: { displayName: 'Ana', displayNameLower: 'ANA' } },
    ]);

    const result = await run({
      db,
      argv: ['--apply'],
      env: { GOOGLE_APPLICATION_CREDENTIALS: './sa.json' },
      logger: { log: vi.fn(), error: vi.fn() },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe('apply');
      expect(result.updated).toBe(2);
    }
  });

  it('default mode (sin flag) es audit', async () => {
    const { db } = makeMockDb([{ id: 'm1', data: { displayName: 'Maria' } }]);

    const result = await run({
      db,
      argv: [],
      env: { GOOGLE_APPLICATION_CREDENTIALS: './sa.json' },
      logger: { log: vi.fn(), error: vi.fn() },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe('audit');
    }
  });
});
