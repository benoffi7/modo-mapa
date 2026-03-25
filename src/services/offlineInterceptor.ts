import type { OfflineActionType, OfflineActionPayload } from '../types/offline';
import { enqueue } from './offlineQueue';
import { trackEvent } from '../utils/analytics';
import { EVT_OFFLINE_ACTION_QUEUED } from '../constants/analyticsEvents';

export const OFFLINE_ENQUEUED_MSG = 'Guardado offline — se sincronizará al reconectar';

export async function withOfflineSupport<T>(
  isOffline: boolean,
  actionType: OfflineActionType,
  actionMeta: { userId: string; businessId: string; businessName?: string | undefined; referenceId?: string | undefined },
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
  await enqueue(actionData);

  trackEvent(EVT_OFFLINE_ACTION_QUEUED, {
    action_type: actionType,
    business_id: actionMeta.businessId,
  });

  toast?.info(OFFLINE_ENQUEUED_MSG);
}
