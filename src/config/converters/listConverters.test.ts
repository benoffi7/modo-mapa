import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import { sharedListConverter, listItemConverter } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

// ---------------------------------------------------------------------------
// sharedListConverter
// ---------------------------------------------------------------------------
describe('sharedListConverter', () => {
  const full = {
    ownerId: 'u1', name: 'My List', description: 'Desc',
    isPublic: true, featured: false, editorIds: [], itemCount: 3, createdAt: NOW, updatedAt: NOW,
  };

  it('toFirestore serializes all fields', () => {
    const result = sharedListConverter.toFirestore({ id: 'sl1', ...full });
    expect(result).toEqual(full);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({}, 'sl1');
    const result = sharedListConverter.fromFirestore(snap);
    expect(result.id).toBe('sl1');
    expect(result.ownerId).toBe('');
    expect(result.name).toBe('');
    expect(result.description).toBe('');
    expect(result.isPublic).toBe(false);
    expect(result.itemCount).toBe(0);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot(full, 'sl1');
    const result = sharedListConverter.fromFirestore(snap);
    expect(result.id).toBe('sl1');
    expect(result.name).toBe('My List');
    expect(result.isPublic).toBe(true);
    expect(result.itemCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// listItemConverter
// ---------------------------------------------------------------------------
describe('listItemConverter', () => {
  it('toFirestore serializes without id', () => {
    const item = { id: 'li1', listId: 'sl1', businessId: 'b1', addedBy: '', createdAt: NOW };
    const result = listItemConverter.toFirestore(item);
    expect(result).not.toHaveProperty('id');
    expect(result.listId).toBe('sl1');
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({}, 'li1');
    const result = listItemConverter.fromFirestore(snap);
    expect(result.id).toBe('li1');
    expect(result.listId).toBe('');
    expect(result.businessId).toBe('');
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot({ listId: 'sl1', businessId: 'b1', createdAt: NOW }, 'li1');
    const result = listItemConverter.fromFirestore(snap);
    expect(result.id).toBe('li1');
    expect(result.listId).toBe('sl1');
    expect(result.businessId).toBe('b1');
  });
});
