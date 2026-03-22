import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { CHECKINS: 'checkins' } }));
vi.mock('../config/converters', () => ({ checkinConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'ci_001' });
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { createCheckIn, fetchMyCheckIns, fetchCheckInsForBusiness } from './checkins';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';

beforeEach(() => vi.clearAllMocks());

describe('createCheckIn', () => {
  it('throws when userId is empty', async () => {
    await expect(createCheckIn('', 'b1', 'Test')).rejects.toThrow();
  });

  it('throws when businessId is empty', async () => {
    await expect(createCheckIn('u1', '', 'Test')).rejects.toThrow();
  });

  it('throws when businessName is empty', async () => {
    await expect(createCheckIn('u1', 'b1', '')).rejects.toThrow();
  });

  it('writes to Firestore and returns doc id', async () => {
    const id = await createCheckIn('u1', 'biz_001', 'Cafe Test');
    expect(id).toBe('ci_001');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'u1',
        businessId: 'biz_001',
        businessName: 'Cafe Test',
        createdAt: 'SERVER_TIMESTAMP',
      }),
    );
  });

  it('includes location when provided', async () => {
    await createCheckIn('u1', 'biz_001', 'Test', { lat: -34.6, lng: -58.4 });
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ location: { lat: -34.6, lng: -58.4 } }),
    );
  });

  it('does not include location when not provided', async () => {
    await createCheckIn('u1', 'biz_001', 'Test');
    const callData = mockAddDoc.mock.calls[0][1];
    expect(callData).not.toHaveProperty('location');
  });

  it('invalidates cache and tracks event', async () => {
    await createCheckIn('u1', 'biz_001', 'Test');
    expect(invalidateQueryCache).toHaveBeenCalledWith('checkins', 'u1');
    expect(trackEvent).toHaveBeenCalledWith('checkin_created', expect.objectContaining({
      business_id: 'biz_001',
    }));
  });
});

describe('fetchMyCheckIns', () => {
  it('returns mapped docs', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ id: '1', userId: 'u1', businessId: 'b1', businessName: 'T', createdAt: new Date() }) }],
    });
    const result = await fetchMyCheckIns('u1');
    expect(result).toHaveLength(1);
  });
});

describe('fetchCheckInsForBusiness', () => {
  it('returns mapped docs', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ id: '1', userId: 'u1', businessId: 'b1', businessName: 'T', createdAt: new Date() }) }],
    });
    const result = await fetchCheckInsForBusiness('b1', 'u1');
    expect(result).toHaveLength(1);
  });
});
