import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { USER_TAGS: 'userTags', CUSTOM_TAGS: 'customTags' },
}));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../constants/tags', () => ({
  VALID_TAG_IDS: ['barato', 'rapido', 'delivery'],
}));
vi.mock('../constants/validation', () => ({
  MAX_CUSTOM_TAG_LENGTH: 30,
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-id' });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { addUserTag, removeUserTag, createCustomTag, updateCustomTag, deleteCustomTag } from './tags';

describe('addUserTag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws on invalid tagId', async () => {
    await expect(addUserTag('u1', 'b1', 'invalid_tag')).rejects.toThrow('Invalid tagId');
  });

  it('writes valid tag to Firestore', async () => {
    await addUserTag('u1', 'b1', 'barato');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', businessId: 'b1', tagId: 'barato' }),
    );
  });
});

describe('removeUserTag', () => {
  it('deletes the document', async () => {
    await removeUserTag('u1', 'b1', 'barato');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});

describe('createCustomTag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws on empty label', async () => {
    await expect(createCustomTag('u1', 'b1', '   ')).rejects.toThrow('Custom tag label must be 1-30 characters');
  });

  it('throws on label exceeding 30 chars', async () => {
    const longLabel = 'a'.repeat(31);
    await expect(createCustomTag('u1', 'b1', longLabel)).rejects.toThrow('Custom tag label must be 1-30 characters');
  });

  it('accepts valid label', async () => {
    await createCustomTag('u1', 'b1', 'My Tag');
    expect(mockAddDoc).toHaveBeenCalledWith(
      undefined, // collection ref (mocked)
      expect.objectContaining({ userId: 'u1', businessId: 'b1', label: 'My Tag' }),
    );
  });
});

describe('updateCustomTag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws on empty label', async () => {
    await expect(updateCustomTag('t1', '')).rejects.toThrow('Custom tag label must be 1-30 characters');
  });

  it('updates with trimmed label', async () => {
    await updateCustomTag('t1', '  New Label  ');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { label: 'New Label' });
  });
});

describe('deleteCustomTag', () => {
  it('deletes the document', async () => {
    await deleteCustomTag('t1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
