import { useEffect, useRef, useState } from 'react';
import { isUpdateRequired } from '../utils/version';
import { fetchAppVersionConfig } from '../services/config';
import { logger } from '../utils/logger';
import { trackEvent } from '../utils/analytics';
import { FORCE_UPDATE_CHECK_INTERVAL_MS, FORCE_UPDATE_EVENT_DEBOUNCE_MS, MAX_FORCE_UPDATE_RELOADS } from '../constants/timing';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
  STORAGE_KEY_FORCE_UPDATE_LAST_CHECK,
  STORAGE_KEY_APP_VERSION_EVENT_EMITTED,
} from '../constants/storage';
import { EVT_FORCE_UPDATE_TRIGGERED, EVT_FORCE_UPDATE_LIMIT_REACHED } from '../constants/analyticsEvents';
import { EVT_APP_VERSION_ACTIVE } from '../constants/analyticsEvents/system';
import { isBusyFlagActive } from '../utils/busyFlag';
import {
  isCooldownActive,
  getReloadCount,
  incrementReloadCount,
  isReloadLimitReached,
} from '../utils/forceUpdate';

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


type CheckVersionStatus = 'reloading' | 'limit-reached' | 'up-to-date' | 'error';
type CheckVersionSource = 'server' | 'server-retry' | 'cache' | 'empty' | 'unknown';

interface CheckVersionResult {
  status: CheckVersionStatus;
  minVersion: string | undefined;
  source: CheckVersionSource;
}

function writeLastCheck(): void {
  try {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK, String(Date.now()));
  } catch {
    // localStorage may be unavailable
  }
}

async function checkVersion(): Promise<CheckVersionResult> {
  try {
    const { minVersion, source } = await fetchAppVersionConfig();

    if (!minVersion) {
      writeLastCheck();
      return { status: 'up-to-date', minVersion: undefined, source };
    }

    if (isUpdateRequired(minVersion, __APP_VERSION__)) {
      if (isBusyFlagActive()) {
        logger.log('Force update deferred: busy flag active');
        writeLastCheck();
        return { status: 'up-to-date', minVersion, source };
      }

      if (isCooldownActive()) {
        logger.warn(`Force update cooldown active, skipping refresh (${__APP_VERSION__} → ${minVersion})`);
        writeLastCheck();
        return { status: 'up-to-date', minVersion, source };
      }

      if (isReloadLimitReached()) {
        const { count } = getReloadCount();
        logger.warn(`Force update reload limit reached (${count}/${MAX_FORCE_UPDATE_RELOADS}), showing banner`);
        trackEvent(EVT_FORCE_UPDATE_LIMIT_REACHED, {
          from: __APP_VERSION__,
          to: minVersion,
          reloadCount: count,
        });
        writeLastCheck();
        return { status: 'limit-reached', minVersion, source };
      }

      logger.log(`Force update: ${__APP_VERSION__} → ${minVersion}`);
      trackEvent(EVT_FORCE_UPDATE_TRIGGERED, { from: __APP_VERSION__, to: minVersion });

      try {
        localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now()));
      } catch {
        // localStorage may be unavailable
      }

      incrementReloadCount();
      writeLastCheck();
      await performHardRefresh();
      return { status: 'reloading', minVersion, source };
    }

    writeLastCheck();
    return { status: 'up-to-date', minVersion, source };
  } catch {
    // Offline or Firestore error — fail silently
    writeLastCheck();
    return { status: 'error', minVersion: undefined, source: 'unknown' };
  }
}

/** @internal Exported for testing only */
export const _checkVersion = checkVersion;
/** @internal Exported for testing only */
export { getReloadCount as _getReloadCount } from '../utils/forceUpdate';
/** @internal Exported for testing only */
export { isReloadLimitReached as _isReloadLimitReached } from '../utils/forceUpdate';

export function useForceUpdate(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const checkingRef = useRef<boolean>(false);
  const lastVisibilityTs = useRef<number>(0);
  const lastOnlineTs = useRef<number>(0);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    async function run() {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const { status, minVersion, source } = await checkVersion();
        if (status === 'limit-reached') setUpdateAvailable(true);

        // Emitir app_version_active solo desde server/server-retry/empty, nunca cache
        if (
          status !== 'error' &&
          (source === 'server' || source === 'server-retry' || source === 'empty') &&
          !sessionStorage.getItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED)
        ) {
          trackEvent(EVT_APP_VERSION_ACTIVE, {
            version: __APP_VERSION__,
            minVersionSeen: minVersion ?? '',
            gap: minVersion ? isUpdateRequired(minVersion, __APP_VERSION__) : false,
            source,
          });
          try {
            sessionStorage.setItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED, '1');
          } catch {
            // sessionStorage may be unavailable
          }
        }
      } finally {
        checkingRef.current = false;
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastVisibilityTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
      lastVisibilityTs.current = Date.now();
      void run();
    };

    const handleOnline = () => {
      if (Date.now() - lastOnlineTs.current < FORCE_UPDATE_EVENT_DEBOUNCE_MS) return;
      lastOnlineTs.current = Date.now();
      void run();
    };

    void run();
    const id = setInterval(() => void run(), FORCE_UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return { updateAvailable };
}
