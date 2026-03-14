export const VALID_CATEGORIES = [
  'bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro',
] as const;

export const FEEDBACK_STATUSES = {
  pending: { label: 'Enviado', color: 'warning' as const },
  viewed: { label: 'Visto', color: 'info' as const },
  responded: { label: 'Respondido', color: 'success' as const },
  resolved: { label: 'Resuelto', color: 'secondary' as const },
};

export const MAX_ADMIN_RESPONSE_LENGTH = 500;

export const MAX_FEEDBACK_MEDIA_SIZE = 10 * 1024 * 1024;
