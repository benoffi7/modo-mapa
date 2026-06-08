import type { OfflineActionType, OfflineActionPayload } from '../types/offline';
import { enqueue } from './offlineQueue';
import { trackEvent } from '../utils/analytics';
import { EVT_OFFLINE_ACTION_QUEUED } from '../constants/analyticsEvents';

export const OFFLINE_ENQUEUED_MSG = 'Guardado offline — se sincronizará al reconectar';

export async function withOfflineSupport<T>(
  isOffline: boolean,
  actionType: OfflineActionType,
  actionMeta: {
    userId: string;
    businessId: string;
    businessName?: string | undefined;
    referenceId?: string | undefined;
    listId?: string | undefined;
  },
  payload: OfflineActionPayload,
  onlineAction: () => Promise<T>,
  toast?: { info: (msg: string) => void },
): Promise<T | void> {
  if (!isOffline) {
    return onlineAction();
  }

  const actionData: Parameters<typeof enqueue>[0] = {
    type: actionType,
    payload,
    userId: actionMeta.userId,
    businessId: actionMeta.businessId,
  };
  if (actionMeta.businessName) {
    actionData.businessName = actionMeta.businessName;
  }
  if (actionMeta.referenceId) {
    actionData.referenceId = actionMeta.referenceId;
  }
  if (actionMeta.listId) {
    actionData.listId = actionMeta.listId;
  }
  await enqueue(actionData);

  trackEvent(EVT_OFFLINE_ACTION_QUEUED, {
    action_type: actionType,
    business_id: actionMeta.businessId,
  });

  toast?.info(OFFLINE_ENQUEUED_MSG);
}

/**
 * Gate offline a nivel service (defense-in-depth, #335).
 *
 * Algunos mutators (`editComment`, `deleteComment`, `upsertCriteriaRating`,
 * `addFavorite`, `removeFavorite`) dependen de que el callsite wrapee con
 * {@link withOfflineSupport}. Si un callsite los llama directo estando offline,
 * el write fallaba silenciosamente. Este helper encola la acción cuando
 * `navigator.onLine` es `false`, reutilizando `withOfflineSupport` (NO duplica
 * la logica de enqueue/tracking).
 *
 * Invariante critica: NO re-encola durante el replay del `syncEngine`. El replay
 * solo corre cuando estamos online (`processQueue` se dispara en el evento
 * `online`), por lo que `navigator.onLine === true` y el gate pasa derecho a
 * `onlineAction()`. Mismo criterio que `getCountOfflineSafe`, que lee
 * `navigator.onLine` directamente desde la capa de service.
 *
 * El callsite que YA wrapea con `withOfflineSupport` no produce doble-enqueue:
 * estando offline, su wrapper corta antes y nunca invoca el service, asi que
 * este gate no llega a ejecutarse.
 *
 * @param actionType Tipo de acción offline a encolar si estamos offline.
 * @param actionMeta Metadata de la acción (userId/businessId/etc.).
 * @param payload Payload tipado de la acción (para el replay).
 * @param onlineAction Función que ejecuta el write real contra Firestore.
 */
export async function gateServiceWrite<T>(
  actionType: OfflineActionType,
  actionMeta: {
    userId: string;
    businessId: string;
    businessName?: string | undefined;
    referenceId?: string | undefined;
    listId?: string | undefined;
  },
  payload: OfflineActionPayload,
  onlineAction: () => Promise<T>,
): Promise<T | void> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  return withOfflineSupport(isOffline, actionType, actionMeta, payload, onlineAction);
}
