import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../../../config/firebase', () => ({
  functions: {},
}));

import { httpsCallable } from 'firebase/functions';
import { listBackups, createBackup, restoreBackup, deleteBackup } from '../backups';

const mockBackup = { id: 'backup-1', createdAt: '2026-03-31T00:00:00Z' };

describe('admin/backups service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listBackups', () => {
    it('calls httpsCallable with correct function name', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { backups: [mockBackup], nextPageToken: null, totalCount: 1 },
      });
      await listBackups(10);
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'listBackups');
    });

    it('passes pageSize in request', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { backups: [], nextPageToken: null, totalCount: 0 },
      });
      await listBackups(20);
      expect(mockCallable).toHaveBeenCalledWith({ pageSize: 20 });
    });

    it('passes pageToken when provided', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { backups: [], nextPageToken: null, totalCount: 0 },
      });
      await listBackups(10, 'token-abc');
      expect(mockCallable).toHaveBeenCalledWith({ pageSize: 10, pageToken: 'token-abc' });
    });

    it('returns response.data directly', async () => {
      const responseData = { backups: [mockBackup], nextPageToken: 'next-token', totalCount: 5 };
      mockCallable.mockResolvedValueOnce({ data: responseData });
      const result = await listBackups(10);
      expect(result).toEqual(responseData);
    });

    it('propagates errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Permission denied'));
      await expect(listBackups(10)).rejects.toThrow('Permission denied');
    });
  });

  describe('createBackup', () => {
    it('calls httpsCallable with correct function name', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { id: 'backup-new', createdAt: '2026-03-31T12:00:00Z' },
      });
      await createBackup();
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'createBackup');
    });

    it('calls callable with empty object', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { id: 'backup-new', createdAt: '2026-03-31T12:00:00Z' },
      });
      await createBackup();
      expect(mockCallable).toHaveBeenCalledWith({});
    });

    it('returns response.data', async () => {
      const responseData = { id: 'backup-new', createdAt: '2026-03-31T12:00:00Z' };
      mockCallable.mockResolvedValueOnce({ data: responseData });
      const result = await createBackup();
      expect(result).toEqual(responseData);
    });

    it('propagates errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Quota exceeded'));
      await expect(createBackup()).rejects.toThrow('Quota exceeded');
    });
  });

  describe('restoreBackup', () => {
    it('calls httpsCallable with correct function name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await restoreBackup('backup-1');
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'restoreBackup');
    });

    it('calls callable with backupId', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await restoreBackup('backup-1');
      expect(mockCallable).toHaveBeenCalledWith({ backupId: 'backup-1' });
    });

    it('propagates errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Not found'));
      await expect(restoreBackup('backup-1')).rejects.toThrow('Not found');
    });
  });

  describe('deleteBackup', () => {
    it('calls httpsCallable with correct function name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await deleteBackup('backup-1');
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteBackup');
    });

    it('calls callable with backupId', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });
      await deleteBackup('backup-1');
      expect(mockCallable).toHaveBeenCalledWith({ backupId: 'backup-1' });
    });

    it('propagates errors', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Forbidden'));
      await expect(deleteBackup('backup-1')).rejects.toThrow('Forbidden');
    });
  });
});
