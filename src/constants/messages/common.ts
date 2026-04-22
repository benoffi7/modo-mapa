export const MSG_COMMON = {
  noUsersFound: 'No se encontraron usuarios',
  publicProfileHint: 'Quizás el usuario no tenga el perfil público',
  deleteError: 'No se pudo eliminar el comentario',
  editError: 'No se pudo guardar la edición',
  discardWarning: 'Tenés texto sin enviar. Si cerrás, se va a perder.',
  markReadError: 'No se pudo marcar como leída',
  markAllReadError: 'No se pudo marcar todo como leído',
  settingUpdateError: 'No pudimos guardar el cambio. Intentá de nuevo.',
  // Aria-labels y acciones comunes (#309 S3)
  closeAriaLabel: 'Cerrar',
  closeNoticeAriaLabel: 'Cerrar aviso',
  loadMore: 'Cargar más',
  loading: 'Cargando...',
  // Error boundary (#309 S3)
  genericErrorTitle: 'Algo salió mal',
  genericErrorBody: 'Ocurrió un error inesperado. Intentá recargar la página.',
  // Offline guards (#304)
  noConnectionForProfile: 'No se puede cambiar sin conexión',
} as const;
