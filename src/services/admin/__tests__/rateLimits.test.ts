import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../../../config/firebase', () => ({
  functions: {},
}));

import { httpsCallable } from 'firebase/functions';
import { listAdminRateLimits, resetAdminRateLimit } from '../rateLimits';
import type { AdminRateLimitItem } from '../../../types/admin';

const sampleItem: AdminRateLimitItem = {
  docId: 'comments_abc123',
  category: 'comments',
  userId: 'abc123',
  count: 5,
  resetAt: Date.now() + 60_000,
  windowActive: true,
};

describe('admin/rateLimits service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAdminRateLimits', () => {
    it('calls httpsCallable with adminListRateLimits name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminRateLimits();
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'adminListRateLimits');
    });

    it('passes empty request when no params', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminRateLimits();
      expect(mockCallable).toHaveBeenCalledWith({});
    });

    it('passes userId when provided', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminRateLimits({ userId: 'uid-1' });
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'uid-1' });
    });

    it('passes limit when provided', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminRateLimits({ limit: 25 });
      expect(mockCallable).toHaveBeenCalledWith({ limit: 25 });
    });

    it('passes both userId and limit when provided', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminRateLimits({ userId: 'uid-1', limit: 10 });
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'uid-1', limit: 10 });
    });

    it('returns items array directly', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [sampleItem] } });
      const result = await listAdminRateLimits();
      expect(result).toEqual([sampleItem]);
    });

    it('propagates errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('permission-denied'));
      await expect(listAdminRateLimits()).rejects.toThrow('permission-denied');
    });
  });

  describe('resetAdminRateLimit', () => {
    it('calls httpsCallable with adminResetRateLimit name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await resetAdminRateLimit('docId-1');
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'adminResetRateLimit');
    });

    it('passes docId in request', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await resetAdminRateLimit('comments_abc123');
      expect(mockCallable).toHaveBeenCalledWith({ docId: 'comments_abc123' });
    });

    it('propagates not-found error', async () => {
      const err = Object.assign(new Error('not-found'), { code: 'functions/not-found' });
      mockCallable.mockRejectedValueOnce(err);
      await expect(resetAdminRateLimit('docId-1')).rejects.toThrow('not-found');
    });

    it('propagates generic errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('unavailable'));
      await expect(resetAdminRateLimit('docId-1')).rejects.toThrow('unavailable');
    });
  });
});
