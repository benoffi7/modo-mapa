import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  displayName: string | null;
  setDisplayName: (name: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  displayName: null,
  setDisplayName: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setDisplayNameState(userDoc.data().displayName || null);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Error signing in anonymously:', error);
        }
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const setDisplayName = async (name: string) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), {
      displayName: name,
      createdAt: serverTimestamp(),
    }, { merge: true });
    setDisplayNameState(name);
  };

  return (
    <AuthContext.Provider value={{ user, displayName, setDisplayName, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
