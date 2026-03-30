import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toDate,
  formatDateShort,
  formatDateMedium,
  formatRelativeTime,
} from './formatDate';

describe('toDate', () => {
  it('converts Firestore Timestamp-like objects', () => {
    const fakeTimestamp = { toDate: () => new Date('2025-01-15') };
    const result = toDate(fakeTimestamp);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0); // January
  });

  it('returns current date for null/undefined', () => {
    const before = Date.now();
    const result = toDate(null);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('returns current date for plain objects without toDate', () => {
    const result = toDate({ foo: 'bar' });
    expect(result).toBeInstanceOf(Date);
  });

  it('returns current date for primitive values', () => {
    expect(toDate(42)).toBeInstanceOf(Date);
    expect(toDate('string')).toBeInstanceOf(Date);
  });
});

describe('formatDateShort', () => {
  it('formats a date with day, month, hour and minute in es-AR locale', () => {
    const date = new Date('2025-03-15T14:30:00');
    const result = formatDateShort(date);
    expect(result).toContain('15');
    expect(result).toContain('3');
  });
});

describe('formatDateMedium', () => {
  it('formats a date with day, short month and year in es-AR locale', () => {
    const date = new Date('2025-06-01T10:00:00');
    const result = formatDateMedium(date);
    expect(result).toContain('1');
    expect(result).toContain('2025');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "hace un momento" for just now', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('hace un momento');
  });

  it('returns minutes for < 60 min', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:30:00'));
    const date = new Date('2025-06-01T12:20:00');
    expect(formatRelativeTime(date)).toBe('hace 10 min');
    vi.useRealTimers();
  });

  it('returns hours for < 24h', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T15:00:00'));
    const date = new Date('2025-06-01T12:00:00');
    expect(formatRelativeTime(date)).toBe('hace 3h');
    vi.useRealTimers();
  });

  it('returns "ayer" for 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-02T12:00:00'));
    const date = new Date('2025-06-01T12:00:00');
    expect(formatRelativeTime(date)).toBe('ayer');
    vi.useRealTimers();
  });

  it('returns days for 2-6 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-05T12:00:00'));
    const date = new Date('2025-06-02T12:00:00');
    expect(formatRelativeTime(date)).toBe('hace 3 días');
    vi.useRealTimers();
  });

  it('returns formatted date for 7+ days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00'));
    const date = new Date('2025-06-01T12:00:00');
    const result = formatRelativeTime(date);
    // Should be a locale-formatted date, not a relative string
    expect(result).not.toContain('hace');
    expect(result).not.toContain('ayer');
    vi.useRealTimers();
  });
});
