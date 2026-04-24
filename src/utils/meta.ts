/**
 * DOM meta tag helper.
 *
 * Creates or updates a `<meta property="{property}" content="{content}">` tag
 * in `<head>`. Used for OpenGraph tags (`og:title`, `og:description`, etc.).
 *
 * ## Scope
 *
 * Only handles `property=` meta tags (OpenGraph family). Does NOT handle
 * `name=` tags (viewport, description, theme-color). Genericize to accept
 * an `attr: 'name' | 'property'` parameter when there is a concrete need.
 *
 * ## Security
 *
 * `content` is written via `setAttribute('content', ...)`, not via `innerHTML`,
 * so the browser escapes it safely. However, callers that pass user-generated
 * content (business names, descriptions) are responsible for validating the
 * source upstream — this helper does not sanitize or truncate.
 *
 * @param property The OpenGraph property name (e.g. `'og:title'`).
 * @param content The value to set as the `content` attribute.
 */
export function setMetaTag(property: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
