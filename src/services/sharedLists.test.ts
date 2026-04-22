import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {}, functions: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { SHARED_LISTS: 'sharedLists', LIST_ITEMS: 'listItems', USERS: 'users' },
}));
vi.mock('../config/converters', () => ({
  sharedListConverter: {},
  listItemConverter: {},
}));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../constants/lists', () => ({ MAX_LISTS: 10 }));

const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

const {
  mockGetDoc, mockGetDocs, mockSetDoc, mockAddDoc, mockUpdateDoc, mockDeleteDoc,
  mockBatchDelete, mockBatchCommit, mockTransactionSet,
} = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'new-list-id' }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
  mockTransactionSet: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  doc: vi.fn().mockReturnValue({ id: 'mock-generated-id', withConverter: vi.fn().mockReturnThis() }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
  increment: vi.fn((n: number) => ({ __increment: n })),
  writeBatch: vi.fn().mockReturnValue({ delete: mockBatchDelete, commit: mockBatchCommit }),
  runTransaction: vi.fn((_db: unknown, fn: (t: unknown) => Promise<unknown>) =>
    fn({ set: mockTransactionSet }),
  ),
}));

import {
  createList,
  generateListId,
  toggleListPublic,
  updateList,
  deleteList,
  addBusinessToList,
  removeBusinessFromList,
  fetchListItems,
  fetchSharedWithMe,
  fetchSharedList,
  fetchUserLists,
  fetchEditorName,
  fetchFeaturedLists,
  inviteEditor,
  removeEditor,
} from './sharedLists';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';

describe('sharedLists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateListId', () => {
    it('returns the id from doc() — no network call', () => {
      const id = generateListId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('createList', () => {
    it('creates a list and returns id', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'list1' });
      const id = await createList('u1', ' My List ', 'desc');
      expect(mockAddDoc).toHaveBeenCalled();
      expect(id).toBe('list1');
      expect(invalidateQueryCache).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('list_created', { list_id: 'list1' });
    });

    it('uses setDoc with explicit id when listId is provided', async () => {
      const id = await createList('u1', 'My List', 'desc', undefined, 'client-gen-id');
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(id).toBe('client-gen-id');
      expect(trackEvent).toHaveBeenCalledWith('list_created', { list_id: 'client-gen-id' });
    });

    it('returns the provided listId when using setDoc path', async () => {
      const result = await createList('u1', 'Test', '', undefined, 'fixed-id-123');
      expect(result).toBe('fixed-id-123');
    });
  });

  describe('toggleListPublic', () => {
    it('updates isPublic field', async () => {
      await toggleListPublic('list1', true);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('updateList', () => {
    it('updates name and description', async () => {
      await updateList('list1', 'New Name', 'New Desc');
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('deleteList', () => {
    it('deletes items then list in a batch', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { ref: { id: 'item1' } },
          { ref: { id: 'item2' } },
        ],
      });
      await deleteList('list1', 'u1');
      expect(mockBatchDelete).toHaveBeenCalledTimes(3); // 2 items + 1 list doc
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(invalidateQueryCache).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('list_deleted', { list_id: 'list1' });
    });

    it('deletes empty list in a batch', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      await deleteList('list1', 'u1');
      expect(mockBatchDelete).toHaveBeenCalledTimes(1); // just the list doc
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('addBusinessToList', () => {
    it('adds item and increments count', async () => {
      await addBusinessToList('list1', 'biz1', 'u1');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(trackEvent).toHaveBeenCalledWith('list_item_added', { list_id: 'list1', business_id: 'biz1' });
    });
  });

  describe('removeBusinessFromList', () => {
    it('removes item and decrements count', async () => {
      await removeBusinessFromList('list1', 'biz1');
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(trackEvent).toHaveBeenCalledWith('list_item_removed', { list_id: 'list1', business_id: 'biz1' });
    });
  });

  describe('fetchListItems', () => {
    it('returns mapped items', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ businessId: 'b1', listId: 'l1' }) },
          { data: () => ({ businessId: 'b2', listId: 'l1' }) },
        ],
      });
      const items = await fetchListItems('l1');
      expect(items).toHaveLength(2);
      expect(items[0].businessId).toBe('b1');
    });
  });

  describe('fetchSharedWithMe', () => {
    it('returns lists where user is editor', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'l1', ownerId: 'other', name: 'Shared' }) },
        ],
      });
      const result = await fetchSharedWithMe('u1');
      expect(result).toHaveLength(1);
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('fetchSharedList', () => {
    it('returns data when list exists', async () => {
      const listData = { id: 'l1', ownerId: 'u1', name: 'Test' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => listData });
      const result = await fetchSharedList('l1');
      expect(result).toEqual(listData);
    });

    it('returns null when list does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const result = await fetchSharedList('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('fetchUserLists', () => {
    it('returns user lists', async () => {
      const lists = [{ id: 'l1', name: 'A' }, { id: 'l2', name: 'B' }];
      mockGetDocs.mockResolvedValueOnce({ docs: lists.map((l) => ({ data: () => l })) });
      const result = await fetchUserLists('u1');
      expect(result).toEqual(lists);
    });
  });

  describe('fetchEditorName', () => {
    it('returns displayName when user exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ data: () => ({ displayName: 'Alice' }) });
      const result = await fetchEditorName('u1');
      expect(result).toBe('Alice');
    });

    it('returns "Usuario" when displayName is missing', async () => {
      mockGetDoc.mockResolvedValueOnce({ data: () => ({}) });
      const result = await fetchEditorName('u1');
      expect(result).toBe('Usuario');
    });

    it('returns "Usuario" on error', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('fail'));
      const result = await fetchEditorName('u1');
      expect(result).toBe('Usuario');
    });
  });

  describe('fetchFeaturedLists', () => {
    it('returns featured lists with defaults', async () => {
      const callFn = vi.fn().mockResolvedValueOnce({
        data: { lists: [{ id: 'f1', name: 'Featured', ownerId: 'admin' }] },
      });
      mockHttpsCallable.mockReturnValueOnce(callFn);
      const result = await fetchFeaturedLists();
      expect(result[0].editorIds).toEqual([]);
      expect(result[0].name).toBe('Featured');
    });
  });

  describe('inviteEditor', () => {
    it('calls httpsCallable with correct params', async () => {
      const callFn = vi.fn().mockResolvedValueOnce({ data: { success: true } });
      mockHttpsCallable.mockReturnValueOnce(callFn);
      await inviteEditor('l1', 'test@test.com');
      expect(callFn).toHaveBeenCalledWith(expect.objectContaining({ listId: 'l1', targetEmail: 'test@test.com' }));
    });
  });

  describe('removeEditor', () => {
    it('calls httpsCallable with correct params', async () => {
      const callFn = vi.fn().mockResolvedValueOnce({ data: { success: true } });
      mockHttpsCallable.mockReturnValueOnce(callFn);
      await removeEditor('l1', 'uid1');
      expect(callFn).toHaveBeenCalledWith(expect.objectContaining({ listId: 'l1', targetUid: 'uid1' }));
    });
  });
});
