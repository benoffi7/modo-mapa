/**
 * Centralized logger — gates console output in production.
 * In prod, errors route to Sentry. In dev, everything goes to console.
 */

const isDev = import.meta.env.DEV;

function captureToSentry(error: unknown): void {
  try {
    // Dynamic import to avoid pulling Sentry into the bundle for non-error paths
    void import('@sentry/react').then(({ captureException }) => {
      captureException(error);
    });
  } catch {
    // Sentry not available — silently ignore
  }
}

export const logger = {
  error(message: string, ...args: unknown[]): void {
    if (isDev) {
      console.error(message, ...args);
    } else {
      captureToSentry(args[0] instanceof Error ? args[0] : new Error(message));
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (isDev) {
      console.warn(message, ...args);
    }
  },

  log(message: string, ...args: unknown[]): void {
    if (isDev) {
      console.log(message, ...args);
    }
  },
};
