export const MSG_OFFLINE = {
  syncing: (count: number) =>
    `Sincronizando ${count} ${count === 1 ? 'accion' : 'acciones'}...`,
  syncSuccess: (count: number) =>
    `${count} ${count === 1 ? 'accion sincronizada' : 'acciones sincronizadas'}`,
  syncFailed: (count: number) =>
    `${count} ${count === 1 ? 'accion fallo' : 'acciones fallaron'}`,
  noConnection: 'Sin conexión',
  noConnectionPending: (count: number) =>
    `Sin conexión - ${count} pendiente${count > 1 ? 's' : ''}`,
  emptyPending: 'No hay acciones pendientes',
} as const;
