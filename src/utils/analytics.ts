import type { Analytics } from 'firebase/analytics';
import type { FirebaseApp } from 'firebase/app';

let analytics: Analytics | null = null;

export function initAnalytics(app: FirebaseApp): void {
  if (import.meta.env.PROD) {
    import('firebase/analytics').then(({ getAnalytics }) => {
      analytics = getAnalytics(app);
    });
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!analytics) return;
  import('firebase/analytics').then(({ logEvent }) => {
    logEvent(analytics!, name, params);
  });
}

export function setUserProperty(name: string, value: string): void {
  if (!analytics) return;
  import('firebase/analytics').then(({ setUserProperties }) => {
    setUserProperties(analytics!, { [name]: value });
  });
}
