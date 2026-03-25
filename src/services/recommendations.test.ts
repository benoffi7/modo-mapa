import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { RECOMMENDATIONS: 'recommendations' },
}));
vi.mock('../config/converters', () => ({ recommendationConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../constants/analyticsEvents', () => ({
  EVT_RECOMMENDATION_SENT: 'recommendation_sent',
}));

const mockAddDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn();
const mockGetCountFromServer = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({}),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import {
  createRecommendation,
  markRecommendationAsRead,
  countUnreadRecommendations,
  countRecommendationsSentToday,
  markAllRecommendationsAsRead,
} from './recommendations';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';

describe('createRecommendation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when senderId is empty', async () => {
    await expect(createRecommendation('', 'Ana', 'u2', 'b1', 'Cafe', 'msg'))
      .rejects.toThrow('senderId, recipientId, and businessId are required');
  });

  it('throws when recipientId is empty', async () => {
    await expect(createRecommendation('u1', 'Ana', '', 'b1', 'Cafe', 'msg'))
      .rejects.toThrow('senderId, recipientId, and businessId are required');
  });

  it('throws when businessId is empty', async () => {
    await expect(createRecommendation('u1', 'Ana', 'u2', '', 'Cafe', 'msg'))
      .rejects.toThrow('senderId, recipientId, and businessId are required');
  });

  it('throws when sender and recipient are the same', async () => {
    await expect(createRecommendation('u1', 'Ana', 'u1', 'b1', 'Cafe', 'msg'))
      .rejects.toThrow('No podes recomendarte a vos mismo');
  });

  it('creates document, invalidates cache, and tracks event', async () => {
    await createRecommendation('u1', 'Ana', 'u2', 'b1', 'Cafe', 'Great place');

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        senderId: 'u1',
        senderName: 'Ana',
        recipientId: 'u2',
        businessId: 'b1',
        businessName: 'Cafe',
        message: 'Great place',
        read: false,
        createdAt: 'SERVER_TIMESTAMP',
      }),
    );
    expect(invalidateQueryCache).toHaveBeenCalledWith('recommendations', 'u1');
    expect(trackEvent).toHaveBeenCalledWith('recommendation_sent', {
      business_id: 'b1',
      recipient_id: 'u2',
    });
  });

  it('trims and truncates message to max length', async () => {
    const longMessage = '  ' + 'a'.repeat(300) + '  ';
    await createRecommendation('u1', 'Ana', 'u2', 'b1', 'Cafe', longMessage);

    const calledWith = mockAddDoc.mock.calls[0][1] as { message: string };
    expect(calledWith.message).toHaveLength(200);
    expect(calledWith.message).not.toMatch(/^\s/);
  });
});

describe('markRecommendationAsRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the document with read=true', async () => {
    await markRecommendationAsRead('rec123');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { read: true });
  });
});

describe('markAllRecommendationsAsRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates all unread docs and invalidates cache', async () => {
    const fakeRef1 = { id: 'r1' };
    const fakeRef2 = { id: 'r2' };
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ ref: fakeRef1 }, { ref: fakeRef2 }],
    });

    await markAllRecommendationsAsRead('u1');

    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenCalledWith(fakeRef1, { read: true });
    expect(mockUpdateDoc).toHaveBeenCalledWith(fakeRef2, { read: true });
    expect(invalidateQueryCache).toHaveBeenCalledWith('recommendations', 'u1');
  });
});

describe('countUnreadRecommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the count from server', async () => {
    mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 5 }) });
    const result = await countUnreadRecommendations('u1');
    expect(result).toBe(5);
  });

  it('returns 0 when no unread', async () => {
    mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 0 }) });
    const result = await countUnreadRecommendations('u1');
    expect(result).toBe(0);
  });
});

describe('countRecommendationsSentToday', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the count from server', async () => {
    mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 3 }) });
    const result = await countRecommendationsSentToday('u1');
    expect(result).toBe(3);
  });
});
