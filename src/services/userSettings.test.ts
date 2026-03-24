import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { USER_SETTINGS: 'userSettings' } }));
vi.mock('../config/converters', () => ({ userSettingsConverter: {} }));
vi.mock('../utils/perfMetrics', () => ({ measureAsync: (_: string, fn: () => unknown) => fn() }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
}));

import { fetchUserSettings, updateUserSettings, DEFAULT_SETTINGS } from './userSettings';

describe('userSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('fetchUserSettings', () => {
    it('returns stored settings when document exists', async () => {
      const stored = { ...DEFAULT_SETTINGS, profilePublic: true };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => stored });
      const result = await fetchUserSettings('u1');
      expect(result.profilePublic).toBe(true);
    });

    it('returns defaults when document does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const result = await fetchUserSettings('u1');
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateUserSettings', () => {
    it('merges updates when document exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });
      await updateUserSettings('u1', { profilePublic: true });
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        { profilePublic: true, updatedAt: 'SERVER_TS' },
        { merge: true },
      );
    });

    it('sends all fields on first write', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      await updateUserSettings('u1', { analyticsEnabled: true });
      const [, data] = mockSetDoc.mock.calls[0];
      expect(data.analyticsEnabled).toBe(true);
      expect(data.profilePublic).toBe(false);
      expect(data.notificationsEnabled).toBe(false);
      expect(data.updatedAt).toBe('SERVER_TS');
      // Should NOT have merge option
      expect(mockSetDoc.mock.calls[0][2]).toBeUndefined();
    });
  });
});
