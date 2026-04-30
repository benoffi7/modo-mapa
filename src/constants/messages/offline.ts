export const MSG_OFFLINE = {
  syncing: (count: number) =>
    `Sincronizando ${count} ${count === 1 ? 'acción' : 'acciones'}...`,
  syncSuccess: (count: number) =>
    `${count} ${count === 1 ? 'acción sincronizada' : 'acciones sincronizadas'}`,
  syncFailed: (count: number) =>
    `${count} ${count === 1 ? 'acción falló' : 'acciones fallaron'}`,
  noConnection: 'Sin conexión',
  noConnectionPending: (count: number) =>
    `Sin conexión - ${count} pendiente${count > 1 ? 's' : ''}`,
  emptyPending: 'No hay acciones pendientes',
  // #323
  deleteListBlocked:
    'No podés eliminar listas sin conexión. Intentá de nuevo cuando vuelvas a estar online.',
  commentDeletedOffline: 'Eliminado offline (se sincronizará cuando vuelvas online)',
  commentEditingSync: 'Sincronizando...',
  deleteAccountOffline:
    'Necesitás conexión estable para eliminar tu cuenta — esta acción es irreversible',
  feedbackOffline: 'Necesitás conexión para enviar feedback',
  cleanAnonOffline: 'Necesitás conexión para limpiar tus datos anónimos',
  uploadPhotoOffline: 'Necesitás conexión para subir fotos',
  requiresConnection: 'Requiere conexión',
} as const;
