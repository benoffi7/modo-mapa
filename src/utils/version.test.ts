import { describe, it, expect } from 'vitest';
import { compareSemver, isUpdateRequired } from './version';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns 1 when major is greater', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
  });

  it('returns -1 when major is lesser', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
  });

  it('returns 1 when minor is greater', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
  });

  it('returns -1 when minor is lesser', () => {
    expect(compareSemver('1.1.0', '1.2.0')).toBe(-1);
  });

  it('returns 1 when patch is greater', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1);
  });

  it('returns -1 when patch is lesser', () => {
    expect(compareSemver('1.0.1', '1.0.2')).toBe(-1);
  });

  it('handles zero versions', () => {
    expect(compareSemver('0.0.1', '0.0.0')).toBe(1);
  });

  it('compares multi-digit numbers correctly', () => {
    expect(compareSemver('2.30.3', '2.31.0')).toBe(-1);
    expect(compareSemver('2.31.0', '2.30.3')).toBe(1);
  });

  it('defaults missing parts to 0 for short version strings', () => {
    // '1.0' has no patch — treated as '1.0.0'
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0', '1.0.1')).toBe(-1);
    expect(compareSemver('1.1', '1.0.9')).toBe(1);
  });
});

describe('isUpdateRequired', () => {
  it('returns true when required > current', () => {
    expect(isUpdateRequired('2.31.0', '2.30.3')).toBe(true);
  });

  it('returns false when required == current', () => {
    expect(isUpdateRequired('2.30.3', '2.30.3')).toBe(false);
  });

  it('returns false when required < current', () => {
    expect(isUpdateRequired('2.30.0', '2.30.3')).toBe(false);
  });
});
