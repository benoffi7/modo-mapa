import { registerSW } from 'virtual:pwa-register';
import { FORCE_UPDATE_COOLDOWN_MS, PWA_FALLBACK_GRACE_MS } from '../constants/timing';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
  STORAGE_KEY_FORCE_UPDATE_LAST_CHECK,
} from '../constants/storage';
import { isBusyFlagActive } from '../utils/busyFlag';
import { logger } from '../utils/logger';

function isCooldownActive(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH);
    if (!last) return false;
    return Date.now() - Number(last) < FORCE_UPDATE_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function isHookAlive(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK);
    if (!last) return false;
    return Date.now() - Number(last) < PWA_FALLBACK_GRACE_MS;
  } catch {
    return false;
  }
}

/**
 * Registra el Service Worker de vite-plugin-pwa y actua como fallback pasivo
 * del useForceUpdate hook. Solo dispara skipWaiting+reload si:
 *   1. Cooldown de 5 min no esta activo.
 *   2. No hay busy-flag activo.
 *   3. El hook Firestore no corrio un check exitoso en los ultimos PWA_FALLBACK_GRACE_MS.
 */
export function registerPwa(): void {
  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (isCooldownActive()) {
        logger.log('PWA fallback: cooldown active, deferring update');
        return;
      }
      if (isBusyFlagActive()) {
        logger.log('PWA fallback: busy flag active, deferring update');
        return;
      }
      if (isHookAlive()) {
        logger.log('PWA fallback: hook is alive, deferring update');
        return;
      }
      logger.log('PWA fallback: triggering skipWaiting + reload');
      try {
        localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now()));
      } catch {
        // localStorage may be unavailable
      }
      void updateSW(true);
    },
    onOfflineReady() {
      // No-op: no mostramos toast de "listo offline".
    },
  });
}
