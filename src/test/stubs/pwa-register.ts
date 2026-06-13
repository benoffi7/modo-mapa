/**
 * Stub para el módulo virtual `virtual:pwa-register` en tests.
 * El alias en vitest.config.ts apunta aquí; los tests lo mockean con vi.mock().
 */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
