export const MSG_ADMIN = {
  featuredToggleSuccess: (wasFeatured: boolean) =>
    wasFeatured ? 'Quitada de destacadas' : 'Marcada como destacada',
  featuredToggleError: 'Error al cambiar estado',
} as const;
