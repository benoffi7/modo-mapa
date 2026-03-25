import { logger } from '../../utils/logger';

export function formatBackupDate(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return createdAt;
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return createdAt;
  }
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function mapErrorToUserMessage(message: string, context: string): string {
  if (message.includes('internal') || message.includes('INTERNAL')) {
    return `${context}. Verifica que las Cloud Functions esten desplegadas y que el service account tenga permisos.`;
  }
  if (message.includes('permission-denied')) {
    return 'No tenes permisos para realizar esta accion.';
  }
  if (message.includes('not-found')) {
    return 'Backup no encontrado.';
  }
  if (message.includes('resource-exhausted')) {
    return 'Demasiadas solicitudes. Intenta de nuevo en un minuto.';
  }
  return `${context}: ${message}`;
}

export function logError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    logger.error(`BackupsPanel: ${context}`, err);
  }
}
