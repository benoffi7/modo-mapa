# Plan: Modo offline mejorado

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-23

---

## Fases de implementacion

### Fase 1: Infraestructura base (cola + contexto + constantes)

**Branch:** `feat/136-offline-queue-infra`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/offline.ts` | Crear tipos `OfflineAction`, `OfflineActionType`, `OfflineActionStatus`, `OfflineActionPayload` y todos los payload interfaces |
| 2 | `src/types/index.ts` | Re-exportar tipos de `offline.ts` |
| 3 | `src/constants/offline.ts` | Crear constantes: `OFFLINE_QUEUE_MAX_ITEMS`, `OFFLINE_QUEUE_MAX_AGE_MS`, `OFFLINE_MAX_RETRIES`, `OFFLINE_BACKOFF_BASE_MS`, `OFFLINE_DB_NAME`, `OFFLINE_DB_VERSION`, `OFFLINE_STORE_NAME`, `CONNECTIVITY_CHECK_URL`, `CONNECTIVITY_CHECK_TIMEOUT_MS` |
| 4 | `src/constants/index.ts` | Re-exportar constantes de `offline.ts` |
| 5 | `src/services/offlineQueue.ts` | Crear servicio IndexedDB: `openDb`, `enqueue`, `getAll`, `getPending`, `updateStatus`, `remove`, `cleanup`, `count`, `subscribe` |
| 6 | `src/services/offlineQueue.test.ts` | Tests: enqueue basico, max items reject, getAll FIFO order, getPending filtra status, updateStatus, remove, cleanup por edad, cleanup por status, subscribe notifica, count |
| 7 | `src/context/ConnectivityContext.tsx` | Crear `ConnectivityProvider` y `useConnectivity` hook. Escucha online/offline events, verifica conectividad real con fetch, carga pendingActions desde offlineQueue, expone `isOffline`, `isSyncing`, `pendingActionsCount`, `pendingActions`, `discardAction`, `retryFailed` |
| 8 | `src/hooks/useConnectivity.ts` | Re-export de `useConnectivity` desde el contexto (patron consistente con `useColorMode`) |
| 9 | `src/hooks/useConnectivity.test.ts` | Tests: initial state online, transition to offline, transition to online triggers sync, pendingActionsCount reactivity, discardAction removes from queue, retryFailed resets failed actions |

### Fase 2: Sync engine

**Branch:** `feat/136-sync-engine`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/syncEngine.ts` | Crear `processQueue` y `executeAction`. Mapeo de action type a servicio, backoff exponencial, max retries, callbacks |
| 2 | `src/services/syncEngine.test.ts` | Tests: FIFO processing order, executeAction maps all 9 types correctly, backoff timing (1s, 2s, 4s), max retries marks failed, successful actions removed, cleanup called first, onComplete callback with counts, onActionSynced/onActionFailed callbacks |
| 3 | `src/context/ConnectivityContext.tsx` | Integrar syncEngine en el provider: al reconectar, llamar `processQueue` con callbacks que muestran toasts via `useToast()` y actualizan `pendingActions` state. Toast info "Sincronizando N acciones...", toast success "N acciones sincronizadas", toast warning "M acciones fallaron" |

### Fase 3: Interceptor + integracion en componentes

