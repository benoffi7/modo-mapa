import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OfflineAction } from '../../types/offline';

const mockCreateCustomTag = vi.fn();
const mockUpdateCustomTag = vi.fn();
const mockDeleteCustomTag = vi.fn();

vi.mock('../tags', () => ({
  createCustomTag: (...args: unknown[]) => mockCreateCustomTag(...args),
  updateCustomTag: (...args: unknown[]) => mockUpdateCustomTag(...args),
  deleteCustomTag: (...args: unknown[]) => mockDeleteCustomTag(...args),
}));

import {
  registerOfflineHandlers,
  __resetRegisteredFlagForTests,
} from '../registerOfflineHandlers';
import {
  getOfflineHandler,
  hasOfflineHandler,
  __resetOfflineHandlersForTests,
} from '../offlineHandlerRegistry';

function runHandler(action: OfflineAction): Promise<void> {
  const handler = getOfflineHandler(action.type);
  if (!handler) throw new Error(`no handler for ${action.type}`);
  return handler(action);
}

function baseAction(over: Partial<OfflineAction>): OfflineAction {
  return {
    id: 'a1',
    type: 'custom_tag_create',
    payload: { label: 'x' },
    userId: 'u1',
    businessId: 'biz_1',
    createdAt: 1,
    retryCount: 0,
    status: 'pending',
    ...over,
  };
}

describe('registerOfflineHandlers — custom tags (#344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetOfflineHandlersForTests();
    __resetRegisteredFlagForTests();
    registerOfflineHandlers();
    mockCreateCustomTag.mockResolvedValue(undefined);
    mockUpdateCustomTag.mockResolvedValue(undefined);
    mockDeleteCustomTag.mockResolvedValue(undefined);
  });

  it('registers the 3 custom_tag handlers (exhaustiveness)', () => {
    expect(hasOfflineHandler('custom_tag_create')).toBe(true);
    expect(hasOfflineHandler('custom_tag_update')).toBe(true);
    expect(hasOfflineHandler('custom_tag_delete')).toBe(true);
  });

  it('custom_tag_create passes referenceId as the client-side tagId', async () => {
    await runHandler(baseAction({
      type: 'custom_tag_create',
      payload: { label: 'Pet friendly' },
      referenceId: 'tag-123',
    }));
    expect(mockCreateCustomTag).toHaveBeenCalledWith('u1', 'biz_1', 'Pet friendly', 'tag-123');
  });

  it('custom_tag_update invokes updateCustomTag with referenceId + label', async () => {
    await runHandler(baseAction({
      type: 'custom_tag_update',
      payload: { label: 'Edited' },
      referenceId: 'tag-123',
    }));
    expect(mockUpdateCustomTag).toHaveBeenCalledWith('tag-123', 'Edited');
  });

  it('custom_tag_update throws when referenceId is missing', async () => {
    await expect(
      runHandler(baseAction({ type: 'custom_tag_update', payload: { label: 'x' } })),
    ).rejects.toThrow('custom_tag_update requires referenceId');
    expect(mockUpdateCustomTag).not.toHaveBeenCalled();
  });

  it('custom_tag_delete invokes deleteCustomTag with referenceId', async () => {
    await runHandler(baseAction({
      type: 'custom_tag_delete',
      payload: { _type: 'custom_tag_delete' },
      referenceId: 'tag-123',
    }));
    expect(mockDeleteCustomTag).toHaveBeenCalledWith('tag-123');
  });

  it('custom_tag_delete throws when referenceId is missing', async () => {
    await expect(
      runHandler(baseAction({ type: 'custom_tag_delete', payload: { _type: 'custom_tag_delete' } })),
    ).rejects.toThrow('custom_tag_delete requires referenceId');
    expect(mockDeleteCustomTag).not.toHaveBeenCalled();
  });
});
