import { describe, it, expect } from 'vitest';
import { isValidStorageUrl } from './media';

describe('isValidStorageUrl', () => {
  it('accepts a canonical Firebase Storage URL', () => {
    expect(
      isValidStorageUrl(
        'https://firebasestorage.googleapis.com/v0/b/modo-mapa.appspot.com/o/menus%2Ftest.jpg?alt=media',
      ),
    ).toBe(true);
  });

  it('rejects undefined', () => {
    expect(isValidStorageUrl(undefined)).toBe(false);
  });

  it('rejects null cast as unknown', () => {
    expect(isValidStorageUrl(null as unknown as string)).toBe(false);
  });

  it('rejects number cast as unknown (typeof guard)', () => {
    expect(isValidStorageUrl(123 as unknown as string)).toBe(false);
  });

  it('rejects object cast as unknown (typeof guard)', () => {
    expect(isValidStorageUrl({} as unknown as string)).toBe(false);
  });

  it('rejects boolean cast as unknown (typeof guard)', () => {
    expect(isValidStorageUrl(true as unknown as string)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidStorageUrl('')).toBe(false);
  });

  it('rejects prefix-bypass attempt with similar-looking domain', () => {
    // The trailing slash on STORAGE_URL_PREFIX bites this attack:
    // 'https://firebasestorage.googleapis.com/' is NOT a prefix of
    // 'https://firebasestorage.googleapis.com.evil.com/...'
    expect(
      isValidStorageUrl('https://firebasestorage.googleapis.com.evil.com/v0/b/x'),
    ).toBe(false);
  });

  it('rejects scheme-confusion (http:// without TLS)', () => {
    expect(
      isValidStorageUrl('http://firebasestorage.googleapis.com/v0/b/x'),
    ).toBe(false);
  });

  it('rejects URLs with arbitrary content before the prefix', () => {
    expect(
      isValidStorageUrl('evil-https://firebasestorage.googleapis.com/v0/b/x'),
    ).toBe(false);
  });

  it('rejects an unrelated https URL', () => {
    expect(isValidStorageUrl('https://example.com/photo.jpg')).toBe(false);
  });
});
