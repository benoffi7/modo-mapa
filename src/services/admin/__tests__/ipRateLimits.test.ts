import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../../../config/firebase', () => ({
  functions: {},
}));

import { httpsCallable } from 'firebase/functions';
import { listAdminIpRateLimits, resetAdminIpRateLimit } from '../ipRateLimits';
import type { AdminIpRateLimitItem } from '../../../types/admin';

const sampleItem: AdminIpRateLimitItem = {
  docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10',
  ipHash: 'aaaaaaaaaaaaaaaa',
  action: 'anon_create',
  date: '2026-06-10',
  count: 9,
  windowActive: true,
};

describe('admin/ipRateLimits service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAdminIpRateLimits', () => {
    it('calls httpsCallable with adminListIpRateLimits name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminIpRateLimits();
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'adminListIpRateLimits');
    });

    it('passes empty request when no params', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminIpRateLimits();
      expect(mockCallable).toHaveBeenCalledWith({});
    });

    it('passes action when provided', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminIpRateLimits({ action: 'anon_create' });
      expect(mockCallable).toHaveBeenCalledWith({ action: 'anon_create' });
    });

    it('passes ipHash when provided', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminIpRateLimits({ ipHash: 'aaaaaaaaaaaaaaaa' });
      expect(mockCallable).toHaveBeenCalledWith({ ipHash: 'aaaaaaaaaaaaaaaa' });
    });

    it('passes all params when provided', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [] } });
      await listAdminIpRateLimits({ action: 'anon_create', ipHash: 'aaaaaaaaaaaaaaaa', limit: 10 });
      expect(mockCallable).toHaveBeenCalledWith({
        action: 'anon_create',
        ipHash: 'aaaaaaaaaaaaaaaa',
        limit: 10,
      });
    });

    it('returns items array directly', async () => {
      mockCallable.mockResolvedValueOnce({ data: { items: [sampleItem] } });
      const result = await listAdminIpRateLimits();
      expect(result).toEqual([sampleItem]);
    });

    it('propagates errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('permission-denied'));
      await expect(listAdminIpRateLimits()).rejects.toThrow('permission-denied');
    });
  });

  describe('resetAdminIpRateLimit', () => {
    it('calls httpsCallable with adminResetIpRateLimit name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await resetAdminIpRateLimit('docId-1');
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'adminResetIpRateLimit');
    });

    it('passes docId in request', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await resetAdminIpRateLimit('aaaaaaaaaaaaaaaa_anon_create_2026-06-10');
      expect(mockCallable).toHaveBeenCalledWith({ docId: 'aaaaaaaaaaaaaaaa_anon_create_2026-06-10' });
    });

    it('propagates not-found error', async () => {
      const err = Object.assign(new Error('not-found'), { code: 'functions/not-found' });
      mockCallable.mockRejectedValueOnce(err);
      await expect(resetAdminIpRateLimit('docId-1')).rejects.toThrow('not-found');
    });

    it('propagates generic errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('unavailable'));
      await expect(resetAdminIpRateLimit('docId-1')).rejects.toThrow('unavailable');
    });
  });
});
