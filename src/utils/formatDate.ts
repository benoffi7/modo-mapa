/**
 * Shared date formatting utilities.
 *
 * Centralizes the various `formatDate` and `toDate` helpers that were
 * previously duplicated across admin panels, menu lists, and converters.
 */

/** Convert a Firestore Timestamp-like value to a native Date. */
export function toDate(field: unknown): Date {
  if (field && typeof field === 'object' && 'toDate' in field) {
    return (field as { toDate: () => Date }).toDate();
  }
  return new Date();
}

/** Format a Date in short Argentine locale: dd/MM, HH:mm. */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a Date in medium Argentine locale: d MMM yyyy. */
export function formatDateMedium(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a date string (ISO) to Argentine locale with full date+time. */
export function formatDateFull(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
