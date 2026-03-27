import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ withConverter: vi.fn(() => 'converted-ref') })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn(() => 'doc-ref'),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => 'server-ts',
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => 'storage-ref'),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {},
  storage: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { FEEDBACK: 'feedback' },
}));

vi.mock('../config/converters', () => ({
  feedbackConverter: {},
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('../constants/feedback', () => ({
  VALID_CATEGORIES: ['bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro'],
  MAX_FEEDBACK_MEDIA_SIZE: 10 * 1024 * 1024,
}));

vi.mock('../constants/validation', () => ({
  MAX_FEEDBACK_LENGTH: 1000,
}));

import { sendFeedback, fetchUserFeedback, markFeedbackViewed } from './feedback';

describe('sendFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'fb-1' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUploadBytes.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue('https://example.com/image.jpg');
  });

  it('sends feedback with valid message and category', async () => {
    await sendFeedback('user1', 'Great app!', 'sugerencia');

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user1',
        message: 'Great app!',
        category: 'sugerencia',
        createdAt: 'server-ts',
      }),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith('feedback_submit', { category: 'sugerencia' });
  });

  it('trims message whitespace', async () => {
    await sendFeedback('user1', '  Hello world  ', 'bug');

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'Hello world' }),
    );
  });

  it('rejects empty message', async () => {
    await expect(sendFeedback('user1', '', 'bug')).rejects.toThrow(
      'Feedback message must be 1-1000 characters',
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only message', async () => {
    await expect(sendFeedback('user1', '   ', 'bug')).rejects.toThrow(
      'Feedback message must be 1-1000 characters',
    );
  });

  it('rejects message over max length', async () => {
    const longMessage = 'a'.repeat(1001);
    await expect(sendFeedback('user1', longMessage, 'bug')).rejects.toThrow(
      'Feedback message must be 1-1000 characters',
    );
  });

  it('rejects invalid category', async () => {
    await expect(
      sendFeedback('user1', 'Hello', 'invalid' as never),
    ).rejects.toThrow('Invalid feedback category');
  });

  it('includes business info when provided', async () => {
    await sendFeedback('user1', 'Issue here', 'datos_comercio', undefined, {
      id: 'biz-1',
      name: 'Test Biz',
    });

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        businessId: 'biz-1',
        businessName: 'Test Biz',
      }),
    );
  });

  it('uploads media file and updates doc', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await sendFeedback('user1', 'See photo', 'bug', file);

    expect(mockUploadBytes).toHaveBeenCalled();
    expect(mockGetDownloadURL).toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
      }),
    );
  });

  it('sets mediaType to pdf for PDF files', async () => {
    const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });

    await sendFeedback('user1', 'See doc', 'bug', file);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mediaType: 'pdf' }),
    );
  });

  it('rejects unsupported media types', async () => {
    const file = new File(['vid'], 'video.mp4', { type: 'video/mp4' });

    await expect(sendFeedback('user1', 'See video', 'bug', file)).rejects.toThrow(
      'Formato no soportado. Usa JPG, PNG, WebP o PDF.',
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejects media files over size limit', async () => {
    const file = new File([''], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });

    await expect(sendFeedback('user1', 'Big file', 'bug', file)).rejects.toThrow(
      'La imagen es muy grande. Máximo 10 MB.',
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

describe('fetchUserFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns user feedback', async () => {
    const mockData = [{ id: 'fb-1', message: 'Test' }];
    mockGetDocs.mockResolvedValue({
      docs: mockData.map((d) => ({ data: () => d })),
    });

    const result = await fetchUserFeedback('user1');
    expect(result).toEqual(mockData);
  });

  it('returns empty array when no feedback', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await fetchUserFeedback('user1');
    expect(result).toEqual([]);
  });
});

describe('markFeedbackViewed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('updates viewedByUser to true', async () => {
    await markFeedbackViewed('fb-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { viewedByUser: true });
  });
});
