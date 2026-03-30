export const MSG_ADMIN = {
  featuredToggleSuccess: (wasFeatured: boolean) =>
    wasFeatured ? 'Quitada de destacadas' : 'Marcada como destacada',
  featuredToggleError: 'No se pudo cambiar el estado',
} as const;