**Branch:** `feat/136-offline-interceptor`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/offlineInterceptor.ts` | Crear `withOfflineSupport`: si offline encola y llama onEnqueued, si online ejecuta la accion original |
| 2 | `src/services/offlineInterceptor.test.ts` | Tests: online passthrough retorna resultado, offline enqueues y llama onEnqueued, enqueue failure propagates error |
| 3 | `src/constants/analyticsEvents.ts` | Agregar `EVT_OFFLINE_ACTION_QUEUED`, `EVT_OFFLINE_SYNC_COMPLETED`, `EVT_OFFLINE_SYNC_FAILED`, `EVT_OFFLINE_ACTION_DISCARDED` |
| 4 | `src/components/business/BusinessRating.tsx` | Import `useConnectivity`, `withOfflineSupport`, `useToast`. Wrap llamadas a `upsertRating` y `deleteRating` con `withOfflineSupport`. UI optimista existente (`pendingRating`) sigue funcionando igual |
| 5 | `src/components/business/BusinessComments.tsx` | Import `useConnectivity`, `withOfflineSupport`, `useToast`. Wrap `addComment` con `withOfflineSupport`. El optimistic add al state local sigue funcionando |
| 6 | `src/components/business/FavoriteButton.tsx` | Import `useConnectivity`, `withOfflineSupport`, `useToast`. Wrap `addFavorite`/`removeFavorite`. Derived state pattern existente sigue funcionando |
| 7 | `src/components/business/BusinessPriceLevel.tsx` | Import `useConnectivity`, `withOfflineSupport`, `useToast`. Wrap `upsertPriceLevel`/`deletePriceLevel` |
| 8 | `src/components/business/BusinessTags.tsx` | Import `useConnectivity`, `withOfflineSupport`, `useToast`. Wrap `addUserTag`/`removeUserTag` |

### Fase 4: UI mejorada (indicador + pendientes)

**Branch:** `feat/136-offline-ui`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/ui/OfflineIndicator.tsx` | Reescribir: eliminar state local y useEffect, consumir `useConnectivity()`. Chip muestra "Sin conexion" base, "Sin conexion - N pendientes" si count > 0, "Sincronizando..." si `isSyncing` |
| 2 | `src/components/ui/OfflineIndicator.test.tsx` | Actualizar tests existentes (5 cases) para usar mock de ConnectivityContext. Agregar tests: badge count display, syncing state, transition animations |
| 3 | `src/components/menu/PendingActionsSection.tsx` | Crear componente: lista de acciones pendientes con tipo icono, descripcion, fecha relativa, boton descartar, boton "Reintentar todo" para failed |
| 4 | `src/components/layout/SideMenuNav.tsx` | Agregar item "Pendientes" con Badge count, solo visible si count > 0. Icono: `SyncProblem` de MUI icons |
| 5 | `src/components/layout/SideMenu.tsx` | Lazy-load `PendingActionsSection`. Badge en header junto al nombre. Manejar section "pendientes" en el switch de secciones |
| 6 | `src/App.tsx` | Envolver con `ConnectivityProvider` debajo de `ToastProvider` |

### Fase 5: SW y PWA review

**Branch:** `feat/136-sw-review`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `vite.config.ts` | Verificar y agregar `navigateFallback: 'index.html'` en workbox config si no esta presente. Verificar que globPatterns cubre assets criticos |
| 2 | `vite.config.ts` | Revisar que los 3 runtime caching patterns para Maps tiles/API/static estan correctos (ya estan, solo verificar) |

---

## Orden de implementacion

1. `src/types/offline.ts` — tipos base que todo depende
2. `src/constants/offline.ts` — constantes usadas por offlineQueue y syncEngine
3. `src/services/offlineQueue.ts` + tests — storage layer, sin dependencias de React
4. `src/services/syncEngine.ts` + tests — depende de offlineQueue y servicios existentes
5. `src/services/offlineInterceptor.ts` + tests — depende de offlineQueue
6. `src/context/ConnectivityContext.tsx` + `src/hooks/useConnectivity.ts` + tests — depende de offlineQueue, syncEngine, ToastContext
7. `src/App.tsx` — agregar ConnectivityProvider
8. `src/components/ui/OfflineIndicator.tsx` + tests — depende de ConnectivityContext
9. Componentes de negocio (BusinessRating, BusinessComments, FavoriteButton, BusinessPriceLevel, BusinessTags) — dependen de offlineInterceptor + useConnectivity
10. `src/components/menu/PendingActionsSection.tsx` — depende de useConnectivity
11. `src/components/layout/SideMenuNav.tsx` + `SideMenu.tsx` — depende de PendingActionsSection + useConnectivity
12. `vite.config.ts` — independiente, puede hacerse en cualquier momento

---

## Riesgos

1. **IndexedDB no disponible en navegadores privados/antiguos.** Mitigacion: `offlineQueue.openDb()` captura errores y degrada gracefully — las escrituras intentan Firestore directamente (comportamiento actual). `withOfflineSupport` verifica que `enqueue` no fallo antes de dar feedback "guardado offline".

2. **Race condition: usuario hace accion online mientras la cola tiene la misma accion pendiente.** Mitigacion: last-write-wins es el comportamiento esperado. El sync engine no intenta deduplicar — si el usuario ya calificó online, el `upsertRating` del sync simplemente sobreescribe con `updateDoc` (mismo resultado).

3. **Cola llena (50 items) frustra al usuario en zonas sin conexion prolongada.** Mitigacion: toast warning "Cola de acciones llena" cuando se intenta encolar y hay 50 items. 50 es un limite conservador que cubre uso normal (pocas acciones por sesion). Se puede ajustar la constante si la telemetria muestra que es insuficiente.

---

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Constantes registradas en `src/constants/index.ts`
- [ ] Tipos registrados en `src/types/index.ts`
- [ ] Analytics events registrados en `src/constants/analyticsEvents.ts`
- [ ] OfflineIndicator tests actualizados para el nuevo contexto
- [ ] Privacy policy reviewed — cola almacena userId y businessId en IndexedDB local (mismo modelo de seguridad que Firestore persistent cache, no requiere cambio en privacy policy)
