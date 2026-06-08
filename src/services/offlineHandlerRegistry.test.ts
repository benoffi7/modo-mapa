import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerOfflineHandler,
  getOfflineHandler,
  hasOfflineHandler,
  __resetOfflineHandlersForTests,
  type OfflineHandler,
} from './offlineHandlerRegistry';
import type { OfflineAction } from '../types/offline';

const noop: OfflineHandler = async () => {};

function makeAction(type: OfflineAction['type']): OfflineAction {
  return {
    id: 'a1',
    type,
    userId: 'u1',
    businessId: 'b1',
    payload: {},
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  } as unknown as OfflineAction;
}

describe('offlineHandlerRegistry (#335)', () => {
  beforeEach(() => {
    __resetOfflineHandlersForTests();
  });

  it('registers and retrieves a handler by type', () => {
    registerOfflineHandler('rating_upsert', noop);
    expect(hasOfflineHandler('rating_upsert')).toBe(true);
    expect(getOfflineHandler('rating_upsert')).toBe(noop);
  });

  it('returns undefined and false for an unregistered type', () => {
    expect(getOfflineHandler('rating_upsert')).toBeUndefined();
    expect(hasOfflineHandler('rating_upsert')).toBe(false);
  });

  it('overwrites the handler when registered twice for the same type', () => {
    const first: OfflineHandler = vi.fn();
    const second: OfflineHandler = vi.fn();
    registerOfflineHandler('comment_create', first);
    registerOfflineHandler('comment_create', second);
    expect(getOfflineHandler('comment_create')).toBe(second);
  });

  it('dispatches to the registered handler with the action', async () => {
    const handler = vi.fn<OfflineHandler>().mockResolvedValue();
    registerOfflineHandler('favorite_add', handler);
    const action = makeAction('favorite_add');
    await getOfflineHandler('favorite_add')!(action);
    expect(handler).toHaveBeenCalledWith(action);
  });

  it('__resetOfflineHandlersForTests clears every registration', () => {
    registerOfflineHandler('rating_upsert', noop);
    registerOfflineHandler('comment_create', noop);
    __resetOfflineHandlersForTests();
    expect(hasOfflineHandler('rating_upsert')).toBe(false);
    expect(hasOfflineHandler('comment_create')).toBe(false);
  });
});
