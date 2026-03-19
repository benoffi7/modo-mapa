import { validatePassword } from './auth';

describe('validatePassword', () => {
  it('fails for empty password', () => {
    const result = validatePassword('');
    expect(result).toEqual({ length: false, number: false, uppercase: false, symbol: false, valid: false });
  });

  it('fails for short password', () => {
    const result = validatePassword('Ab1!');
    expect(result.length).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('fails without number', () => {
    const result = validatePassword('Abcdefgh!');
    expect(result.number).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('fails without uppercase', () => {
    const result = validatePassword('abcdefg1!');
    expect(result.uppercase).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('fails without symbol', () => {
    const result = validatePassword('Abcdefg1');
    expect(result.symbol).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('passes with all criteria met', () => {
    const result = validatePassword('Abcdefg1!');
    expect(result).toEqual({ length: true, number: true, uppercase: true, symbol: true, valid: true });
  });

  it('reports individual checks correctly', () => {
    const result = validatePassword('abcdefgh');
    expect(result.length).toBe(true);
    expect(result.number).toBe(false);
    expect(result.uppercase).toBe(false);
    expect(result.symbol).toBe(false);
    expect(result.valid).toBe(false);
  });
});
