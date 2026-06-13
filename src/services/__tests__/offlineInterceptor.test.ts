import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnqueue = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('../offlineQueue', () => ({
  enqueue: (...a: unknown[]) => mockEnqueue(...a),
}));
vi.mock('../../utils/analytics', () => ({
  trackEvent: (...a: unknown[]) => mockTrackEvent(...a),
}));
vi.mock('../../constants/analyticsEvents', () => ({
  EVT_OFFLINE_ACTION_QUEUED: 'offline_action_queued',
}));

import { withOfflineSupport, OFFLINE_ENQUEUED_MSG } from '../offlineInterceptor';

describe('withOfflineSupport — custom tags (#344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueue.mockResolvedValue(undefined);
  });

  it('online: runs the action, does not enqueue', async () => {
    const onlineAction = vi.fn().mockResolvedValue('ok');
    const res = await withOfflineSupport(
      false, 'custom_tag_create',
      { userId: 'u1', businessId: 'biz_1', referenceId: 'tag-1' },
      { label: 'Wifi' },
      onlineAction,
    );
    expect(res).toBe('ok');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('offline custom_tag_create: enqueues with referenceId, tracks the queued event, shows toast', async () => {
    const onlineAction = vi.fn();
    const toast = { info: vi.fn() };
    await withOfflineSupport(
      true, 'custom_tag_create',
      { userId: 'u1', businessId: 'biz_1', businessName: 'Cafe', referenceId: 'tag-1' },
      { label: 'Wifi' },
      onlineAction,
      toast,
    );
    expect(onlineAction).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith({
      type: 'custom_tag_create',
      payload: { label: 'Wifi' },
      userId: 'u1',
      businessId: 'biz_1',
      businessName: 'Cafe',
      referenceId: 'tag-1',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('offline_action_queued', {
      action_type: 'custom_tag_create',
      business_id: 'biz_1',
    });
    expect(toast.info).toHaveBeenCalledWith(OFFLINE_ENQUEUED_MSG);
  });

  it('offline custom_tag_update: carries referenceId (tagId) in the enqueued action', async () => {
    await withOfflineSupport(
      true, 'custom_tag_update',
      { userId: 'u1', businessId: 'biz_1', referenceId: 'tag-9' },
      { label: 'Edited' },
      vi.fn(),
    );
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: 'custom_tag_update',
      referenceId: 'tag-9',
      payload: { label: 'Edited' },
    }));
    expect(mockTrackEvent).toHaveBeenCalledWith('offline_action_queued', expect.objectContaining({
      action_type: 'custom_tag_update',
    }));
  });

  it('offline custom_tag_delete: enqueues the marker payload with referenceId', async () => {
    await withOfflineSupport(
      true, 'custom_tag_delete',
      { userId: 'u1', businessId: 'biz_1', referenceId: 'tag-9' },
      { _type: 'custom_tag_delete' },
      vi.fn(),
    );
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: 'custom_tag_delete',
      referenceId: 'tag-9',
    }));
  });
});
