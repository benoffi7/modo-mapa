import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));
vi.mock('../utils/busyFlag', () => ({
  isBusyFlagActive: vi.fn(),
}));
vi.mock('../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn() },
}));
vi.mock('../constants/timing', () => ({
  FORCE_UPDATE_COOLDOWN_MS: 5 * 60 * 1000,
  PWA_FALLBACK_GRACE_MS: 60 * 60 * 1000,
}));
vi.mock('../constants/storage', () => ({
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH: 'force_update_last_refresh',
  STORAGE_KEY_FORCE_UPDATE_LAST_CHECK: 'force_update_last_check',
}));

import { registerSW } from 'virtual:pwa-register';
import { isBusyFlagActive } from '../utils/busyFlag';

const LAST_REFRESH_KEY = 'force_update_last_refresh';
const LAST_CHECK_KEY = 'force_update_last_check';
const COOLDOWN_MS = 5 * 60 * 1000;
const GRACE_MS = 60 * 60 * 1000;


describe('registerPwa', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(isBusyFlagActive).mockReturnValue(false);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ---------------------------------------------------------------------------
  // Caso 1: DEV retorna sin registrar
  // ---------------------------------------------------------------------------
  it('no llama registerSW en entorno DEV', async () => {
    vi.stubEnv('DEV', true);
    vi.resetModules();
    const { registerPwa } = await import('./registerPwa');
    registerPwa();
    expect(registerSW).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Casos en PROD: setup común — mock registerSW capturando el callback
  // ---------------------------------------------------------------------------

  async function setupProd(): Promise<{
    onNeedRefresh: () => void;
    mockUpdateSW: ReturnType<typeof vi.fn>;
  }> {
    vi.stubEnv('DEV', false);
    vi.resetModules();

    const mockUpdateSW = vi.fn().mockResolvedValue(undefined);
    let capturedOnNeedRefresh: (() => void) | undefined;

    const { registerSW: mockRegisterSW } = await import('virtual:pwa-register');
    vi.mocked(mockRegisterSW).mockImplementation((options?: RegisterSWOptions) => {
      capturedOnNeedRefresh = options?.onNeedRefresh;
      return mockUpdateSW;
    });

    const { registerPwa } = await import('./registerPwa');
    registerPwa();

    return {
      onNeedRefresh: capturedOnNeedRefresh!,
      mockUpdateSW,
    };
  }

  // ---------------------------------------------------------------------------
  // Caso 2: cooldown activo → no dispara
  // ---------------------------------------------------------------------------
  it('onNeedRefresh no llama updateSW cuando cooldown esta activo', async () => {
    localStorage.setItem(LAST_REFRESH_KEY, String(Date.now() - COOLDOWN_MS / 2));
    const { onNeedRefresh, mockUpdateSW } = await setupProd();
    onNeedRefresh();
    expect(mockUpdateSW).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Caso 3: busy-flag activo → no dispara
  // ---------------------------------------------------------------------------
  it('onNeedRefresh no llama updateSW cuando busy-flag esta activo', async () => {
    const { isBusyFlagActive: mockBusy } = await import('../utils/busyFlag');
    vi.mocked(mockBusy).mockReturnValue(true);
    const { onNeedRefresh, mockUpdateSW } = await setupProd();
    onNeedRefresh();
    expect(mockUpdateSW).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Caso 4: hook-grace activo (lastCheck reciente) → no dispara
  // ---------------------------------------------------------------------------
  it('onNeedRefresh no llama updateSW cuando el hook esta vivo (lastCheck reciente)', async () => {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now() - GRACE_MS / 2));
    const { onNeedRefresh, mockUpdateSW } = await setupProd();
    onNeedRefresh();
    expect(mockUpdateSW).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Caso 5: todas las condiciones libres → dispara updateSW(true) + escribe lastRefresh
  // ---------------------------------------------------------------------------
  it('onNeedRefresh llama updateSW(true) y escribe LAST_REFRESH cuando todas las guards pasan', async () => {
    // Sin cooldown, sin busyFlag, sin lastCheck
    localStorage.removeItem(LAST_REFRESH_KEY);
    localStorage.removeItem(LAST_CHECK_KEY);
    const { isBusyFlagActive: mockBusy } = await import('../utils/busyFlag');
    vi.mocked(mockBusy).mockReturnValue(false);

    const { onNeedRefresh, mockUpdateSW } = await setupProd();
    onNeedRefresh();

    expect(mockUpdateSW).toHaveBeenCalledOnce();
    expect(mockUpdateSW).toHaveBeenCalledWith(true);

    const written = localStorage.getItem(LAST_REFRESH_KEY);
    expect(written).not.toBeNull();
    expect(Number(written)).toBeGreaterThan(Date.now() - 1000);
  });

  // ---------------------------------------------------------------------------
  // Caso 6: registerSW llamado con immediate: true
  // ---------------------------------------------------------------------------
  it('llama registerSW con { immediate: true, onNeedRefresh, onOfflineReady }', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();

    const mockUpdateSW = vi.fn().mockResolvedValue(undefined);
    const { registerSW: mockRegisterSW } = await import('virtual:pwa-register');
    vi.mocked(mockRegisterSW).mockImplementation(() => mockUpdateSW);

    const { registerPwa } = await import('./registerPwa');
    registerPwa();

    expect(mockRegisterSW).toHaveBeenCalledWith(
      expect.objectContaining({
        immediate: true,
        onNeedRefresh: expect.any(Function),
        onOfflineReady: expect.any(Function),
      }),
    );
  });
});
