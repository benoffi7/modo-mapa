interface PasswordConfirmationState {
  isValid: boolean;
  error: boolean;
  helperText: string | undefined;
}

export function usePasswordConfirmation(password: string, confirmPassword: string): PasswordConfirmationState {
  const isValid = password === confirmPassword;
  return {
    isValid,
    error: confirmPassword.length > 0 && !isValid,
    helperText: confirmPassword.length > 0 && !isValid ? 'Las contraseñas no coinciden' : undefined,
  };
}
