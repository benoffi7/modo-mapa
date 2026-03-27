import {
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  updatePassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AUTH_ERRORS } from '../constants/auth';
import {
  STORAGE_KEY_VISITS,
  STORAGE_KEY_ONBOARDING_CREATED_AT,
  STORAGE_KEY_ONBOARDING_COMPLETED,
  STORAGE_KEY_ONBOARDING_DISMISSED,
  STORAGE_KEY_ONBOARDING_RANKING_VIEWED,
  STORAGE_KEY_ONBOARDING_CELEBRATED,
  STORAGE_KEY_ONBOARDING_EXPANDED,
  STORAGE_KEY_HINT_POST_FIRST_RATING,
  STORAGE_KEY_HINT_POST_FIRST_COMMENT,
  STORAGE_KEY_ACCOUNT_BANNER_DISMISSED,
  STORAGE_KEY_BENEFITS_SHOWN,
  STORAGE_KEY_ACTIVITY_REMINDER_SHOWN,
  STORAGE_KEY_ANON_RATING_COUNT,
  STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED,
  STORAGE_KEY_REMEMBERED_EMAIL,
} from '../constants/storage';
import { invalidateAllQueryCache } from './queryCache';
import { clearAllBusinessCache } from '../hooks/useBusinessDataCache';

/** Traduce un error de Firebase Auth a un mensaje en español */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    const code = (error as { code: string }).code;
    return AUTH_ERRORS[code] ?? AUTH_ERRORS.default;
  }
  return AUTH_ERRORS.default;
}

/**
 * Vincula la cuenta anónima actual con email/password.
 * El UID NO cambia — los datos del usuario se preservan.
 */
export async function linkAnonymousWithEmail(
  currentUser: User,
  email: string,
  password: string,
): Promise<void> {
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(currentUser, credential);
  await sendEmailVerification(result.user);
}

/**
 * Inicia sesión con email/password desde otro dispositivo.
 * Reemplaza la sesión anónima temporal.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Re-envía el email de verificación al usuario actual.
 */
export async function resendVerificationEmail(currentUser: User): Promise<void> {
  await sendEmailVerification(currentUser);
}

/**
 * Envía un email para restablecer la contraseña.
 */
export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Cambia la contraseña del usuario.
 * Requiere re-autenticación con la contraseña actual.
 */
export async function changePassword(
  currentUser: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, newPassword);
}

/**
 * Cierra sesión y limpia estado local transient.
 * signInAnonymously se dispara automáticamente via onAuthStateChanged.
 */
export async function signOutAndReset(): Promise<void> {
  await firebaseSignOut(auth);
  localStorage.removeItem(STORAGE_KEY_VISITS);
}

const USER_STORAGE_KEYS = [
  STORAGE_KEY_VISITS,
  STORAGE_KEY_ONBOARDING_CREATED_AT,
  STORAGE_KEY_ONBOARDING_COMPLETED,
  STORAGE_KEY_ONBOARDING_DISMISSED,
  STORAGE_KEY_ONBOARDING_RANKING_VIEWED,
  STORAGE_KEY_ONBOARDING_CELEBRATED,
  STORAGE_KEY_ONBOARDING_EXPANDED,
  STORAGE_KEY_HINT_POST_FIRST_RATING,
  STORAGE_KEY_HINT_POST_FIRST_COMMENT,
  STORAGE_KEY_ACCOUNT_BANNER_DISMISSED,
  STORAGE_KEY_BENEFITS_SHOWN,
  STORAGE_KEY_ACTIVITY_REMINDER_SHOWN,
  STORAGE_KEY_ANON_RATING_COUNT,
  STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED,
  STORAGE_KEY_REMEMBERED_EMAIL,
];

/**
 * Elimina permanentemente la cuenta del usuario y todos sus datos.
 * Requiere re-autenticación con contraseña actual.
 */
export async function deleteAccount(
  currentUser: User,
  password: string,
): Promise<void> {
  // Re-authenticate
  const credential = EmailAuthProvider.credential(currentUser.email!, password);
  await reauthenticateWithCredential(currentUser, credential);

  // Call Cloud Function to delete all server-side data
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../config/firebase');
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
  const fn = httpsCallable<{ databaseId?: string }, { success: boolean }>(functions, 'deleteUserAccount');
  await fn({ databaseId });

  // Clear all local user data
  for (const key of USER_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  invalidateAllQueryCache();
  clearAllBusinessCache();

  // Sign out — triggers onAuthStateChanged which auto-creates new anonymous account
  await firebaseSignOut(auth);
}

/**
 * Limpia todos los datos del servidor para un usuario anónimo.
 * No requiere re-autenticación (no tiene contraseña).
 */
export async function cleanAnonymousData(): Promise<void> {
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('../config/firebase');
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;
  const fn = httpsCallable<{ databaseId?: string }, { success: boolean }>(functions, 'cleanAnonymousData');
  await fn({ databaseId });

  // Clear local data
  for (const key of USER_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  invalidateAllQueryCache();
  clearAllBusinessCache();
}
