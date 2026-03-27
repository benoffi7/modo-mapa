import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockCheckRateLimit,
  mockCheckModeration,
  mockIncrementCounter,
  mockTrackWrite,
  mockLogAbuse,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockCheckModeration: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
vi.mock('../../utils/moderator', () => ({
  checkModeration: (...args: unknown[]) => mockCheckModeration(...args),
}));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
}));
vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
}));

function createMockDb() {
  const db = {};
  mockGetFirestore.mockReturnValue(db);
  return { db };
}

import '../../triggers/feedback';

describe('onFeedbackCreated', () => {
  const onCreated = () => handlers['created:feedback/{feedbackId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
    mockCheckModeration.mockResolvedValue(false);
  });

  it('skips if no snapshot data', async () => {
    await onCreated()({ data: null });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('increments counter and sets pending status on normal feedback', async () => {
    createMockDb();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const snapRef = { delete: vi.fn(), update: mockUpdate };

    await onCreated()({
      data: {
        data: () => ({ userId: 'u1', message: 'Great app!' }),
        ref: snapRef,
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' });
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'feedback', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'feedback');
  });

  it('deletes feedback and logs abuse when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    createMockDb();
    const snapRef = { delete: vi.fn().mockResolvedValue(undefined), update: vi.fn() };

    await onCreated()({
      data: {
        data: () => ({ userId: 'u1', message: 'spam' }),
        ref: snapRef,
      },
    });

    expect(snapRef.delete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'u1',
        type: 'rate_limit',
        collection: 'feedback',
      }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('flags feedback when moderation detects issue', async () => {
    mockCheckModeration.mockResolvedValue(true);
    createMockDb();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const snapRef = { delete: vi.fn(), update: mockUpdate };

    await onCreated()({
      data: {
        data: () => ({ userId: 'u1', message: 'bad content' }),
        ref: snapRef,
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({ flagged: true });
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'flagged',
        collection: 'feedback',
      }),
    );
    // Should still set pending status and increment counters
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' });
    expect(mockIncrementCounter).toHaveBeenCalled();
  });

  it('passes correct rate limit config', async () => {
    createMockDb();
    const snapRef = { delete: vi.fn(), update: vi.fn().mockResolvedValue(undefined) };

    await onCreated()({
      data: {
        data: () => ({ userId: 'u1', message: 'feedback' }),
        ref: snapRef,
      },
    });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      { collection: 'feedback', limit: 5, windowType: 'daily' },
      'u1',
    );
  });

  it('moderates message text (not other fields)', async () => {
    createMockDb();
    const snapRef = { delete: vi.fn(), update: vi.fn().mockResolvedValue(undefined) };

    await onCreated()({
      data: {
        data: () => ({ userId: 'u1', message: 'check this text' }),
        ref: snapRef,
      },
    });

    expect(mockCheckModeration).toHaveBeenCalledWith(expect.anything(), 'check this text');
  });
});
