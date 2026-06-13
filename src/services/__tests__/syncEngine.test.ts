import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OfflineAction } from '../../types/offline';

const mockCreateCustomTag = vi.fn();
const mockUpdateCustomTag = vi.fn();
const mockDeleteCustomTag = vi.fn();

vi.mock('../tags', () => ({
  createCustomTag: (...a: unknown[]) => mockCreateCustomTag(...a),
  updateCustomTag: (...a: unknown[]) => mockUpdateCustomTag(...a),
  deleteCustomTag: (...a: unknown[]) => mockDeleteCustomTag(...a),
}));

// In-memory offlineQueue stub: getPending returns a FIFO-ordered queue.
let queue: OfflineAction[] = [];
const removed: string[] = [];
const statusUpdates: Array<{ id: string; status: string; retry?: number }> = [];

vi.mock('../offlineQueue', () => ({
  cleanup: vi.fn().mockResolvedValue(0),
  getPending: vi.fn(async () => [...queue].sort((a, b) => a.createdAt - b.createdAt)),
  updateStatus: vi.fn(async (id: string, status: string, retry?: number) => {
    statusUpdates.push({ id, status, ...(retry !== undefined ? { retry } : {}) });
  }),
  remove: vi.fn(async (id: string) => { removed.push(id); }),
}));

import { processQueue, _resetSyncingForTest, executeAction } from '../syncEngine';

function action(over: Partial<OfflineAction>): OfflineAction {
  return {
    id: 'x',
    type: 'custom_tag_create',
    payload: { label: 'l' },
    userId: 'u1',
    businessId: 'biz_1',
    createdAt: 0,
    retryCount: 0,
    status: 'pending',
    ...over,
  };
}

describe('syncEngine replay — custom tags (#344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue = [];
    removed.length = 0;
    statusUpdates.length = 0;
    _resetSyncingForTest();
    mockCreateCustomTag.mockResolvedValue(undefined);
    mockUpdateCustomTag.mockResolvedValue(undefined);
    mockDeleteCustomTag.mockResolvedValue(undefined);
  });

  it('create+update of the same tag offline drains FIFO: create first, then update with the same tagId', async () => {
    queue = [
      action({ id: 'c1', type: 'custom_tag_create', payload: { label: 'Wifi' }, referenceId: 'tag-1', createdAt: 1 }),
      action({ id: 'u1a', type: 'custom_tag_update', payload: { label: 'Wifi rápido' }, referenceId: 'tag-1', createdAt: 2 }),
    ];

    const synced: string[] = [];
    await processQueue(
      (a) => synced.push(a.id),
      () => {},
      () => {},
    );

    // both applied, in order
    expect(synced).toEqual(['c1', 'u1a']);
    expect(mockCreateCustomTag).toHaveBeenCalledWith('u1', 'biz_1', 'Wifi', 'tag-1');
    expect(mockUpdateCustomTag).toHaveBeenCalledWith('tag-1', 'Wifi rápido');
    // create order strictly before update
    const createOrder = mockCreateCustomTag.mock.invocationCallOrder[0];
    const updateOrder = mockUpdateCustomTag.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(updateOrder);
    expect(removed).toEqual(['c1', 'u1a']);
  });

  it('delete of a tag whose create failed permanently is a no-op (deleteDoc resolves) and does NOT retry', async () => {
    // Simulate: create already gone (failed permanently / never persisted); only delete remains.
    // deleteCustomTag resolves cleanly even if the doc does not exist (Firestore deleteDoc no-throw).
    queue = [
      action({ id: 'd1', type: 'custom_tag_delete', payload: { _type: 'custom_tag_delete' }, referenceId: 'tag-gone', createdAt: 1 }),
    ];

    const failed: OfflineAction[] = [];
    const synced: string[] = [];
    await processQueue(
      (a) => synced.push(a.id),
      (a) => failed.push(a),
      () => {},
    );

    expect(mockDeleteCustomTag).toHaveBeenCalledWith('tag-gone');
    expect(synced).toEqual(['d1']);
    expect(failed).toEqual([]); // executeAction did not throw → no retry → no permanent failure
    expect(removed).toEqual(['d1']);
  });

  it('executeAction dispatches custom_tag_create to createCustomTag', async () => {
    await executeAction(action({ type: 'custom_tag_create', payload: { label: 'X' }, referenceId: 'tag-7' }));
    expect(mockCreateCustomTag).toHaveBeenCalledWith('u1', 'biz_1', 'X', 'tag-7');
  });
});
