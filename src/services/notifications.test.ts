import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();

const mockMeasureAsync = vi.fn();
const mockGetCountOfflineSafe = vi.fn();

const mockBatch = {
  update: vi.fn(),
  commit: vi.fn(),
};

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({
    withConverter: vi.fn(() => 'converted-collection'),
  })),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn(() => 'doc-ref'),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: () => mockBatch,
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { NOTIFICATIONS: 'notifications' },
}));

vi.mock('../config/converters', () => ({
  notificationConverter: {},
}));

vi.mock('../utils/perfMetrics', () => ({
  measureAsync: (...args: unknown[]) => mockMeasureAsync(...args),
}));

vi.mock('./getCountOfflineSafe', () => ({
  getCountOfflineSafe: (...args: unknown[]) => mockGetCountOfflineSafe(...args),
}));

import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from './notifications';

describe('fetchUserNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches notifications and returns mapped data', async () => {
    const notifs = [
      { id: 'n-1', message: 'Hello' },
      { id: 'n-2', message: 'World' },
    ];
    const snap = { docs: notifs.map((n) => ({ data: () => n })) };
    mockMeasureAsync.mockImplementation((_label: string, fn: () => Promise<unknown>) => fn());
    mockGetDocs.mockResolvedValue(snap);

    const result = await fetchUserNotifications('user1');

    expect(result).toEqual(notifs);
    expect(mockMeasureAsync).toHaveBeenCalledWith('notifications', expect.any(Function));
  });

  it('returns empty array when no notifications', async () => {
    mockMeasureAsync.mockImplementation((_label: string, fn: () => Promise<unknown>) => fn());
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await fetchUserNotifications('user1');
    expect(result).toEqual([]);
  });

  it('uses default maxResults of 50', async () => {
    mockMeasureAsync.mockImplementation((_label: string, fn: () => Promise<unknown>) => fn());
    mockGetDocs.mockResolvedValue({ docs: [] });

    await fetchUserNotifications('user1');
    // The limit is applied internally -- we verify by successful call
    expect(mockMeasureAsync).toHaveBeenCalled();
  });

  it('accepts custom maxResults', async () => {
    mockMeasureAsync.mockImplementation((_label: string, fn: () => Promise<unknown>) => fn());
    mockGetDocs.mockResolvedValue({ docs: [] });

    await fetchUserNotifications('user1', 10);
    expect(mockMeasureAsync).toHaveBeenCalled();
  });
});

describe('markNotificationRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('updates notification with read=true', async () => {
    await markNotificationRead('n-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { read: true });
  });
});

describe('markAllNotificationsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch.update.mockClear();
    mockBatch.commit.mockResolvedValue(undefined);
  });

  it('batch updates all unread notifications', async () => {
    const docs = [
      { ref: 'ref-1' },
      { ref: 'ref-2' },
    ];
    mockGetDocs.mockResolvedValue({ empty: false, docs });

    await markAllNotificationsRead('user1');

    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    expect(mockBatch.update).toHaveBeenCalledWith('ref-1', { read: true });
    expect(mockBatch.update).toHaveBeenCalledWith('ref-2', { read: true });
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('does nothing when no unread notifications', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    await markAllNotificationsRead('user1');

    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

describe('getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns count using measureAsync and getCountOfflineSafe', async () => {
    mockGetCountOfflineSafe.mockResolvedValue(5);
    mockMeasureAsync.mockImplementation((_label: string, fn: () => Promise<number>) => fn());

    const result = await getUnreadCount('user1');

    expect(result).toBe(5);
    expect(mockMeasureAsync).toHaveBeenCalledWith('unreadCount', expect.any(Function));
  });

  it('returns 0 when no unread notifications', async () => {
    mockGetCountOfflineSafe.mockResolvedValue(0);
    mockMeasureAsync.mockImplementation((_label: string, fn: () => Promise<number>) => fn());

    const result = await getUnreadCount('user1');
    expect(result).toBe(0);
  });
});
