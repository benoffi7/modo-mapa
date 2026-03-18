import { describe, it, expect, vi } from 'vitest';

// Mock Firebase before importing the service
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { COMMENTS: 'comments', COMMENT_LIKES: 'commentLikes' } }));
vi.mock('../config/converters', () => ({ commentConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'newDoc' });
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockSetDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => {
  const withConverterFn = vi.fn(function (this: unknown) { return this; });
  return {
    collection: vi.fn().mockReturnValue({ withConverter: withConverterFn }),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    doc: vi.fn().mockReturnValue({}),
    serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
  };
});

import { addComment, editComment, deleteComment, getCommentsCollection, likeComment, unlikeComment } from './comments';

describe('addComment — input validation', () => {
  it('throws on empty text', async () => {
    await expect(addComment('u1', 'User', 'b1', '')).rejects.toThrow('Comment text must be 1-500 characters');
  });

  it('throws on whitespace-only text', async () => {
    await expect(addComment('u1', 'User', 'b1', '   ')).rejects.toThrow('Comment text must be 1-500 characters');
  });

  it('throws on text exceeding 500 characters', async () => {
    const longText = 'a'.repeat(501);
    await expect(addComment('u1', 'User', 'b1', longText)).rejects.toThrow('Comment text must be 1-500 characters');
  });

  it('accepts text at exactly 500 characters', async () => {
    const text = 'a'.repeat(500);
    await expect(addComment('u1', 'User', 'b1', text)).resolves.not.toThrow();
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('throws on empty userName', async () => {
    await expect(addComment('u1', '', 'b1', 'hello')).rejects.toThrow('User name must be 1-30 characters');
  });

  it('throws on userName exceeding 30 characters', async () => {
    const longName = 'a'.repeat(31);
    await expect(addComment('u1', longName, 'b1', 'hello')).rejects.toThrow('User name must be 1-30 characters');
  });

  it('trims text and userName before validation', async () => {
    mockAddDoc.mockClear();
    await addComment('u1', '  User  ', 'b1', '  hello  ');
    const data = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(data.text).toBe('hello');
    expect(data.userName).toBe('User');
  });

  it('includes parentId when provided', async () => {
    mockAddDoc.mockClear();
    await addComment('u1', 'User', 'b1', 'reply', 'parent123');
    // addDoc receives (collectionRef, data) — collectionRef is mocked as undefined
    const data = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(data.parentId).toBe('parent123');
  });

  it('omits parentId when not provided', async () => {
    mockAddDoc.mockClear();
    await addComment('u1', 'User', 'b1', 'root comment');
    const data = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(data).not.toHaveProperty('parentId');
  });
});

describe('editComment — input validation', () => {
  it('throws on empty text', async () => {
    await expect(editComment('c1', 'u1', '')).rejects.toThrow('Comment text must be 1-500 characters');
  });

  it('throws on text exceeding 500 characters', async () => {
    await expect(editComment('c1', 'u1', 'a'.repeat(501))).rejects.toThrow('Comment text must be 1-500 characters');
  });

  it('updates with trimmed text and updatedAt timestamp', async () => {
    await editComment('c1', 'u1', '  updated text  ');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'updated text' }),
    );
  });
});

describe('deleteComment', () => {
  it('calls deleteDoc', async () => {
    await deleteComment('c1', 'u1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});

describe('getCommentsCollection', () => {
  it('returns a collection reference with the comment converter applied', () => {
    const result = getCommentsCollection();
    expect(result).toBeDefined();
    expect(result).toHaveProperty('withConverter');
  });
});

describe('likeComment', () => {
  it('creates a like document with composite key userId__commentId', async () => {
    mockSetDoc.mockClear();
    await likeComment('u1', 'c1');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', commentId: 'c1', createdAt: 'SERVER_TIMESTAMP' }),
    );
  });
});

describe('unlikeComment', () => {
  it('deletes the like document', async () => {
    mockDeleteDoc.mockClear();
    await unlikeComment('u1', 'c1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
