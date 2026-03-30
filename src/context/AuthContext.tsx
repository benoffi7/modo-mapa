import { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
import { setUserProperty, trackEvent } from '../utils/analytics';
import { MAX_DISPLAY_NAME_LENGTH } from '../constants/validation';
import { logger } from '../utils/logger';
import { getAvatarById } from '../constants/avatars';
import {
  linkAnonymousWithEmail,
  signInWithEmail as signInWithEmailService,
  signOutAndReset,
  getAuthErrorMessage,
  resendVerificationEmail,
  changePassword as changePasswordService,
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
  avatarId: string | null;
  setAvatarId: (id: string) => Promise<void>;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  authMethod: AuthMethod;
  emailVerified: boolean;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshEmailVerified: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  displayName: null,
  setDisplayName: async () => {},
  avatarId: null,
  setAvatarId: async () => {},
  isLoading: true,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => null,
  signOut: async () => {},
  authMethod: 'anonymous',
  emailVerified: false,
  linkEmailPassword: async () => {},
  signInWithEmail: async () => {},
  resendVerification: async () => {},
  refreshEmailVerified: async () => false,
  changePassword: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [avatarId, setAvatarIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('anonymous');
  const [emailVerified, setEmailVerified] = useState(false);
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

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
          const data = userDoc.data();
          setDisplayNameState(data.displayName || null);
          setAvatarIdState(data.avatarId ?? null);
        }
      } else {
        const isAdminRoute = pathnameRef.current.startsWith('/admin');
        if (isAdminRoute) {
          setUser(null);
        } else {
          try {
            await signInAnonymously(auth);
          } catch (error) {
            if (import.meta.env.DEV) logger.error('Error signing in anonymously:', error);
          }
        }
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    if (!user) return;
    const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    if (!trimmed) return;
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, { displayName: trimmed, displayNameLower: trimmed.toLowerCase() });
    } else {
      await setDoc(userRef, {
        displayName: trimmed,
        displayNameLower: trimmed.toLowerCase(),
        createdAt: serverTimestamp(),
      });
    }
    setDisplayNameState(trimmed);
  }, [user]);

  const setAvatarId = useCallback(async (id: string) => {
    if (!user) return;
    if (!getAvatarById(id)) return;
    const prev = avatarId;
    setAvatarIdState(id);
    try {
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);
      await updateDoc(userRef, { avatarId: id });
    } catch (error) {
      setAvatarIdState(prev);
      if (import.meta.env.DEV) logger.error('Error setting avatar:', error);
    }
  }, [user, avatarId]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google';
      setAuthError(message);
      if (import.meta.env.DEV) logger.error('Error signing in with Google:', error);
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
      trackEvent('account_created', { method: 'email' });
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
      trackEvent('email_sign_in');
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw error;
    }
  }, []);

  const resendVerification = useCallback(async (): Promise<void> => {
    if (!user) throw new Error('No user');
    try {
      await resendVerificationEmail(user);
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw error;
    }
  }, [user]);

  const refreshEmailVerified = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    await user.reload();
    const refreshed = auth.currentUser;
    const verified = refreshed?.emailVerified ?? false;
    setEmailVerified(verified);
    return verified;
  }, [user]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user) throw new Error('No user');
    setAuthError(null);
    try {
      await changePasswordService(user, currentPassword, newPassword);
      trackEvent('password_changed');
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw error;
    }
  }, [user]);

  const signOut = useCallback(async (): Promise<void> => {
    const previousMethod = authMethod;
    try {
      await signOutAndReset();
      trackEvent('sign_out', { method: previousMethod });
    } catch (error) {
      if (import.meta.env.DEV) logger.error('Error signing out:', error);
    }
  }, [authMethod]);

  const value = useMemo<AuthContextType>(() => ({
    user, displayName, setDisplayName, avatarId, setAvatarId, isLoading, authError, clearAuthError, signInWithGoogle, signOut,
    authMethod, emailVerified, linkEmailPassword, signInWithEmail,
    resendVerification, refreshEmailVerified, changePassword,
  }), [user, displayName, setDisplayName, avatarId, setAvatarId, isLoading, authError, clearAuthError, signInWithGoogle, signOut,
    authMethod, emailVerified, linkEmailPassword, signInWithEmail,
    resendVerification, refreshEmailVerified, changePassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
