import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * #342 F3 — `ENFORCE_APP_CHECK` ahora deriva de `APP_CHECK_ENFORCEMENT`
 * resuelto vía `defineString(...).value()` (Firebase params, default 'disabled'),
 * no de `process.env`. El valor se evalúa a top-level al importar `env.ts`, por
 * eso cada caso hace `vi.resetModules()` + import dinámico.
 */

// Estado mutable que controla qué devuelve el parameter en cada caso.
const param = { value: undefined as string | undefined };

vi.mock('firebase-functions/params', () => ({
  defineString: vi.fn((_name: string, opts?: { default?: string }) => ({
    // Sin valor explícito → cae al default declarado (Opción A del spec #342).
    value: () => (param.value !== undefined ? param.value : (opts?.default ?? '')),
  })),
}));

// env.ts importa getFirestore pero no lo invoca a top-level.
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn() }));

const ORIGINAL_EMULATOR = process.env.FUNCTIONS_EMULATOR;

async function loadEnforce(opts: { emulator: boolean; enforcement?: string }): Promise<boolean> {
  vi.resetModules();
  if (opts.emulator) process.env.FUNCTIONS_EMULATOR = 'true';
  else delete process.env.FUNCTIONS_EMULATOR;
  param.value = opts.enforcement; // undefined → usa el default 'disabled'
  const mod = await import('../../helpers/env');
  return mod.ENFORCE_APP_CHECK;
}

describe('ENFORCE_APP_CHECK (#342 F3 — APP_CHECK_ENFORCEMENT vía defineString)', () => {
  afterEach(() => {
    if (ORIGINAL_EMULATOR === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = ORIGINAL_EMULATOR;
  });

  it('enforcement="enabled" fuera de emulador → true', async () => {
    expect(await loadEnforce({ emulator: false, enforcement: 'enabled' })).toBe(true);
  });

  it('enforcement="disabled" → false', async () => {
    expect(await loadEnforce({ emulator: false, enforcement: 'disabled' })).toBe(false);
  });

  it('parameter sin configurar → default "disabled" → false', async () => {
    expect(await loadEnforce({ emulator: false, enforcement: undefined })).toBe(false);
  });

  it('IS_EMULATOR=true → false aunque enforcement="enabled"', async () => {
    expect(await loadEnforce({ emulator: true, enforcement: 'enabled' })).toBe(false);
  });
});
