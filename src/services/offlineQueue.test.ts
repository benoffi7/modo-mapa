import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openDb,
  enqueue,
  getAll,
  getPending,
  updateStatus,
  remove,
  cleanup,
  count,
  subscribe,
  _resetForTest,
} from './offlineQueue';
import type { OfflineAction } from '../types/offline';

function makeAction(overrides: Partial<Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount' | 'status'>> = {}) {
  return {
    type: 'rating_upsert' as const,
    payload: { userId: 'u1', businessId: 'b1', score: 4 },
    userId: 'u1',
    businessId: 'b1',
    ...overrides,
  };
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    _resetForTest();
    // Clear all IndexedDB databases
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  afterEach(() => {
    _resetForTest();
  });

  it('opens db and enqueues an action', async () => {
    const db = await openDb();
    expect(db).toBeDefined();

    const action = await enqueue(makeAction());
    expect(action.id).toBeTruthy();
    expect(action.status).toBe('pending');
    expect(action.retryCount).toBe(0);
    expect(action.createdAt).toBeGreaterThan(0);
  });

  it('getAll returns actions in FIFO order', async () => {
    // Use manual timestamps to guarantee order (Date.now() can be same in fast execution)
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now++);

    await enqueue(makeAction({ businessId: 'b1' }));
    await enqueue(makeAction({ businessId: 'b2' }));
    await enqueue(makeAction({ businessId: 'b3' }));

    vi.restoreAllMocks();

    const all = await getAll();
    expect(all).toHaveLength(3);
    expect(all[0].businessId).toBe('b1');
    expect(all[2].businessId).toBe('b3');
  });

  it('getPending filters by status', async () => {
    const a1 = await enqueue(makeAction({ businessId: 'b1' }));
    await enqueue(makeAction({ businessId: 'b2' }));
    await updateStatus(a1.id, 'failed');

    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].businessId).toBe('b2');
  });

  it('updateStatus changes status and retryCount', async () => {
    const action = await enqueue(makeAction());
    await updateStatus(action.id, 'syncing', 1);

    const all = await getAll();
    expect(all[0].status).toBe('syncing');
    expect(all[0].retryCount).toBe(1);
  });

  it('remove deletes an action', async () => {
    const action = await enqueue(makeAction());
    expect(await count()).toBe(1);

    await remove(action.id);
    expect(await count()).toBe(0);
  });

  it('cleanup removes actions older than max age', async () => {
    // Enqueue and manually set old createdAt
    const action = await enqueue(makeAction());
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pendingActions', 'readwrite');
      const store = tx.objectStore('pendingActions');
      const getReq = store.get(action.id);
      getReq.onsuccess = () => {
        const data = getReq.result;
        data.createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
        store.put(data);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Also add a fresh one
    await enqueue(makeAction({ businessId: 'b2' }));

    const removed = await cleanup();
    expect(removed).toBe(1);
    expect(await count()).toBe(1);
  });

  it('rejects enqueue when queue is full', async () => {
    // Fill the queue to max
    for (let i = 0; i < 50; i++) {
      await enqueue(makeAction({ businessId: `b${i}` }));
    }

    await expect(enqueue(makeAction({ businessId: 'overflow' }))).rejects.toThrow(
      'Cola de acciones offline llena',
    );
  });

  it('count returns the total', async () => {
    expect(await count()).toBe(0);
    await enqueue(makeAction());
    await enqueue(makeAction({ businessId: 'b2' }));
    expect(await count()).toBe(2);
  });

  it('updateStatus on non-existent action resolves silently', async () => {
    await updateStatus('non-existent-id', 'failed');
    // Should not throw
    expect(await count()).toBe(0);
  });

  it('cleanup returns 0 when nothing to clean', async () => {
    await enqueue(makeAction()); // fresh action, not stale
    const removed = await cleanup();
    expect(removed).toBe(0);
    expect(await count()).toBe(1);
  });

  it('subscribe notifies on mutations', async () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);

    await enqueue(makeAction());
    expect(cb).toHaveBeenCalledTimes(1);

    const action = await enqueue(makeAction({ businessId: 'b2' }));
    expect(cb).toHaveBeenCalledTimes(2);

    await remove(action.id);
    expect(cb).toHaveBeenCalledTimes(3);

    unsub();
    await enqueue(makeAction({ businessId: 'b3' }));
    expect(cb).toHaveBeenCalledTimes(3); // no more calls after unsub
  });
});
