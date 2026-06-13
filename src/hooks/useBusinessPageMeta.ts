import { useEffect } from 'react';
import { setMetaTag } from '../utils/meta';
import type { Business } from '../types';

/**
 * Sets `document.title` and OpenGraph meta tags for the business detail page.
 *
 * On mount: saves the previous `document.title`, sets the new title, and writes
 * the 4 OG tags (`og:title`, `og:description`, `og:url`, `og:type`).
 * On unmount: restores the previous `document.title`.
 *
 * Only re-runs when business identity or display fields change
 * (`id`, `name`, `category`, `address`).
 */
export function useBusinessPageMeta(business: Business): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${business.name} — Modo Mapa`;
    setMetaTag('og:title', business.name);
    setMetaTag('og:description', `${business.category} · ${business.address}`);
    setMetaTag('og:url', `${window.location.origin}/comercio/${business.id}`);
    setMetaTag('og:type', 'place');
    return () => {
      document.title = prev;
    };
  }, [business.id, business.name, business.category, business.address]);
}
