import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

const mockUser = { uid: 'test-uid-123' };

let authStateCallback: ((user: unknown) => void) | null = null;
const mockSignInAnonymously = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

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
  auth: {},
  db: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { USERS: 'users' },
}));

vi.mock('../config/converters', () => ({
  userProfileConverter: {},
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
  });

  describe('initial state', () => {
    it('starts with isLoading true and user null', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.displayName).toBeNull();
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
});
