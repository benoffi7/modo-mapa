export const VALID_CATEGORIES = [
  'bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro',
] as const;

export const FEEDBACK_STATUSES = {
  pending: { label: 'Enviado', color: 'default' as const },
  viewed: { label: 'Visto', color: 'info' as const },
  responded: { label: 'Respondido', color: 'success' as const },
  resolved: { label: 'Resuelto', color: 'default' as const },
};

export const MAX_ADMIN_RESPONSE_LENGTH = 500;
