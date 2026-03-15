import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initAnalytics } from '../utils/analytics';
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missing = requiredEnvVars.filter((key) => !import.meta.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Named database support: VITE_FIRESTORE_DATABASE_ID overrides the default DB.
// Used for staging environment (named DB "staging" in same Firebase project).
const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;

// DEV: getFirestore estándar (emuladores no soportan persistent cache)
// PROD: persistent cache en IndexedDB para reducir reads de Firestore
export const db = import.meta.env.DEV
  ? getFirestore(app, databaseId)
  : initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }, databaseId);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
} else {
  // App Check obligatorio en producción — los emuladores y staging no lo necesitan.
  // Requiere configurar reCAPTCHA Enterprise en Firebase Console (ver docs/SECURITY_GUIDELINES.md).
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (recaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

initAnalytics(app);
