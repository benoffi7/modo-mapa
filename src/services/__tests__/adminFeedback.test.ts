import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/firebase', () => ({ functions: {} }));

const mockCallableFn = vi.fn();
const mockHttpsCallable = vi.fn<(f: unknown, n: string) => typeof mockCallableFn>(
  () => mockCallableFn,
);

vi.mock('firebase/functions', () => ({
  httpsCallable: (functions: unknown, name: string) => mockHttpsCallable(functions, name),
}));

describe('adminFeedback module bindings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('binds three callables (respondToFeedback, resolveFeedback, createGithubIssueFromFeedback) at import time', async () => {
    await import('../adminFeedback');

    expect(mockHttpsCallable).toHaveBeenCalledTimes(3);
    const callableNames = mockHttpsCallable.mock.calls.map(([, name]) => name);
    expect(callableNames).toEqual([
      'respondToFeedback',
      'resolveFeedback',
      'createGithubIssueFromFeedback',
    ]);
    // Each call passes the functions instance as first arg
    for (const call of mockHttpsCallable.mock.calls) {
      expect(call[0]).toEqual({});
    }
  });

  it('respondToFeedback forwards { feedbackId, response } payload', async () => {
    mockCallableFn.mockResolvedValueOnce({ data: undefined });

    const { respondToFeedback } = await import('../adminFeedback');
    await respondToFeedback({ feedbackId: 'fb-1', response: 'thanks' });

    expect(mockCallableFn).toHaveBeenCalledWith({ feedbackId: 'fb-1', response: 'thanks' });
  });

  it('resolveFeedback forwards { feedbackId } payload', async () => {
    mockCallableFn.mockResolvedValueOnce({ data: undefined });

    const { resolveFeedback } = await import('../adminFeedback');
    await resolveFeedback({ feedbackId: 'fb-2' });

    expect(mockCallableFn).toHaveBeenCalledWith({ feedbackId: 'fb-2' });
  });

  it('createGithubIssueFromFeedback returns { issueUrl } from the callable response', async () => {
    mockCallableFn.mockResolvedValueOnce({
      data: { issueUrl: 'https://github.com/org/repo/issues/42' },
    });

    const { createGithubIssueFromFeedback } = await import('../adminFeedback');
    const result = await createGithubIssueFromFeedback({ feedbackId: 'fb-3' });

    expect(mockCallableFn).toHaveBeenCalledWith({ feedbackId: 'fb-3' });
    expect(result.data.issueUrl).toBe('https://github.com/org/repo/issues/42');
  });

  it('propagates callable errors to the caller', async () => {
    mockCallableFn.mockRejectedValueOnce(new Error('functions/internal'));

    const { resolveFeedback } = await import('../adminFeedback');
    await expect(resolveFeedback({ feedbackId: 'fb-err' })).rejects.toThrow(
      'functions/internal',
    );
  });
});
