import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { CONFIG: 'config' },
}));

const mockGetDoc = vi.fn();
const mockDoc = vi.fn().mockReturnValue({});

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

import { fetchAppVersionConfig } from './config';

describe('fetchAppVersionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns minVersion when doc exists with that field', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ minVersion: '2.31.0' }),
    });

    const result = await fetchAppVersionConfig();
    expect(result).toEqual({ minVersion: '2.31.0' });
  });

  it('returns { minVersion: undefined } when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await fetchAppVersionConfig();
    expect(result).toEqual({ minVersion: undefined });
  });

  it('returns { minVersion: undefined } when doc exists but has no minVersion field', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    });

    const result = await fetchAppVersionConfig();
    expect(result).toEqual({ minVersion: undefined });
  });

  it('propagates network errors', async () => {
    mockGetDoc.mockRejectedValue(new Error('network error'));

    await expect(fetchAppVersionConfig()).rejects.toThrow('network error');
  });
});
