import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallableFn = vi.fn();
const mockHttpsCallable = vi.fn().mockReturnValue(mockCallableFn);

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

vi.mock('../config/firebase', () => ({ functions: {} }));

import { approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto } from './adminPhotos';

describe('adminPhotos service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallableFn.mockResolvedValue({});
  });

  it('approveMenuPhoto calls approveMenuPhoto callable with photoId', async () => {
    await approveMenuPhoto('photo-1');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'approveMenuPhoto');
    expect(mockCallableFn).toHaveBeenCalledWith({ photoId: 'photo-1' });
  });

  it('rejectMenuPhoto calls rejectMenuPhoto callable with photoId and reason', async () => {
    await rejectMenuPhoto('photo-2', 'inappropriate');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'rejectMenuPhoto');
    expect(mockCallableFn).toHaveBeenCalledWith({ photoId: 'photo-2', reason: 'inappropriate' });
  });

  it('deleteMenuPhoto calls deleteMenuPhoto callable with photoId', async () => {
    await deleteMenuPhoto('photo-3');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteMenuPhoto');
    expect(mockCallableFn).toHaveBeenCalledWith({ photoId: 'photo-3' });
  });

  it('approveMenuPhoto propagates errors', async () => {
    mockCallableFn.mockRejectedValue(new Error('callable error'));

    await expect(approveMenuPhoto('photo-1')).rejects.toThrow('callable error');
  });
});
