import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env module to control IS_EMULATOR
const mockIsEmulator = vi.hoisted(() => ({ value: false }));

vi.mock('../../helpers/env', () => ({
  get IS_EMULATOR() {
    return mockIsEmulator.value;
  },
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { assertAdmin } from '../../helpers/assertAdmin';

describe('assertAdmin', () => {
  beforeEach(() => {
    mockIsEmulator.value = false;
  });

  describe('production mode', () => {
    it('throws unauthenticated when no auth provided', () => {
      expect(() => assertAdmin(undefined)).toThrow('Must be signed in');
    });

    it('throws permission-denied when token.admin is not true', () => {
      expect(() => assertAdmin({ uid: 'u1', token: { admin: false } })).toThrow('Admin only');
    });

    it('throws permission-denied when token has no admin claim', () => {
      expect(() => assertAdmin({ uid: 'u1', token: {} })).toThrow('Admin only');
    });

    it('returns auth when admin claim is true', () => {
      const auth = { uid: 'u1', token: { admin: true } };
      expect(assertAdmin(auth)).toBe(auth);
    });
  });

  describe('emulator mode', () => {
    beforeEach(() => {
      mockIsEmulator.value = true;
    });

    it('returns provided auth in emulator', () => {
      const auth = { uid: 'u1', token: { admin: true } };
      expect(assertAdmin(auth)).toBe(auth);
    });

    it('returns stub admin when no auth in emulator', () => {
      const result = assertAdmin(undefined);
      expect(result.uid).toBe('emulator-admin');
      expect(result.token.admin).toBe(true);
    });
  });
});
