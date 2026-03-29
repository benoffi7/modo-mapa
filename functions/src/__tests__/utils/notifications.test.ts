import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---
const { mockServerTimestamp } = vi.hoisted(() => ({
  mockServerTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: mockServerTimestamp },
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: vi.fn().mockResolvedValue(undefined),
}));

import { createNotification } from '../../utils/notifications';

// --- DB mock helper ---

function createMockDb(userSettingsData?: Record<string, unknown> | null, recentNotifCount = 0) {
  const mockAdd = vi.fn().mockResolvedValue({ id: 'notif1' });

  const mockGet = vi.fn().mockResolvedValue(
    userSettingsData === null
      ? { exists: false, data: () => undefined }
      : { exists: true, data: () => userSettingsData },
  );

  const mockCountGet = vi.fn().mockResolvedValue({ data: () => ({ count: recentNotifCount }) });
  const mockCount = vi.fn().mockReturnValue({ get: mockCountGet });
  const mockWhereObj: Record<string, unknown> = { add: mockAdd, count: mockCount };
  const mockWhere = vi.fn().mockReturnValue(mockWhereObj);
  mockWhereObj.where = mockWhere;

  const mockDoc = vi.fn().mockReturnValue({ get: mockGet });
  const mockCollection = vi.fn().mockReturnValue({ add: mockAdd, where: mockWhere });

  const db = { doc: mockDoc, collection: mockCollection };
  return { db: db as never, mockAdd, mockGet, mockDoc };
}

describe('createNotification — shouldNotify preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT notify when no userSettings doc exists', async () => {
    const { db, mockAdd } = createMockDb(null);

    await createNotification(db, {
      userId: 'u1',
      type: 'like',
      message: 'Someone liked your comment',
    });

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('does NOT notify when master toggle is off', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: false,
      notifyLikes: true,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'like',
      message: 'Someone liked your comment',
    });

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('does NOT notify when master is on but per-type toggle is off', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyLikes: false,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'like',
      message: 'Someone liked your comment',
    });

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('creates notification when both master and per-type are enabled', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyLikes: true,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'like',
      message: 'Someone liked your comment',
      actorId: 'u2',
      actorName: 'Juan',
      businessId: 'b1',
      referenceId: 'c1',
    });

    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      type: 'like',
      message: 'Someone liked your comment',
      read: false,
      actorId: 'u2',
      actorName: 'Juan',
      businessId: 'b1',
      referenceId: 'c1',
    }));
  });

  it('respects photo_approved type → notifyPhotos setting', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyPhotos: true,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'photo_approved',
      message: 'Tu foto fue aprobada',
    });

    expect(mockAdd).toHaveBeenCalled();
  });

  it('respects photo_rejected type → notifyPhotos setting', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyPhotos: false,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'photo_rejected',
      message: 'Tu foto fue rechazada',
    });

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('respects ranking type → notifyRankings setting', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyRankings: true,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'ranking',
      message: 'Subiste al top 3',
    });

    expect(mockAdd).toHaveBeenCalled();
  });

  it('omits optional fields when not provided', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyLikes: true,
    });

    await createNotification(db, {
      userId: 'u1',
      type: 'like',
      message: 'Like received',
    });

    const call = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('actorId');
    expect(call).not.toHaveProperty('businessId');
    expect(call).not.toHaveProperty('referenceId');
  });

  it('sets expiresAt to 30 days from now', async () => {
    const { db, mockAdd } = createMockDb({
      notificationsEnabled: true,
      notifyLikes: true,
    });

    const before = new Date();
    await createNotification(db, {
      userId: 'u1',
      type: 'like',
      message: 'Test',
    });

    const call = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    const expiresAt = call.expiresAt as Date;
    // Should be ~30 days from now
    const diffDays = (expiresAt.getTime() - before.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThanOrEqual(30.1);
  });
});
