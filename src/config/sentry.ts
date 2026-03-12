import * as Sentry from '@sentry/react';

declare const __APP_VERSION__: string;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry] DSN no configurado, Sentry deshabilitado');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? 'development' : 'production',
    release: `modo-mapa@${__APP_VERSION__}`,
    tracesSampleRate: 0,
  });
}
