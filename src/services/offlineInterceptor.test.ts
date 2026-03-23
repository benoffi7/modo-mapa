import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { withOfflineSupport } from './offlineInterceptor';
import * as offlineQueue from './offlineQueue';

vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

describe('offlineInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('online: calls onlineAction and returns result', async () => {
    const onlineAction = vi.fn().mockResolvedValue('result');
    const onEnqueued = vi.fn();

    const result = await withOfflineSupport(
      false,
      'rating_upsert',
      { userId: 'u1', businessId: 'b1' },
      { userId: 'u1', businessId: 'b1', score: 4 },
      onlineAction,
      onEnqueued,
    );

    expect(result).toBe('result');
    expect(onlineAction).toHaveBeenCalled();
    expect(onEnqueued).not.toHaveBeenCalled();
  });

  it('offline: enqueues action and calls onEnqueued', async () => {
    const enqueueSpy = vi.spyOn(offlineQueue, 'enqueue').mockResolvedValue({
      id: 'test',
      type: 'rating_upsert',
      payload: { userId: 'u1', businessId: 'b1', score: 4 },
      userId: 'u1',
      businessId: 'b1',
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    });
    const onlineAction = vi.fn();
    const onEnqueued = vi.fn();

    await withOfflineSupport(
      true,
      'rating_upsert',
      { userId: 'u1', businessId: 'b1', businessName: 'Test' },
      { userId: 'u1', businessId: 'b1', score: 4 },
      onlineAction,
      onEnqueued,
    );

    expect(onlineAction).not.toHaveBeenCalled();
    expect(enqueueSpy).toHaveBeenCalledWith({
      type: 'rating_upsert',
      payload: { userId: 'u1', businessId: 'b1', score: 4 },
      userId: 'u1',
      businessId: 'b1',
      businessName: 'Test',
    });
    expect(onEnqueued).toHaveBeenCalled();
  });

  it('offline: propagates enqueue errors', async () => {
    vi.spyOn(offlineQueue, 'enqueue').mockRejectedValue(new Error('Queue full'));
    const onEnqueued = vi.fn();

    await expect(
      withOfflineSupport(
        true,
        'rating_upsert',
        { userId: 'u1', businessId: 'b1' },
        { userId: 'u1', businessId: 'b1', score: 4 },
        vi.fn(),
        onEnqueued,
      ),
    ).rejects.toThrow('Queue full');

    expect(onEnqueued).not.toHaveBeenCalled();
  });
});
