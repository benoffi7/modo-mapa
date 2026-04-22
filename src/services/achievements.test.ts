import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { ACHIEVEMENTS: 'achievements' },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ __docId: id })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  orderBy: vi.fn(),
  query: vi.fn(() => 'query-ref'),
}));

import { fetchAchievements, saveAllAchievements } from './achievements';

describe('fetchAchievements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns achievements mapped from snapshot docs with id included', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'ach1', data: () => ({ title: 'First', order: 1 }) },
        { id: 'ach2', data: () => ({ title: 'Second', order: 2 }) },
      ],
    });

    const result = await fetchAchievements();
    expect(result).toEqual([
      { id: 'ach1', title: 'First', order: 1 },
      { id: 'ach2', title: 'Second', order: 2 },
    ]);
  });

  it('returns empty array when collection is empty', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await fetchAchievements();
    expect(result).toEqual([]);
  });
});

describe('saveAllAchievements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes docs whose id is not in the new array', async () => {
    const existingRef = { ref: 'ref-old' };
    // First getDocs call: existingSnap
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'old1', ref: existingRef.ref },
        { id: 'keep1', ref: 'ref-keep' },
      ],
    });

    await saveAllAchievements([{ id: 'keep1', title: 'Keep', order: 1 } as unknown as Parameters<typeof saveAllAchievements>[0][0]]);

    expect(mockDeleteDoc).toHaveBeenCalledWith('ref-old');
    expect(mockDeleteDoc).not.toHaveBeenCalledWith('ref-keep');
  });

  it('upserts each achievement with updatedAt added and id stripped from payload', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await saveAllAchievements([{ id: 'ach1', title: 'Hero', order: 5 } as unknown as Parameters<typeof saveAllAchievements>[0][0]]);

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const [, payload] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(payload).not.toHaveProperty('id');
    expect(payload).toHaveProperty('title', 'Hero');
    expect(payload).toHaveProperty('order', 5);
    expect(payload).toHaveProperty('updatedAt');
  });

  it('does not delete anything when all existing ids are still present', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'ach1', ref: 'ref1' }],
    });

    await saveAllAchievements([{ id: 'ach1', title: 'Hero', order: 1 } as unknown as Parameters<typeof saveAllAchievements>[0][0]]);

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});
