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
import { STORAGE_KEY_VISITS } from '../constants/storage';

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
