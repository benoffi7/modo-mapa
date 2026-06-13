import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({
  COLLECTIONS: {
    USER_TAGS: 'userTags',
    CUSTOM_TAGS: 'customTags',
  },
}));
vi.mock('../../constants/validation', () => ({ MAX_CUSTOM_TAG_LENGTH: 30 }));
vi.mock('../../constants/tags', () => ({ VALID_TAG_IDS: ['comida', 'cafe'] }));

const mockTrackEvent = vi.fn();
vi.mock('../../utils/analytics', () => ({ trackEvent: (...args: unknown[]) => mockTrackEvent(...args) }));

const mockAddDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
// doc() returns a ref object that records its args + carries a generated id
const mockDoc = vi.fn((...args: unknown[]) => ({ __args: args, id: 'generated-tag-id' }));
const mockCollection = vi.fn((...args: unknown[]) => ({ __collection: args }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import {
  generateCustomTagId,
  createCustomTag,
  updateCustomTag,
  deleteCustomTag,
} from '../tags';

describe('tags service — custom tags (#344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'auto-id' });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  describe('generateCustomTagId', () => {
    it('returns a non-empty client-side id (no network)', () => {
      const id = generateCustomTagId();
      expect(id).toBe('generated-tag-id');
      expect(id.length).toBeGreaterThan(0);
      // builds a doc ref against the customTags collection, never touches network
      expect(mockCollection).toHaveBeenCalledWith({}, 'customTags');
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe('createCustomTag', () => {
    it('uses setDoc on the provided tagId when tagId is passed', async () => {
      await createCustomTag('u1', 'biz_1', 'Pet friendly', 'tag-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).not.toHaveBeenCalled();
      // doc(db, 'customTags', tagId)
      expect(mockDoc).toHaveBeenCalledWith({}, 'customTags', 'tag-123');
      const [, data] = mockSetDoc.mock.calls[0];
      expect(data).toEqual({
        userId: 'u1',
        businessId: 'biz_1',
        label: 'Pet friendly',
        createdAt: 'SERVER_TIMESTAMP',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('custom_tag_create', { business_id: 'biz_1' });
    });

    it('uses addDoc (auto id) when no tagId is passed', async () => {
      await createCustomTag('u1', 'biz_1', 'Wifi');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('sends label trimmed in both paths', async () => {
      await createCustomTag('u1', 'biz_1', '  Outdoor  ', 'tag-x');
      const [, setData] = mockSetDoc.mock.calls[0];
      expect(setData.label).toBe('Outdoor');

      vi.clearAllMocks();
      mockAddDoc.mockResolvedValue({ id: 'auto-id' });
      await createCustomTag('u1', 'biz_1', '  Outdoor  ');
      const [, addData] = mockAddDoc.mock.calls[0];
      expect(addData.label).toBe('Outdoor');
    });

    it('throws on empty label', async () => {
      await expect(createCustomTag('u1', 'biz_1', '   ', 'tag-1')).rejects.toThrow('1-30 characters');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('throws on label longer than 30 chars', async () => {
      await expect(createCustomTag('u1', 'biz_1', 'A'.repeat(31), 'tag-1')).rejects.toThrow('1-30 characters');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe('updateCustomTag', () => {
    it('updates the given tag with trimmed label', async () => {
      await updateCustomTag('tag-9', '  New label  ');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const [, data] = mockUpdateDoc.mock.calls[0];
      expect(data).toEqual({ label: 'New label' });
    });

    it('throws on invalid label', async () => {
      await expect(updateCustomTag('tag-9', '')).rejects.toThrow('1-30 characters');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('deleteCustomTag', () => {
    it('deletes the doc by tagId', async () => {
      await deleteCustomTag('tag-7');
      expect(mockDoc).toHaveBeenCalledWith({}, 'customTags', 'tag-7');
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });
});
