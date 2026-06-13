import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Service-level offline gate (defense-in-depth, #335).
// Verifica que llamar a los mutators DIRECTO (sin withOfflineSupport en el
// callsite) estando offline encola la accion en vez de fallar silenciosamente.

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { FAVORITES: 'favorites', COMMENTS: 'comments', RATINGS: 'ratings' },
}));
vi.mock('../config/converters', () => ({ favoriteConverter: {}, commentConverter: {}, ratingConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../utils/perfMetrics', () => ({
  measureAsync: (_n: string, fn: () => unknown) => fn(),
  measuredGetDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ criteria: {} }) }),
  measuredGetDocs: vi.fn(),
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  addDoc: vi.fn().mockResolvedValue({ id: 'new' }),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

// Espiamos enqueue en offlineQueue (lo usa withOfflineSupport, reutilizado por gateServiceWrite).
const mockEnqueue = vi.fn().mockResolvedValue(undefined);
vi.mock('./offlineQueue', () => ({ enqueue: (...args: unknown[]) => mockEnqueue(...args) }));

import { addFavorite, removeFavorite } from './favorites';
import { editComment, deleteComment } from './comments';
import { upsertCriteriaRating } from './ratings';

const onLineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('service-level offline gate (#335)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (onLineDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', onLineDescriptor);
    } else {
      setOnline(true);
    }
  });

  describe('online passthrough (no enqueue)', () => {
    beforeEach(() => setOnline(true));

    it('addFavorite writes directly and does not enqueue', async () => {
      await addFavorite('u1', 'b1');
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('editComment writes directly and does not enqueue', async () => {
      await editComment('c1', 'u1', 'Texto');
      expect(mockUpdateDoc).toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('upsertCriteriaRating writes directly and does not enqueue', async () => {
      await upsertCriteriaRating('u1', 'b1', { food: 4 });
      expect(mockUpdateDoc).toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  describe('offline enqueue (no silent failure)', () => {
    beforeEach(() => setOnline(false));

    it('addFavorite enqueues favorite_add instead of writing', async () => {
      await addFavorite('u1', 'b1');
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'favorite_add', userId: 'u1', businessId: 'b1' }),
      );
    });

    it('removeFavorite enqueues favorite_remove instead of deleting', async () => {
      await removeFavorite('u1', 'b1');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'favorite_remove', userId: 'u1', businessId: 'b1' }),
      );
    });

    it('editComment enqueues comment_edit instead of updating', async () => {
      await editComment('c1', 'u1', 'Editado');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment_edit',
          userId: 'u1',
          payload: expect.objectContaining({ commentId: 'c1', text: 'Editado' }),
        }),
      );
    });

    it('deleteComment enqueues comment_delete instead of deleting', async () => {
      await deleteComment('c1', 'u1');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment_delete',
          payload: expect.objectContaining({ commentId: 'c1' }),
        }),
      );
    });

    it('upsertCriteriaRating enqueues one rating_criteria_upsert per criterion', async () => {
      await upsertCriteriaRating('u1', 'b1', { food: 4, service: 5 });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledTimes(2);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rating_criteria_upsert',
          payload: expect.objectContaining({ criterionId: 'food', value: 4 }),
        }),
      );
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rating_criteria_upsert',
          payload: expect.objectContaining({ criterionId: 'service', value: 5 }),
        }),
      );
    });

    it('still validates input before gating (editComment empty text throws)', async () => {
      await expect(editComment('c1', 'u1', '   ')).rejects.toThrow('Comment text must be 1-500 characters');
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('still validates input before gating (upsertCriteriaRating out-of-range throws)', async () => {
      await expect(upsertCriteriaRating('u1', 'b1', { food: 9 })).rejects.toThrow(
        'Criteria scores must be integers between 1 and 5',
      );
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });
});
