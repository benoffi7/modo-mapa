import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

const mockUser = { uid: 'test-uid-123', isAnonymous: true, providerData: [], emailVerified: false, reload: vi.fn() };

let authStateCallback: ((user: unknown) => void) | null = null;
const mockSignInAnonymously = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockLinkAnonymousWithEmail = vi.fn();
const mockSignInWithEmailService = vi.fn();
const mockSignOutAndReset = vi.fn();
const mockResendVerificationEmail = vi.fn();
const mockChangePasswordService = vi.fn();

vi.mock('firebase/auth', () => ({
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    authStateCallback = cb;
    return vi.fn();
  },
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

const mockDocRef = {
  withConverter: vi.fn(() => mockDocRef),
};

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => mockDocRef),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { USERS: 'users' },
}));

vi.mock('../config/converters', () => ({
  userProfileConverter: {},
}));

vi.mock('../services/emailAuth', () => ({
  linkAnonymousWithEmail: (...args: unknown[]) => mockLinkAnonymousWithEmail(...args),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmailService(...args),
  signOutAndReset: (...args: unknown[]) => mockSignOutAndReset(...args),
  resendVerificationEmail: (...args: unknown[]) => mockResendVerificationEmail(...args),
  changePassword: (...args: unknown[]) => mockChangePasswordService(...args),
  getAuthErrorMessage: (error: unknown) => {
    if (error instanceof Error && 'code' in error) {
      const code = (error as { code: string }).code;
      if (code === 'auth/email-already-in-use') return 'No se pudo crear la cuenta. Si ya tenés una, intentá iniciar sesión.';
      if (code === 'auth/invalid-credential') return 'Email o contraseña incorrectos.';
      if (code === 'auth/wrong-password') return 'Contraseña actual incorrecta.';
    }
    return 'Ocurrió un error. Intentá de nuevo.';
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSignInAnonymously.mockResolvedValue({ user: mockUser });
    mockLinkAnonymousWithEmail.mockResolvedValue(undefined);
    mockSignInWithEmailService.mockResolvedValue({ user: { uid: 'email-uid' } });
    mockSignOutAndReset.mockResolvedValue(undefined);
    mockResendVerificationEmail.mockResolvedValue(undefined);
    mockChangePasswordService.mockResolvedValue(undefined);
    mockUser.reload.mockResolvedValue(undefined);
  });

  describe('initial state', () => {
    it('starts with isLoading true and user null', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.displayName).toBeNull();
      expect(result.current.authMethod).toBe('anonymous');
      expect(result.current.emailVerified).toBe(false);
    });
  });

  describe('auth flow', () => {
    it('calls signInAnonymously when no user', async () => {
      renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(null);
      });

      expect(mockSignInAnonymously).toHaveBeenCalled();
    });

    it('sets user when auth state changes to authenticated', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('loads displayName from Firestore when user doc exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'Juan' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.displayName).toBe('Juan');
      });
    });

    it('keeps displayName null when user doc does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.displayName).toBeNull();
      });
    });
  });

  describe('authMethod', () => {
    it('returns "anonymous" for anonymous user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.({ ...mockUser, isAnonymous: true, providerData: [] });
      });

      await waitFor(() => {
        expect(result.current.authMethod).toBe('anonymous');
      });
    });

    it('returns "email" for email/password user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.({
          uid: 'email-uid',
          isAnonymous: false,
          providerData: [{ providerId: 'password' }],
          emailVerified: true,
        });
      });

      await waitFor(() => {
        expect(result.current.authMethod).toBe('email');
        expect(result.current.emailVerified).toBe(true);
      });
    });

    it('returns "google" for google user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.({
          uid: 'google-uid',
          isAnonymous: false,
          providerData: [{ providerId: 'google.com' }],
          emailVerified: true,
        });
      });

      await waitFor(() => {
        expect(result.current.authMethod).toBe('google');
      });
    });
  });

  describe('linkEmailPassword', () => {
    it('links anonymous user with email/password', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await result.current.linkEmailPassword('test@example.com', 'password123');
      });

      expect(mockLinkAnonymousWithEmail).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'test-uid-123' }),
        'test@example.com',
        'password123',
      );
    });

    it('sets authError on failure', async () => {
      mockLinkAnonymousWithEmail.mockRejectedValue(
        Object.assign(new Error('fail'), { code: 'auth/email-already-in-use' }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await expect(result.current.linkEmailPassword('test@example.com', 'pass'))
          .rejects.toThrow('fail');
      });

      expect(result.current.authError).toBe('No se pudo crear la cuenta. Si ya tenés una, intentá iniciar sesión.');
    });
  });

  describe('signInWithEmail', () => {
    it('signs in with email/password', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithEmail('test@example.com', 'password123');
      });

      expect(mockSignInWithEmailService).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('sets authError on wrong credentials', async () => {
      mockSignInWithEmailService.mockRejectedValue(
        Object.assign(new Error('fail'), { code: 'auth/invalid-credential' }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await expect(result.current.signInWithEmail('test@example.com', 'wrong'))
          .rejects.toThrow('fail');
      });

      expect(result.current.authError).toBe('Email o contraseña incorrectos.');
    });
  });

  describe('signOut', () => {
    it('calls signOutAndReset', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOutAndReset).toHaveBeenCalled();
    });
  });

  describe('setDisplayName', () => {
    it('creates new user doc with createdAt when doc does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await result.current.setDisplayName('  María  ');
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        mockDocRef,
        { displayName: 'María', createdAt: 'server-timestamp' },
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(result.current.displayName).toBe('María');
    });

    it('updates existing user doc without overwriting createdAt', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'Old Name' }),
      });
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await result.current.setDisplayName('  María  ');
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        mockDocRef,
        { displayName: 'María' },
      );
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(result.current.displayName).toBe('María');
    });

    it('truncates name to 30 characters', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      const longName = 'A'.repeat(50);
      await act(async () => {
        await result.current.setDisplayName(longName);
      });

      expect(result.current.displayName).toBe('A'.repeat(30));
    });

    it('rejects empty/whitespace-only name', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await result.current.setDisplayName('   ');
      });

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('does nothing when user is null', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.setDisplayName('Test');
      });

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('calls resendVerificationEmail', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await result.current.resendVerification();
      });

      expect(mockResendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'test-uid-123' }),
      );
    });
  });

  describe('refreshEmailVerified', () => {
    it('reloads user and returns emailVerified status', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        const verified = await result.current.refreshEmailVerified();
        expect(verified).toBe(false);
      });

      expect(mockUser.reload).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('calls changePassword service', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await result.current.changePassword('oldpass', 'newpass123');
      });

      expect(mockChangePasswordService).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'test-uid-123' }),
        'oldpass',
        'newpass123',
      );
    });

    it('sets authError on wrong current password', async () => {
      mockChangePasswordService.mockRejectedValue(
        Object.assign(new Error('fail'), { code: 'auth/wrong-password' }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await act(async () => {
        await expect(result.current.changePassword('wrong', 'newpass'))
          .rejects.toThrow('fail');
      });

      expect(result.current.authError).toBe('Contraseña actual incorrecta.');
    });
  });
});
