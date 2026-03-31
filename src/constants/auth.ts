export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = {
  minLength: 8,
  requireNumber: /\d/,
  requireUppercase: /[A-Z]/,
  requireSymbol: /[!@#$%^&*()_+\-=[\]{}|;:',.<>?/~`]/,
};

export interface PasswordValidation {
  length: boolean;
  number: boolean;
  uppercase: boolean;
  symbol: boolean;
  valid: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  const length = password.length >= PASSWORD_RULES.minLength;
  const number = PASSWORD_RULES.requireNumber.test(password);
  const uppercase = PASSWORD_RULES.requireUppercase.test(password);
  const symbol = PASSWORD_RULES.requireSymbol.test(password);
  return { length, number, uppercase, symbol, valid: length && number && uppercase && symbol };
}

export const AUTH_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'No se pudo crear la cuenta. Si ya tenés una, intentá iniciar sesión.',
  'auth/invalid-email': 'El formato del email no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Intentá de nuevo más tarde.',
  'auth/network-request-failed': 'Error de conexión. Verificá tu internet.',
  'auth/requires-recent-login': 'Tu sesión expiró. Volvé a ingresar tu contraseña actual.',
  default: 'Ocurrió un error. Intentá de nuevo.',
};
