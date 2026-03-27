import { describe, it, expect } from 'vitest';
import { usePasswordConfirmation } from './usePasswordConfirmation';

describe('usePasswordConfirmation', () => {
  it('returns isValid=true when passwords match', () => {
    const result = usePasswordConfirmation('abc123', 'abc123');
    expect(result.isValid).toBe(true);
    expect(result.error).toBe(false);
    expect(result.helperText).toBeUndefined();
  });

  it('returns isValid=false and error when passwords differ and confirm is non-empty', () => {
    const result = usePasswordConfirmation('abc123', 'xyz789');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(true);
    expect(result.helperText).toBe('Las contraseñas no coinciden');
  });

  it('returns error=false when confirmPassword is empty even if different', () => {
    const result = usePasswordConfirmation('abc123', '');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(false);
    expect(result.helperText).toBeUndefined();
  });

  it('returns isValid=true when both are empty', () => {
    const result = usePasswordConfirmation('', '');
    expect(result.isValid).toBe(true);
    expect(result.error).toBe(false);
    expect(result.helperText).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const result = usePasswordConfirmation('Password', 'password');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(true);
  });

  it('returns error when confirm is partial match', () => {
    const result = usePasswordConfirmation('abc123', 'abc');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(true);
    expect(result.helperText).toBe('Las contraseñas no coinciden');
  });
});
