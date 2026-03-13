declare const __APP_VERSION__: string;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.warn('[Sentry] DSN no configurado, Sentry deshabilitado');
    }
    return;
  }

  // Lazy-load Sentry to keep it out of the main bundle (~40kB gzip savings)
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.DEV ? 'development' : 'production',
      release: `modo-mapa@${__APP_VERSION__}`,
      tracesSampleRate: 0,
    });
  });
}
