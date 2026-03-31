import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withCronHeartbeat } from '../../utils/cronHeartbeat';

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue({ set: mockSet });

vi.mock('../../helpers/env', () => ({
  getDb: () => ({ doc: mockDoc }),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

describe('withCronHeartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes success heartbeat with detail string', async () => {
    const fn = vi.fn().mockResolvedValue('Cleaned up 12 photos');

    await withCronHeartbeat('cleanupPhotos', fn);

    expect(mockDoc).toHaveBeenCalledWith('_cronRuns/cleanupPhotos');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastRunAt: 'SERVER_TIMESTAMP',
        result: 'success',
        detail: 'Cleaned up 12 photos',
        durationMs: expect.any(Number),
      }),
      { merge: true },
    );
  });

  it('writes success heartbeat with empty detail when fn returns void', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);

    await withCronHeartbeat('dailyMetrics', fn);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'success',
        detail: '',
      }),
      { merge: true },
    );
  });

  it('writes error heartbeat and re-throws on failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('DB timeout'));

    await expect(withCronHeartbeat('trending', fn)).rejects.toThrow('DB timeout');

    expect(mockDoc).toHaveBeenCalledWith('_cronRuns/trending');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        detail: 'DB timeout',
        durationMs: expect.any(Number),
      }),
      { merge: true },
    );
  });

  it('calculates durationMs correctly', async () => {
    const fn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50)),
    );

    await withCronHeartbeat('test', fn);

    const call = mockSet.mock.calls[0][0];
    expect(call.durationMs).toBeGreaterThanOrEqual(40);
    expect(call.durationMs).toBeLessThan(500);
  });

  it('still re-throws original error even if heartbeat write fails', async () => {
    mockSet.mockRejectedValueOnce(new Error('Firestore down'));
    const fn = vi.fn().mockRejectedValue(new Error('Original error'));

    await expect(withCronHeartbeat('broken', fn)).rejects.toThrow('Original error');
  });
});
