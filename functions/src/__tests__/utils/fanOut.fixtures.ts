/**
 * Shared mock builder for fanOut tests.
 * Extracted to stay under the 400-line file limit.
 */
import { vi, type Mock } from 'vitest';

export type Docish = {
  id: string;
  data: () => Record<string, unknown>;
  get?: (k: string) => unknown;
};

export interface MockDbState {
  userSettings: Record<string, { profilePublic?: boolean } | null>;
  followers: Docish[];
  dedup: Map<string, { createdAt: number }>;
  batches: Array<Array<{ ref: string; data: Record<string, unknown> }>>;
  feedWrites: Array<{ ref: string; data: Record<string, unknown> }>;
  dedupWrites: Array<{ ref: string; data: Record<string, unknown> }>;
  commitCount: number;
}

export function buildDb(initial: Partial<MockDbState> = {}) {
  const state: MockDbState = {
    userSettings: initial.userSettings ?? {},
    followers: initial.followers ?? [],
    dedup: initial.dedup ?? new Map(),
    batches: [],
    feedWrites: [],
    dedupWrites: [],
    commitCount: 0,
  };

  let currentBatch: Array<{ ref: string; data: Record<string, unknown> }> = [];

  const doc = (path: string) => {
    if (path.startsWith('userSettings/')) {
      const uid = path.split('/')[1];
      const data = state.userSettings[uid];
      return {
        get: vi.fn().mockResolvedValue({
          exists: data !== undefined && data !== null,
          data: () => data ?? null,
        }),
        _path: path,
      };
    }
    return { _path: path };
  };

  const collectionCursor = {
    where: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation((n: number) => ({
        get: vi.fn().mockResolvedValue({
          empty: state.followers.length === 0,
          docs: state.followers.slice(0, n),
        }),
      })),
    })),
  };

  const dedupCollection = {
    doc: vi.fn().mockImplementation((id: string) => {
      const existing = state.dedup.get(id);
      return {
        _path: `_fanoutDedup/${id}`,
        _dedupKey: id,
        get: vi.fn().mockResolvedValue({
          exists: existing !== undefined,
          get: (k: string) => {
            if (!existing) return undefined;
            if (k === 'createdAt') return existing.createdAt;
            return undefined;
          },
        }),
      };
    }),
  };

  const activityFeedCollection = {
    doc: vi.fn().mockImplementation(() => ({
      collection: vi.fn().mockImplementation(() => ({
        doc: vi.fn().mockImplementation(() => ({ _path: 'activityFeed/X/items/Y' })),
      })),
    })),
  };

  const getAll = vi.fn().mockImplementation(
    (...refs: Array<{ _dedupKey?: string; _path: string }>) =>
      Promise.resolve(
        refs.map((ref) => {
          const id = ref._dedupKey ?? ref._path.split('/').pop() ?? '';
          const existing = state.dedup.get(id);
          return {
            exists: existing !== undefined,
            get: (k: string) => {
              if (!existing) return undefined;
              if (k === 'createdAt') return existing.createdAt;
              return undefined;
            },
          };
        }),
      ),
  );

  const db = {
    doc,
    getAll,
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'follows') return collectionCursor;
      if (name === '_fanoutDedup') return dedupCollection;
      if (name === 'activityFeed') return activityFeedCollection;
      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn().mockImplementation(() => {
      currentBatch = [];
      return {
        set: vi.fn().mockImplementation((ref: { _path: string }, data: Record<string, unknown>) => {
          currentBatch.push({ ref: ref._path, data });
          if (ref._path.startsWith('_fanoutDedup/')) {
            state.dedupWrites.push({ ref: ref._path, data });
          } else {
            state.feedWrites.push({ ref: ref._path, data });
          }
        }),
        commit: vi.fn().mockImplementation(async () => {
          state.batches.push([...currentBatch]);
          state.commitCount += 1;
          currentBatch = [];
        }),
      };
    }),
  };

  return { db, state, getAllSpy: getAll as Mock };
}
