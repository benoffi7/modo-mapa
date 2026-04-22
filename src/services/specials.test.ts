import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { SPECIALS: 'specials' },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ __docId: id })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  orderBy: vi.fn(),
  where: vi.fn(),
  query: vi.fn(() => 'query-ref'),
}));

import { fetchSpecials, fetchActiveSpecials, saveAllSpecials } from './specials';

describe('fetchSpecials', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns specials mapped from snapshot docs with id included', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'sp1', data: () => ({ title: 'Special A', order: 1, active: true }) },
        { id: 'sp2', data: () => ({ title: 'Special B', order: 2, active: false }) },
      ],
    });

    const result = await fetchSpecials();
    expect(result).toEqual([
      { id: 'sp1', title: 'Special A', order: 1, active: true },
      { id: 'sp2', title: 'Special B', order: 2, active: false },
    ]);
  });

  it('returns empty array when collection is empty', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await fetchSpecials();
    expect(result).toEqual([]);
  });
});

describe('fetchActiveSpecials', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns specials mapped from snapshot', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'sp1', data: () => ({ title: 'Active Special', order: 1, active: true }) }],
    });

    const result = await fetchActiveSpecials();
    expect(result).toEqual([{ id: 'sp1', title: 'Active Special', order: 1, active: true }]);
  });
});

describe('saveAllSpecials', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes docs whose id is not in the new array', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'old1', ref: 'ref-old' },
        { id: 'keep1', ref: 'ref-keep' },
      ],
    });

    type Special = Parameters<typeof saveAllSpecials>[0][0];
    await saveAllSpecials([{ id: 'keep1', title: 'Keep', order: 1, active: true } as Special]);

    expect(mockDeleteDoc).toHaveBeenCalledWith('ref-old');
    expect(mockDeleteDoc).not.toHaveBeenCalledWith('ref-keep');
  });

  it('upserts each special with updatedAt added and id stripped from payload', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    type Special = Parameters<typeof saveAllSpecials>[0][0];
    await saveAllSpecials([{ id: 'sp1', title: 'Promo', order: 3, active: true } as Special]);

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const [, payload] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(payload).not.toHaveProperty('id');
    expect(payload).toHaveProperty('title', 'Promo');
    expect(payload).toHaveProperty('updatedAt');
  });

  it('deletes all when called with empty array', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'sp1', ref: 'ref1' },
        { id: 'sp2', ref: 'ref2' },
      ],
    });

    await saveAllSpecials([]);

    expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
