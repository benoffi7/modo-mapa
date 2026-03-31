import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn().mockResolvedValue({ data: { success: true } });

const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  getDoc: (ref: { id: string }) => mockGetDoc(ref),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../../../config/firebase', () => ({
  functions: {},
  db: {},
}));

vi.mock('../../../config/collections', () => ({
  COLLECTIONS: { CONFIG: 'config' },
}));

import { httpsCallable } from 'firebase/functions';
import {
  fetchConfigDocs,
  fetchConfigDoc,
  updateModerationBannedWords,
  fetchActivityFeedDiag,
  CONFIG_DOC_IDS,
} from '../config';

describe('admin/config service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchConfigDocs', () => {
    it('returns all existing docs', async () => {
      mockGetDoc.mockImplementation((ref: { id: string }) => {
        return Promise.resolve({
          exists: () => true,
          data: () => ({ key: `value_${ref.id}` }),
        });
      });

      const docs = await fetchConfigDocs();
      expect(docs).toHaveLength(CONFIG_DOC_IDS.length);
      expect(docs[0].id).toBe('counters');
      expect(docs[0].data).toEqual({ key: 'value_counters' });
    });

    it('omits missing docs', async () => {
      mockGetDoc.mockImplementation((ref: { id: string }) => {
        return Promise.resolve({
          exists: () => ref.id !== 'aggregates',
          data: () => ({ key: `value_${ref.id}` }),
        });
      });

      const docs = await fetchConfigDocs();
      expect(docs).toHaveLength(CONFIG_DOC_IDS.length - 1);
      expect(docs.find((d) => d.id === 'aggregates')).toBeUndefined();
    });
  });

  describe('fetchConfigDoc', () => {
    it('returns doc when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ bannedWords: ['test'] }),
      });

      const doc = await fetchConfigDoc('moderation');
      expect(doc).toEqual({
        id: 'moderation',
        data: { bannedWords: ['test'] },
      });
    });

    it('returns null when doc does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const doc = await fetchConfigDoc('missing');
      expect(doc).toBeNull();
    });
  });

  describe('updateModerationBannedWords', () => {
    it('calls httpsCallable with correct args', async () => {
      await updateModerationBannedWords(['word1', 'word2']);
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'updateModerationConfig');
      expect(mockCallable).toHaveBeenCalledWith({ bannedWords: ['word1', 'word2'] });
    });
  });

  describe('fetchActivityFeedDiag', () => {
    it('calls httpsCallable and returns data', async () => {
      const mockResponse = {
        items: [{ id: 'i1', type: 'rating', isExpired: false }],
        total: 1,
      };
      mockCallable.mockResolvedValueOnce({ data: mockResponse });

      const result = await fetchActivityFeedDiag('user123');
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'getActivityFeedDiag');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'user123' });
      expect(result).toEqual(mockResponse);
    });
  });
});
