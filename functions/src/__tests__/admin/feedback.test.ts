import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetDb,
  mockAssertAdmin,
  mockCreateNotification,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: unknown) => Promise<unknown>) | null>,
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
}));

const callIndex = vi.hoisted(() => ({ value: 0 }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, fn: (request: unknown) => Promise<unknown>) => {
    const names = ['respondToFeedback', 'resolveFeedback', 'createGithubIssueFromFeedback'];
    handlers[names[callIndex.value++]] = fn;
    return fn;
  },
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
}));

vi.mock('firebase-functions/params', () => ({
  defineString: vi.fn().mockReturnValue({ value: () => 'test-value' }),
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: unknown[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

function createMockDb(overrides?: {
  feedbackExists?: boolean;
  feedbackData?: Record<string, unknown>;
}) {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);

  const feedbackData = overrides?.feedbackData ?? {
    userId: 'user1',
    message: 'Great app!',
    category: 'sugerencia',
    status: 'pending',
  };

  const mockDocRef = {
    get: vi.fn().mockResolvedValue({
      exists: overrides?.feedbackExists ?? true,
      data: () => feedbackData,
    }),
    update: mockUpdate,
  };

  const mockCollection = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue(mockDocRef),
  });

  const db = { collection: mockCollection };
  mockGetDb.mockReturnValue(db);

  return { db, mockUpdate, mockDocRef };
}

import '../../admin/feedback';

describe('respondToFeedback', () => {
  const handler = () => handlers.respondToFeedback!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing feedbackId', async () => {
    await expect(handler()({ auth: { uid: 'admin1', token: {} }, data: { response: 'thanks' } }))
      .rejects.toThrow('feedbackId required');
  });

  it('throws on missing response', async () => {
    await expect(handler()({ auth: { uid: 'admin1', token: {} }, data: { feedbackId: 'f1' } }))
      .rejects.toThrow(/response must be/);
  });

  it('throws on response exceeding 500 chars', async () => {
    const longResponse = 'x'.repeat(501);
    await expect(handler()({
      auth: { uid: 'admin1', token: {} },
      data: { feedbackId: 'f1', response: longResponse },
    })).rejects.toThrow(/response must be/);
  });

  it('throws when feedback not found', async () => {
    createMockDb({ feedbackExists: false });
    await expect(handler()({
      auth: { uid: 'admin1', token: { email: 'admin@test.com' } },
      data: { feedbackId: 'f1', response: 'Thanks!' },
    })).rejects.toThrow('Feedback not found');
  });

  it('responds to feedback and notifies user', async () => {
    const { mockUpdate } = createMockDb();
    const result = await handler()({
      auth: { uid: 'admin1', token: { email: 'admin@test.com' } },
      data: { feedbackId: 'f1', response: 'We are working on it' },
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'responded',
      adminResponse: 'We are working on it',
    }));
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user1',
        type: 'feedback_response',
      }),
    );
  });
});

describe('resolveFeedback', () => {
  const handler = () => handlers.resolveFeedback!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing feedbackId', async () => {
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} }))
      .rejects.toThrow('feedbackId required');
  });

  it('throws when feedback not found', async () => {
    createMockDb({ feedbackExists: false });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { feedbackId: 'f1' } }))
      .rejects.toThrow('Feedback not found');
  });

  it('resolves feedback and notifies user', async () => {
    const { mockUpdate } = createMockDb();
    const result = await handler()({ auth: { uid: 'admin1' }, data: { feedbackId: 'f1' } });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'resolved' });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user1',
        type: 'feedback_response',
        message: expect.stringContaining('resuelto'),
      }),
    );
  });
});

describe('createGithubIssueFromFeedback', () => {
  const handler = () => handlers.createGithubIssueFromFeedback!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on missing feedbackId', async () => {
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} }))
      .rejects.toThrow('feedbackId required');
  });

  it('throws when feedback not found', async () => {
    createMockDb({ feedbackExists: false });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { feedbackId: 'f1' } }))
      .rejects.toThrow('Feedback not found');
  });

  it('throws when GitHub issue already created', async () => {
    createMockDb({ feedbackData: { userId: 'u1', githubIssueUrl: 'https://github.com/issue/1' } });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { feedbackId: 'f1' } }))
      .rejects.toThrow('GitHub issue already created');
  });

  it('throws when GITHUB_TOKEN not configured', async () => {
    const originalEnv = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    createMockDb({ feedbackData: { userId: 'u1', message: 'test', category: 'bug' } });
    await expect(handler()({ auth: { uid: 'admin1' }, data: { feedbackId: 'f1' } }))
      .rejects.toThrow('GITHUB_TOKEN not configured');

    process.env.GITHUB_TOKEN = originalEnv;
  });
});
