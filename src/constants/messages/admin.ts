export const MSG_ADMIN = {
  featuredToggleSuccess: (wasFeatured: boolean) =>
    wasFeatured ? 'Quitada de destacadas' : 'Marcada como destacada',
  featuredToggleError: 'No se pudo cambiar el estado',
  moderateDeleteSuccess: (target: string) => `${target} eliminado correctamente`,
  moderateHideSuccess: (target: string) => `${target} ocultado correctamente`,
  moderateError: 'No se pudo completar la acción de moderación',
  moderateConfirmDeleteTitle: '¿Eliminar este contenido?',
  moderateConfirmHideTitle: '¿Ocultar este contenido?',
  moderateConfirmDeleteBody: (target: string) =>
    `Esta acción eliminará el ${target} y todas sus respuestas de forma permanente.`,
  moderateConfirmHideBody: (target: string) =>
    `El ${target} dejará de ser visible para los usuarios, pero se conservará en la base de datos.`,
  moderationSaveSuccess: 'Cambios guardados',
  moderationSaveError: 'No se pudieron guardar los cambios',
  moderationConfirmTitle: 'Confirmar cambios de moderación',
  moderationConfirmBody: 'Estás por modificar la lista de palabras baneadas. Esta acción afecta la moderación de contenido.',
  // #327 — rate limits inspector
  rateLimitResetSuccess: 'Reseteado correctamente',
  rateLimitResetError: 'No se pudo resetear. Verificá tu sesión admin.',
  rateLimitAlreadyReset: 'Esta entrada ya fue reseteada por otro admin. Refrescamos la tabla.',
  // #327 — list items moderation
  listItemDeleteSuccess: 'Eliminado correctamente',
  listItemDeleteError: 'No se pudo eliminar el item. Verificá tu sesión admin.',
  listItemAlreadyDeleted: 'Item ya eliminado por otro admin. Refrescá la lista.',
} as const;
