import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/firebase', () => ({ functions: {} }));

const mockCallableFn = vi.fn();
const mockHttpsCallable = vi.fn<(f: unknown, n: string) => typeof mockCallableFn>(
  () => mockCallableFn,
);

vi.mock('firebase/functions', () => ({
  httpsCallable: (functions: unknown, name: string) => mockHttpsCallable(functions, name),
}));

describe('adminClaims module bindings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('binds setAdminClaim via httpsCallable(functions, "setAdminClaim")', async () => {
    await import('../adminClaims');

    expect(mockHttpsCallable).toHaveBeenCalledTimes(1);
    expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'setAdminClaim');
  });

  it('invoking setAdminClaim forwards the payload to the underlying callable', async () => {
    mockCallableFn.mockResolvedValueOnce({ data: undefined });

    const { setAdminClaim } = await import('../adminClaims');
    await setAdminClaim({ targetUid: 'uid-1' });

    expect(mockCallableFn).toHaveBeenCalledWith({ targetUid: 'uid-1' });
  });

  it('propagates callable errors to the caller', async () => {
    mockCallableFn.mockRejectedValueOnce(new Error('permission-denied'));

    const { setAdminClaim } = await import('../adminClaims');

    await expect(setAdminClaim({ targetUid: 'uid-err' })).rejects.toThrow(
      'permission-denied',
    );
  });
});
