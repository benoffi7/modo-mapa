import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { userProfileConverter } from '../config/converters';
import { setUserProperty } from '../utils/analytics';

interface AuthContextType {
  user: User | null;
  displayName: string | null;
  setDisplayName: (name: string) => Promise<void>;
  isLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  displayName: null,
  setDisplayName: async () => {},
  isLoading: true,
  authError: null,
  signInWithGoogle: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setUserProperty('auth_type', firebaseUser.isAnonymous ? 'anonymous' : 'google');
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
    const trimmed = name.trim().slice(0, 30);
    if (!trimmed) return;
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      // Update: only change displayName, preserve original createdAt
      await updateDoc(userRef, { displayName: trimmed });
    } else {
      // Create: set both displayName and createdAt
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

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error signing out:', error);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user, displayName, setDisplayName, isLoading, authError, signInWithGoogle, signOut,
  }), [user, displayName, setDisplayName, isLoading, authError, signInWithGoogle, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
