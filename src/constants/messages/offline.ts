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
} as const;
