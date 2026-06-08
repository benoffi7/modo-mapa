import type { OfflineAction } from '../types/offline';
import * as offlineQueue from './offlineQueue';
import { OFFLINE_MAX_RETRIES } from '../constants/offline';
import { getOfflineHandler } from './offlineHandlerRegistry';
import { registerOfflineHandlers } from './registerOfflineHandlers';
import { assertNever } from '../utils/assertNever';

let syncing = false;

/**
 * Despacha una acción offline al handler registrado para su tipo (#335).
 *
 * Reemplaza el switch gigante por un lookup en el registry. La exhaustividad
 * COMPILE-TIME sobre `OfflineActionType` la garantiza el `Record` tipado en
 * `registerOfflineHandlers.ts`: agregar un tipo a la union sin handler rompe la
 * compilacion alli.
 *
 * Acá, si el lookup falla, estamos ante una acción con un `type` fuera de la
 * union conocida — datos corruptos o persistidos por un cliente de version
 * desconocida. `assertNever` lanza en runtime con un mensaje descriptivo. El
 * cast a `never` es deliberado: en este punto el valor NO pertenece al dominio
 * estatico de `OfflineActionType`, asi que lo tratamos como el caso imposible.
 */
export async function dispatch(action: OfflineAction): Promise<void> {
  registerOfflineHandlers();
  const handler = getOfflineHandler(action.type);
  if (!handler) {
    assertNever(action.type as never, 'offline action type');
  }
  await handler(action);
}

/**
 * Alias backward-compatible de {@link dispatch}. Consumidores y tests existentes
 * siguen llamando `executeAction(action)` — COMPORTAMIENTO IDENTICO.
 */
export const executeAction = dispatch;

export async function processQueue(
  onActionSynced: (action: OfflineAction) => void,
  onActionFailed: (action: OfflineAction, error: Error) => void,
  onComplete: (syncedCount: number, failedCount: number) => void,
): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    await offlineQueue.cleanup();
    const pending = await offlineQueue.getPending();

    let syncedCount = 0;
    let failedCount = 0;
    const deferred: OfflineAction[] = [];

    for (const action of pending) {
      await offlineQueue.updateStatus(action.id, 'syncing');

      try {
        await executeAction(action);
        await offlineQueue.remove(action.id);
        syncedCount++;
        onActionSynced(action);
      } catch (err) {
        const newRetry = action.retryCount + 1;
        if (newRetry >= OFFLINE_MAX_RETRIES) {
          await offlineQueue.updateStatus(action.id, 'failed', newRetry);
          failedCount++;
          onActionFailed(action, err instanceof Error ? err : new Error(String(err)));
        } else {
          await offlineQueue.updateStatus(action.id, 'pending', newRetry);
          deferred.push(action);
        }
      }
    }

    onComplete(syncedCount, failedCount);
  } finally {
    syncing = false;
  }
}

/** Reset for testing */
export function _resetSyncingForTest(): void {
  syncing = false;
}
