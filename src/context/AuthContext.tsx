import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { userProfileConverter } from '../config/converters';
import { setUserProperty } from '../utils/analytics';
import { MAX_DISPLAY_NAME_LENGTH } from '../constants/validation';
import {
  linkAnonymousWithEmail,
  signInWithEmail as signInWithEmailService,
  signOutAndReset,
  getAuthErrorMessage,
} from '../services/emailAuth';

export type AuthMethod = 'anonymous' | 'email' | 'google';

function getAuthMethod(user: User | null): AuthMethod {
  if (!user || user.isAnonymous) return 'anonymous';
  const providers = user.providerData.map((p) => p.providerId);
  if (providers.includes('password')) return 'email';
  if (providers.includes('google.com')) return 'google';
  return 'anonymous';
}

interface AuthContextType {
  user: User | null;
  displayName: string | null;
  setDisplayName: (name: string) => Promise<void>;
  isLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  authMethod: AuthMethod;
  emailVerified: boolean;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  displayName: null,
  setDisplayName: async () => {},
  isLoading: true,
  authError: null,
  signInWithGoogle: async () => null,
  signOut: async () => {},
  authMethod: 'anonymous',
  emailVerified: false,
  linkEmailPassword: async () => {},
  signInWithEmail: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('anonymous');
  const [emailVerified, setEmailVerified] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const method = getAuthMethod(firebaseUser);
        setAuthMethod(method);
        setEmailVerified(firebaseUser.emailVerified);
        setUserProperty('auth_type', method);
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid).withConverter(userProfileConverter));
        if (userDoc.exists()) {
          setDisplayNameState(userDoc.data().displayName || null);
        }
      } else {
        const isAdminRoute = location.pathname.startsWith('/admin');
        if (isAdminRoute) {
          setUser(null);
        } else {
          try {
            await signInAnonymously(auth);
          } catch (error) {
            if (import.meta.env.DEV) console.error('Error signing in anonymously:', error);
          }
        }
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, [location.pathname]);

  const setDisplayName = useCallback(async (name: string) => {
    if (!user) return;
    const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    if (!trimmed) return;
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, { displayName: trimmed });
    } else {
      await setDoc(userRef, {
        displayName: trimmed,
        createdAt: serverTimestamp(),
      });
    }
    setDisplayNameState(trimmed);
  }, [user]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al iniciar sesión con Google';
      setAuthError(message);
      if (import.meta.env.DEV) console.error('Error signing in with Google:', error);
      return null;
    }
  }, []);

  const linkEmailPassword = useCallback(async (email: string, password: string): Promise<void> => {
    if (!user) throw new Error('No user');
    setAuthError(null);
    try {
      await linkAnonymousWithEmail(user, email, password);
      await user.reload();
      const refreshed = auth.currentUser;
      if (refreshed) {
        setUser(refreshed);
        setAuthMethod(getAuthMethod(refreshed));
        setEmailVerified(refreshed.emailVerified);
      }
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw error;
    }
  }, [user]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<void> => {
    setAuthError(null);
    try {
      await signInWithEmailService(email, password);
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await signOutAndReset();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error signing out:', error);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user, displayName, setDisplayName, isLoading, authError, signInWithGoogle, signOut,
    authMethod, emailVerified, linkEmailPassword, signInWithEmail,
  }), [user, displayName, setDisplayName, isLoading, authError, signInWithGoogle, signOut,
    authMethod, emailVerified, linkEmailPassword, signInWithEmail]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
