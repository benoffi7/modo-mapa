import type { OfflineAction, OfflineActionStatus } from '../types/offline';
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORE_NAME,
  OFFLINE_QUEUE_MAX_ITEMS,
  OFFLINE_QUEUE_MAX_AGE_MS,
} from '../constants/offline';

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notify() {
  for (const fn of listeners) fn();
}

let dbInstance: IDBDatabase | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        const store = db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

/** Enqueue with atomic count+put in a single readwrite transaction */
export async function enqueue(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount' | 'status'>,
): Promise<OfflineAction> {
  const db = await openDb();

  const fullAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result >= OFFLINE_QUEUE_MAX_ITEMS) {
        tx.abort();
        reject(new Error('Cola de acciones offline llena'));
        return;
      }
      store.put(fullAction);
    };
    tx.oncomplete = () => { notify(); resolve(fullAction); };
    tx.onerror = () => {
      if (tx.error?.name !== 'AbortError') reject(tx.error);
    };
  });
}

export async function getAll(): Promise<OfflineAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
    const index = tx.objectStore(OFFLINE_STORE_NAME).index('createdAt');
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPending(): Promise<OfflineAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
    const index = tx.objectStore(OFFLINE_STORE_NAME).index('status');
    const request = index.getAll('pending');
    request.onsuccess = () => {
      const actions = request.result as OfflineAction[];
      actions.sort((a, b) => a.createdAt - b.createdAt);
      resolve(actions);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateStatus(
  id: string,
  status: OfflineActionStatus,
  retryCount?: number,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const action = getReq.result as OfflineAction | undefined;
      if (!action) { resolve(); return; }
      action.status = status;
      if (retryCount !== undefined) action.retryCount = retryCount;
      store.put(action);
    };
    tx.oncomplete = () => { notify(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

/** Bulk update status for multiple actions in a single transaction */
export async function bulkUpdateStatus(
  ids: string[],
  status: OfflineActionStatus,
  retryCount?: number,
): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE_NAME);
    for (const id of ids) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const action = getReq.result as OfflineAction | undefined;
        if (!action) return;
        action.status = status;
        if (retryCount !== undefined) action.retryCount = retryCount;
        store.put(action);
      };
    }
    tx.oncomplete = () => { notify(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    tx.objectStore(OFFLINE_STORE_NAME).delete(id);
    tx.oncomplete = () => { notify(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function cleanup(): Promise<number> {
  const db = await openDb();
  const all = await getAll();
  const cutoff = Date.now() - OFFLINE_QUEUE_MAX_AGE_MS;
  const toRemove = all.filter((a) => a.createdAt < cutoff);

  if (toRemove.length === 0) return 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE_NAME);
    for (const action of toRemove) {
      store.delete(action.id);
    }
    tx.oncomplete = () => { notify(); resolve(toRemove.length); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function count(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
    const request = tx.objectStore(OFFLINE_STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function subscribe(callback: Listener): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

/** Reset for testing — clears singleton db instance */
export const _resetForTest: (() => void) | undefined = import.meta.env.DEV
  ? () => {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
      listeners.clear();
    }
  : undefined;
