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
}));

import { searchUsers, fetchUserDisplayNames } from './users';

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
        { id: 'u1', data: () => ({ displayName: 'Alice' }) },
        { id: 'u2', data: () => ({ displayName: 'Albert' }) },
      ],
    });
    // u1 settings: profilePublic false (private)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ profilePublic: false }),
    });
    // u2 settings: profilePublic true (public)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ profilePublic: true }),
    });

    const results = await searchUsers('al');
    expect(results).toEqual([{ userId: 'u2', displayName: 'Albert' }]);
  });

  it('includes users with no settings document (default public)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'u1', data: () => ({ displayName: 'Bob' }) }],
    });
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

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
