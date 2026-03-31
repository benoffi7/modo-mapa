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
} as const;
