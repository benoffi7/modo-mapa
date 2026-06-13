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

  it('rejects a valid host without the /v0/b/<bucket>/o/ segment', () => {
    // Correct host + scheme, but not a canonical Storage object URL.
    expect(
      isValidStorageUrl('https://firebasestorage.googleapis.com/some/other/path'),
    ).toBe(false);
  });

  it('rejects a valid host with /v0/b/<bucket>/ but missing /o/', () => {
    expect(
      isValidStorageUrl('https://firebasestorage.googleapis.com/v0/b/modo-mapa.appspot.com/'),
    ).toBe(false);
  });

  it('accepts a canonical URL with a different bucket (generic [^/]+ bucket)', () => {
    // Generic bucket matcher must not break legacy mediaUrl pointing at
    // another well-formed bucket (e.g. *.firebasestorage.app).
    expect(
      isValidStorageUrl(
        'https://firebasestorage.googleapis.com/v0/b/another-project.firebasestorage.app/o/feedback-media%2Fuid%2Fdoc%2Fphoto.jpg?alt=media',
      ),
    ).toBe(true);
  });

  it('rejects an injected sub-path in the bucket position', () => {
    // [^/]+ forbids a '/' in the bucket segment, blocking evil.com/x injection.
    expect(
      isValidStorageUrl('https://firebasestorage.googleapis.com/v0/b/evil.com/x/o/file'),
    ).toBe(false);
  });
});
