import type { Analytics } from 'firebase/analytics';
import type { FirebaseApp } from 'firebase/app';

let analytics: Analytics | null = null;
let enabled = false;
let firebaseApp: FirebaseApp | null = null;

import { STORAGE_KEY_ANALYTICS_CONSENT } from '../constants/storage';

function activateAnalytics(app: FirebaseApp): void {
  enabled = true;
  import('firebase/analytics').then(({ getAnalytics, setAnalyticsCollectionEnabled }) => {
    analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
  });
}

export function initAnalytics(app: FirebaseApp): void {
  firebaseApp = app;
  if (!import.meta.env.PROD) return;

  const consent = localStorage.getItem(STORAGE_KEY_ANALYTICS_CONSENT);
  if (consent === 'true') {
    activateAnalytics(app);
  }
}

export function setAnalyticsEnabled(value: boolean): void {
  localStorage.setItem(STORAGE_KEY_ANALYTICS_CONSENT, String(value));
  enabled = value;

  if (!import.meta.env.PROD || !firebaseApp) return;

  if (value && !analytics) {
    activateAnalytics(firebaseApp);
  } else if (analytics) {
    import('firebase/analytics').then(({ setAnalyticsCollectionEnabled }) => {
      setAnalyticsCollectionEnabled(analytics!, value);
    });
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!enabled || !analytics) return;
  import('firebase/analytics').then(({ logEvent }) => {
    logEvent(analytics!, name, params);
  });
}

export function setUserProperty(name: string, value: string): void {
  if (!enabled || !analytics) return;
  import('firebase/analytics').then(({ setUserProperties }) => {
    setUserProperties(analytics!, { [name]: value });
  });
}
