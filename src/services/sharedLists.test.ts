import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { SHARED_LISTS: 'sharedLists', LIST_ITEMS: 'listItems' },
}));
vi.mock('../config/converters', () => ({
  sharedListConverter: {},
  listItemConverter: {},
}));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../constants/lists', () => ({ MAX_LISTS: 10 }));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-list-id' });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  doc: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
  increment: vi.fn((n: number) => ({ __increment: n })),
}));

import { copyList } from './sharedLists';

describe('copyList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when user has 10 lists already', async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 10 });
    await expect(copyList('source1', 'user1')).rejects.toThrow('Límite de 10 listas alcanzado');
  });

  it('throws when source list does not exist', async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 0 });
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(copyList('source1', 'user1')).rejects.toThrow('Lista no encontrada');
  });

  it('throws when source list is private and caller is not owner', async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 0 });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: 'other-user', isPublic: false, name: 'Test', description: '' }),
    });
    await expect(copyList('source1', 'user1')).rejects.toThrow('No se puede copiar una lista privada');
  });

  it('allows owner to copy their own private list', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ size: 0 }) // user list count
      .mockResolvedValueOnce({ docs: [] }); // fetchListItems
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: 'user1', isPublic: false, name: 'My List', description: 'desc' }),
    });
    mockAddDoc.mockResolvedValueOnce({ id: 'new-list' });

    await copyList('source1', 'user1');
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('copies public list with items', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ size: 2 }) // user list count
      .mockResolvedValueOnce({ // fetchListItems
        docs: [
          { data: () => ({ businessId: 'biz1' }) },
          { data: () => ({ businessId: 'biz2' }) },
        ],
      });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: 'other', isPublic: true, name: 'Public List', description: 'hi' }),
    });
    mockAddDoc.mockResolvedValueOnce({ id: 'copied-list' });

    const newId = await copyList('source1', 'user1');
    expect(newId).toBe('copied-list');
    // 2 items should be added (setDoc for each item + updateDoc for itemCount)
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('copies empty list without adding items', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ size: 0 })
      .mockResolvedValueOnce({ docs: [] }); // no items
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerId: 'other', isPublic: true, name: 'Empty', description: '' }),
    });
    mockAddDoc.mockResolvedValueOnce({ id: 'new-empty' });

    await copyList('source1', 'user1');
    // Only the addDoc for createList, no setDoc for items
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
