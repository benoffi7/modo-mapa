import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { USERS: 'users', USER_SETTINGS: 'userSettings' },
}));
vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  documentId: vi.fn().mockReturnValue('__name__'),
}));

import { searchUsers, fetchUserDisplayNames, fetchProfileVisibility } from './users';

describe('searchUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when searchTerm is empty', async () => {
    expect(await searchUsers('')).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns empty array when searchTerm is shorter than 2 chars', async () => {
    expect(await searchUsers('a')).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns empty array when no users match', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    expect(await searchUsers('test')).toEqual([]);
  });

  it('filters out users with profilePublic=false', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        { id: 'u1', data: () => ({ displayName: 'Alice', profilePublic: false }) },
        { id: 'u2', data: () => ({ displayName: 'Albert', profilePublic: true }) },
      ],
    });

    const results = await searchUsers('al');
    expect(results).toEqual([{ userId: 'u2', displayName: 'Albert' }]);
  });

  it('includes users with no profilePublic field (default not private)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'u1', data: () => ({ displayName: 'Bob' }) }],
    });

    const results = await searchUsers('bo');
    expect(results).toEqual([{ userId: 'u1', displayName: 'Bob' }]);
  });

  it('uses userId as displayName fallback', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'u1', data: () => ({}) }],
    });
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const results = await searchUsers('te');
    expect(results).toEqual([{ userId: 'u1', displayName: 'u1' }]);
  });

  it('respects maxResults limit', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        { id: 'u1', data: () => ({ displayName: 'A1' }) },
        { id: 'u2', data: () => ({ displayName: 'A2' }) },
        { id: 'u3', data: () => ({ displayName: 'A3' }) },
      ],
    });
    // All public
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const results = await searchUsers('aa', 2);
    expect(results).toHaveLength(2);
  });
});

describe('fetchUserDisplayNames', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty map for empty input', async () => {
    const result = await fetchUserDisplayNames([]);
    expect(result.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns map of userId to displayName', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'u1', data: () => ({ displayName: 'Alice' }) },
        { id: 'u2', data: () => ({ displayName: 'Bob' }) },
      ],
    });

    const result = await fetchUserDisplayNames(['u1', 'u2']);
    expect(result.get('u1')).toBe('Alice');
    expect(result.get('u2')).toBe('Bob');
  });

  it('falls back to userId when displayName is missing', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'u1', data: () => ({}) }],
    });

    const result = await fetchUserDisplayNames(['u1']);
    expect(result.get('u1')).toBe('u1');
  });

  it('handles batch errors gracefully', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('network error'));

    const result = await fetchUserDisplayNames(['u1']);
    expect(result.size).toBe(0);
  });

  it('batches in groups of 30', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `u${i}`);
    mockGetDocs
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });

    await fetchUserDisplayNames(ids);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('fetchProfileVisibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty map for empty userIds array', async () => {
    const result = await fetchProfileVisibility([]);
    expect(result.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns true for user with profilePublic=true', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'u1', data: () => ({ profilePublic: true }) }],
    });
    const result = await fetchProfileVisibility(['u1']);
    expect(result.get('u1')).toBe(true);
  });

  it('returns false for user with profilePublic=false', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'u1', data: () => ({ profilePublic: false }) }],
    });
    const result = await fetchProfileVisibility(['u1']);
    expect(result.get('u1')).toBe(false);
  });

  it('defaults to false for user IDs not found in Firestore', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await fetchProfileVisibility(['u-missing']);
    expect(result.get('u-missing')).toBe(false);
  });

  it('defaults all to false on fetch error', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('network error'));
    const result = await fetchProfileVisibility(['u1', 'u2']);
    expect(result.get('u1')).toBe(false);
    expect(result.get('u2')).toBe(false);
  });

  it('batches 35 ids into 2 calls (30 + 5)', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `u${i}`);
    mockGetDocs.mockResolvedValue({ docs: [] });
    await fetchProfileVisibility(ids);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});
