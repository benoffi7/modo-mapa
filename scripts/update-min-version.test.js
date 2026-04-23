import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock firebase-admin modules before importing the script — vitest hoists vi.mock calls.
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
  FieldValue: {
    serverTimestamp: vi.fn(() => '__SERVER_TIMESTAMP__'),
  },
}));

const { readPackageVersion, resolveVersion, run } = await import('./update-min-version.js');

describe('readPackageVersion', () => {
  it('reads version from a package.json fixture', () => {
    const dir = mkdtempSync(join(tmpdir(), 'test-pkg-'));
    const pkgPath = join(dir, 'package.json');
    writeFileSync(pkgPath, JSON.stringify({ version: '2.36.5' }));
    expect(readPackageVersion(pkgPath)).toBe('2.36.5');
  });
});

describe('resolveVersion', () => {
  it('returns pkgVersion when no --set flag is present', () => {
    expect(resolveVersion([], '2.30.0')).toBe('2.30.0');
  });

  it('returns the --set value when it is a valid semver', () => {
    expect(resolveVersion(['--set=2.36.5'], '2.30.0')).toBe('2.36.5');
  });

  it('throws when the --set value is not a valid semver', () => {
    expect(() => resolveVersion(['--set=bad'], '2.30.0')).toThrow();
  });

  it('throws when the --set value is empty', () => {
    expect(() => resolveVersion(['--set='], '2.30.0')).toThrow();
  });
});

describe('run', () => {
  let mockSet;
  let mockDoc;
  let mockDb;

  beforeEach(() => {
    mockSet = vi.fn().mockResolvedValue(undefined);
    mockDoc = vi.fn().mockReturnValue({ set: mockSet });
    mockDb = { doc: mockDoc };
  });

  it('writes minVersion and serverTimestamp to config/appVersion', async () => {
    await run({ db: mockDb, version: '2.36.5' });

    expect(mockDoc).toHaveBeenCalledWith('config/appVersion');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ minVersion: '2.36.5' }),
    );
  });

  it('includes updatedAt in the written payload', async () => {
    await run({ db: mockDb, version: '2.36.5' });

    const payload = mockSet.mock.calls[0][0];
    expect(payload).toHaveProperty('updatedAt');
  });

  it('returns the resolved version string on success', async () => {
    const result = await run({ db: mockDb, version: '2.36.5' });
    expect(result).toBe('2.36.5');
  });

  it('propagates error when doc.set rejects', async () => {
    mockSet.mockRejectedValue(new Error('write failed'));
    await expect(run({ db: mockDb, version: '2.36.5' })).rejects.toThrow('write failed');
  });
});
