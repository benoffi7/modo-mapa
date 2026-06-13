import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../../../config/firebase', () => ({
  functions: {},
}));

import { httpsCallable } from 'firebase/functions';
import { adminDeleteListItem } from '../listItems';

describe('admin/listItems service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('adminDeleteListItem', () => {
    it('calls httpsCallable with adminDeleteListItem name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await adminDeleteListItem('item-1');
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'adminDeleteListItem');
    });

    it('passes itemId in request', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await adminDeleteListItem('list1__biz1');
      expect(mockCallable).toHaveBeenCalledWith({ itemId: 'list1__biz1' });
    });

    it('propagates not-found error', async () => {
      const err = Object.assign(new Error('not-found'), { code: 'functions/not-found' });
      mockCallable.mockRejectedValueOnce(err);
      await expect(adminDeleteListItem('item-1')).rejects.toThrow('not-found');
    });

    it('propagates generic errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('unavailable'));
      await expect(adminDeleteListItem('item-1')).rejects.toThrow('unavailable');
    });
  });
});
