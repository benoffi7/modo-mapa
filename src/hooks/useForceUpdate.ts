import { useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { isUpdateRequired } from '../utils/version';
import { logger } from '../utils/logger';
import { trackEvent } from '../utils/analytics';
import { FORCE_UPDATE_CHECK_INTERVAL_MS, FORCE_UPDATE_COOLDOWN_MS } from '../constants/timing';
import { SESSION_KEY_FORCE_UPDATE_LAST_REFRESH } from '../constants/storage';
import { EVT_FORCE_UPDATE_TRIGGERED } from '../constants/analyticsEvents';

async function performHardRefresh(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    if (registrations) {
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
    // SW API may not be available
  }

  try {
    const keys = await caches?.keys();
    if (keys) {
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Cache API may not be available
  }

  window.location.reload();
}

function isCooldownActive(): boolean {
  try {
    const last = sessionStorage.getItem(SESSION_KEY_FORCE_UPDATE_LAST_REFRESH);
    if (!last) return false;
    return Date.now() - Number(last) < FORCE_UPDATE_COOLDOWN_MS;
  } catch {
    return false;
  }
}

async function checkVersion(): Promise<void> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'));
    if (!snap.exists()) return;

    const { minVersion } = snap.data() as { minVersion?: string };
    if (!minVersion) return;

    if (isUpdateRequired(minVersion, __APP_VERSION__)) {
      if (isCooldownActive()) {
        logger.warn(`Force update cooldown active, skipping refresh (${__APP_VERSION__} → ${minVersion})`);
        return;
      }

      logger.log(`Force update: ${__APP_VERSION__} → ${minVersion}`);
      trackEvent(EVT_FORCE_UPDATE_TRIGGERED, { from: __APP_VERSION__, to: minVersion });

      try {
        sessionStorage.setItem(SESSION_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now()));
      } catch {
        // sessionStorage may be unavailable
      }

      await performHardRefresh();
    }
  } catch {
    // Offline or Firestore error — fail silently
  }
}

/** @internal Exported for testing only */
export const _checkVersion = checkVersion;

export function useForceUpdate(): void {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    checkVersion();
    const id = setInterval(checkVersion, FORCE_UPDATE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
