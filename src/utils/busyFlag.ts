import { BUSY_FLAG_MAX_AGE_MS, BUSY_FLAG_HEARTBEAT_MS } from '../constants/timing';
import { STORAGE_KEY_FORCE_UPDATE_BUSY } from '../constants/storage';
import { logger } from './logger';

interface BusyFlag {
  startedAt: number;
  kind: string;
  count: number;
}

/**
 * Envuelve una operacion critica (upload, submit) y expone el flag en sessionStorage
 * para que useForceUpdate no recargue la app a mitad de camino.
 *
 * Concurrency: si ya hay un flag activo llega una segunda operación, incrementa
 * el refcount. El flag se limpia solo cuando count llega a 0.
 *
 * Heartbeat: el callback que recibe `fn` solo refresca `startedAt` si
 * `document.visibilityState === 'visible'`. Si el tab está oculto, el heartbeat
 * es no-op y el flag expira en BUSY_FLAG_MAX_AGE_MS (3 min).
 *
 * AbortSignal: si `fn` lanza por AbortError, el `finally` libera el flag igual.
 */
export async function withBusyFlag<T>(
  kind: string,
  fn: (heartbeat: () => void) => Promise<T>,
): Promise<T> {
  incrementBusyFlag(kind);
  try {
    return await fn(() => refreshBusyFlagIfVisible(kind));
  } finally {
    decrementBusyFlag();
  }
}

export function isBusyFlagActive(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<BusyFlag>;
    if (typeof parsed.startedAt !== 'number') return false;
    if (typeof parsed.count !== 'number' || parsed.count <= 0) return false;
    if (Date.now() - parsed.startedAt > BUSY_FLAG_MAX_AGE_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function readFlag(): BusyFlag | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BusyFlag>;
    if (typeof parsed.startedAt !== 'number' || typeof parsed.count !== 'number') return null;
    return { startedAt: parsed.startedAt, kind: parsed.kind ?? '', count: parsed.count };
  } catch {
    return null;
  }
}

function writeFlag(flag: BusyFlag): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_FORCE_UPDATE_BUSY, JSON.stringify(flag));
  } catch (e) {
    logger.warn('busyFlag: setItem failed', e);
  }
}

function incrementBusyFlag(kind: string): void {
  const current = readFlag();
  if (current && current.count > 0 && Date.now() - current.startedAt <= BUSY_FLAG_MAX_AGE_MS) {
    writeFlag({ startedAt: Date.now(), kind: current.kind, count: current.count + 1 });
  } else {
    writeFlag({ startedAt: Date.now(), kind, count: 1 });
  }
}

function decrementBusyFlag(): void {
  const current = readFlag();
  if (!current) return;
  const nextCount = current.count - 1;
  if (nextCount <= 0) {
    try {
      sessionStorage.removeItem(STORAGE_KEY_FORCE_UPDATE_BUSY);
    } catch {
      // sessionStorage may be unavailable
    }
  } else {
    writeFlag({ ...current, count: nextCount });
  }
}

function refreshBusyFlagIfVisible(kind: string): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  const current = readFlag();
  if (!current || current.count <= 0) return;
  writeFlag({ ...current, startedAt: Date.now(), kind: current.kind || kind });
}

/** @internal Para tests */
export const _writeBusyFlag = writeFlag;
export const _readBusyFlag = readFlag;

export const BUSY_FLAG_HEARTBEAT_INTERVAL_MS = BUSY_FLAG_HEARTBEAT_MS;
