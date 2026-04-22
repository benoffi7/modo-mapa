import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { withOfflineSupport, OFFLINE_ENQUEUED_MSG } from './offlineInterceptor';
import * as offlineQueue from './offlineQueue';

vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockToast = { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() };

describe('offlineInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('online: calls onlineAction and returns result', async () => {
    const onlineAction = vi.fn().mockResolvedValue('result');

    const result = await withOfflineSupport(
      false, 'rating_upsert',
      { userId: 'u1', businessId: 'b1' },
      { score: 4 },
      onlineAction,
      mockToast,
    );

    expect(result).toBe('result');
    expect(onlineAction).toHaveBeenCalled();
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it('offline: enqueues action and shows toast', async () => {
    const enqueueSpy = vi.spyOn(offlineQueue, 'enqueue').mockResolvedValue({
      id: 'test',
      type: 'rating_upsert',
      payload: { score: 4 },
      userId: 'u1',
      businessId: 'b1',
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    });
    const onlineAction = vi.fn();

    await withOfflineSupport(
      true, 'rating_upsert',
      { userId: 'u1', businessId: 'b1', businessName: 'Test' },
      { score: 4 },
      onlineAction,
      mockToast,
    );

    expect(onlineAction).not.toHaveBeenCalled();
    expect(enqueueSpy).toHaveBeenCalledWith({
      type: 'rating_upsert',
      payload: { score: 4 },
      userId: 'u1',
      businessId: 'b1',
      businessName: 'Test',
    });
    expect(mockToast.info).toHaveBeenCalledWith(OFFLINE_ENQUEUED_MSG);
  });

  it('offline: propagates enqueue errors', async () => {
    vi.spyOn(offlineQueue, 'enqueue').mockRejectedValue(new Error('Queue full'));

    await expect(
      withOfflineSupport(
        true, 'rating_upsert',
        { userId: 'u1', businessId: 'b1' },
        { score: 4 },
        vi.fn(),
        mockToast,
      ),
    ).rejects.toThrow('Queue full');

    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it('offline: propagates listId in actionMeta to enqueued action', async () => {
    const enqueueSpy = vi.spyOn(offlineQueue, 'enqueue').mockResolvedValue({
      id: 'test',
      type: 'list_create',
      payload: { name: 'Lista', description: '' },
      userId: 'u1',
      businessId: 'list-client-id',
      listId: 'list-client-id',
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    });

    await withOfflineSupport(
      true, 'list_create',
      { userId: 'u1', businessId: 'list-client-id', listId: 'list-client-id' },
      { name: 'Lista', description: '' },
      vi.fn(),
      mockToast,
    );

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ listId: 'list-client-id' }),
    );
  });

  it('offline: does not include listId when not in actionMeta', async () => {
    const enqueueSpy = vi.spyOn(offlineQueue, 'enqueue').mockResolvedValue({
      id: 'test',
      type: 'rating_upsert',
      payload: { score: 3 },
      userId: 'u1',
      businessId: 'b1',
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    });

    await withOfflineSupport(
      true, 'rating_upsert',
      { userId: 'u1', businessId: 'b1' },
      { score: 3 },
      vi.fn(),
    );

    const calledWith = enqueueSpy.mock.calls[0][0];
    expect(calledWith).not.toHaveProperty('listId');
  });
});
