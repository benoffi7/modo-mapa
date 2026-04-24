import { describe, it, expect, afterEach } from 'vitest';
import { setMetaTag } from './meta';

function cleanupMetaTags() {
  document.head.querySelectorAll('meta[property], meta[name="test-only"]').forEach((el) => el.remove());
}

describe('setMetaTag', () => {
  afterEach(() => {
    cleanupMetaTags();
  });

  it('crea un <meta property> cuando no existe', () => {
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull();
    setMetaTag('og:title', 'Primer título');
    const el = document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute('content')).toBe('Primer título');
  });

  it('actualiza content cuando el <meta property> ya existe', () => {
    setMetaTag('og:title', 'Primer valor');
    setMetaTag('og:title', 'Segundo valor');
    const all = document.head.querySelectorAll('meta[property="og:title"]');
    expect(all.length).toBe(1);
    expect(all[0].getAttribute('content')).toBe('Segundo valor');
  });

  it('soporta múltiples property distintos coexistiendo', () => {
    setMetaTag('og:title', 'Un título');
    setMetaTag('og:description', 'Una descripción');
    setMetaTag('og:url', 'https://example.test/comercio/1');
    setMetaTag('og:type', 'place');

    expect(document.head.querySelector('meta[property="og:title"]')!.getAttribute('content')).toBe('Un título');
    expect(document.head.querySelector('meta[property="og:description"]')!.getAttribute('content')).toBe('Una descripción');
    expect(document.head.querySelector('meta[property="og:url"]')!.getAttribute('content')).toBe('https://example.test/comercio/1');
    expect(document.head.querySelector('meta[property="og:type"]')!.getAttribute('content')).toBe('place');
  });

  it('no toca <meta name="..."> pre-existentes', () => {
    const nameTag = document.createElement('meta');
    nameTag.setAttribute('name', 'test-only');
    nameTag.setAttribute('content', 'original');
    document.head.appendChild(nameTag);

    setMetaTag('og:title', 'Título OG');

    const nameTagAfter = document.head.querySelector<HTMLMetaElement>('meta[name="test-only"]');
    expect(nameTagAfter).not.toBeNull();
    expect(nameTagAfter!.getAttribute('content')).toBe('original');
  });
});
