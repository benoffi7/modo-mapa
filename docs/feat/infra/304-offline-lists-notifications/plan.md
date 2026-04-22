# Plan: #304 Offline guards for Lists domain + notifications

**Issue:** [#304](https://github.com/benoffi7/modo-mapa/issues/304)
**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-18
**Branch sugerida:** `fix/304-offline-lists-notifications`

---

## Orden de ejecucion

Los pasos estan agrupados en fases. Cada fase es autocontenida y deja el repo verde (`npm run test:run` pasa). Dentro de una fase, los pasos se pueden ejecutar en paralelo si son disjoint (marcado `||` al final).

---

## Fase 1 — Types y infraestructura base

### 1.1 Extender `OfflineActionType` y agregar payloads

**Archivo:** `src/types/offline.ts`

- Agregar 6 variantes al union `OfflineActionType`: `list_create`, `list_update`, `list_toggle_public`, `list_delete`, `list_item_add`, `list_item_remove`.
- Agregar interfaces `ListCreatePayload`, `ListUpdatePayload`, `ListTogglePublicPayload`, `ListDeletePayload`, `ListItemAddPayload`.
- Agregarlas al union `OfflineActionPayload`.
- Agregar campo opcional `listId?: string` a `OfflineAction` interface.

**Verificacion:** `npm run build` (type check) verde.

### 1.2 Propagar `listId` en `withOfflineSupport`

**Archivo:** `src/services/offlineInterceptor.ts`

- Agregar `listId?: string | undefined` al tipo de `actionMeta`.
- Dentro del builder de `actionData`, propagar `listId` si esta presente.

**Verificacion:** `npm run test:run -- offlineInterceptor` verde (test existente sigue pasando + agregar test nuevo en fase 5).

### 1.3 Helper `generateListId` en sharedLists service

**Archivo:** `src/services/sharedLists.ts`

- Importar `collection as fbCollection` y `doc as fbDoc` de `firebase/firestore`.
- Exportar `generateListId(): string` que devuelve `doc(collection(db, COLLECTIONS.SHARED_LISTS)).id`.

### 1.4 Extender `createList` con listId opcional

**Archivo:** `src/services/sharedLists.ts`

- Agregar 5to parametro `listId?: string`.
- Si `listId` provisto: `await setDoc(doc(db, COLLECTIONS.SHARED_LISTS, listId), docData)`.
- Si no: comportamiento actual (`addDoc`).
- `resolvedId` devuelto es el que se uso.

**Verificacion:** `npm run test:run -- sharedLists` verde (tests existentes de `createList` siguen pasando — no se pasa el 5to param).

Pasos 1.1, 1.2, 1.3, 1.4 secuencial (1.1 antes que los demas; 1.2 y 1.3 y 1.4 independientes ||).

---

## Fase 2 — Messages y constants

### 2.1 Agregar textos a `messages/list.ts`

**Archivo:** `src/constants/messages/list.ts`

- `deleteRequiresConnection: 'Eliminar listas requiere conexión'`
- `featuredStale: 'Listas destacadas desactualizadas'`

### 2.2 Agregar texto a `messages/common.ts`

**Archivo:** `src/constants/messages/common.ts`

- `noConnectionForProfile: 'No se puede cambiar sin conexión'`

### 2.3 Agregar evento analytics

**Archivo:** `src/constants/analyticsEvents/system.ts` (crear si no existe)

- `export const EVT_MAP_LOAD_FAILED = 'map_load_failed';`
- Verificar que el barrel `src/constants/analyticsEvents/index.ts` re-exporta `system.ts`.

**Verificacion:** `npm run build` verde.

Pasos 2.1, 2.2, 2.3 independientes ||.

---

## Fase 3 — syncEngine branches

### 3.1 Agregar imports de types en syncEngine.ts

**Archivo:** `src/services/syncEngine.ts`

- Agregar imports `type` de `ListCreatePayload`, `ListUpdatePayload`, `ListTogglePublicPayload`, `ListDeletePayload`, `ListItemAddPayload`.

### 3.2 Agregar 6 branches en `executeAction`

**Archivo:** `src/services/syncEngine.ts`

Dentro del switch, agregar los 6 cases (ver `specs.md`). Cada case:

- Hace cast del payload al type correcto.
- Dynamic import del service correspondiente.
- Valida `action.listId` donde es requerido y throw Error descriptivo si falta.
- Invoca el service con los args correctos.

**Verificacion:** `npm run test:run -- syncEngine` (tests nuevos en fase 6).

---

## Fase 4 — Context y componentes de escritura

### 4.1 Guard offline en NotificationsContext

**Archivo:** `src/context/NotificationsContext.tsx`

- Importar `useConnectivity` de `./ConnectivityContext`.
- Extraer `isOffline` dentro del provider.
- En `markRead`: `if (isOffline) return;` antes del optimistic update. Agregar `isOffline` a deps del `useCallback`.
- En `markAllRead`: agregar `|| isOffline` al guard actual de `uid`. Agregar `isOffline` a deps.

### 4.2 CreateListDialog offline

**Archivo:** `src/components/lists/CreateListDialog.tsx`

- Importar `useConnectivity`, `withOfflineSupport`, `generateListId`.
- Pre-generar `listId` al inicio de `handleCreate`.
- Wrappear `createList()` en `withOfflineSupport` con action `list_create`.
- Llamar `onCreated(listId, ...)` con el ID pre-generado (offline o online).
- Toast success solo online (el info offline lo dispara el wrapper).

### 4.3 ListDetailScreen offline (4 handlers + block delete)

**Archivo:** `src/components/lists/ListDetailScreen.tsx`

- Importar `useConnectivity`, `withOfflineSupport`.
- Guard en `handleDelete`: si `isOffline`, toast.warning + early return.
- Wrappear `handleColorChange` en `list_update` via `withOfflineSupport`.
- Wrappear `handleTogglePublic` en `list_toggle_public`.
- Wrappear `handleRemoveItem` en `list_item_remove`.
- Wrappear `handleIconChange` en `list_update`.
- Agregar `disabled={isOffline}` al IconButton de eliminar lista.

### 4.4 AddToListDialog offline

**Archivo:** `src/components/business/AddToListDialog.tsx`

- Importar `useConnectivity`, `withOfflineSupport`, `generateListId`.
- Wrappear `handleToggle` (add/remove) con actions `list_item_add`/`list_item_remove`.
- Pre-generar `listId` en `handleCreate`; wrappear `createList` + `addBusinessToList` (FIFO se preserva).
- Optimistic append offline a `setLists` en vez de `fetchUserLists` refresh (que falla offline).

### 4.5 EditDisplayNameDialog offline

**Archivo:** `src/components/profile/EditDisplayNameDialog.tsx`

- Importar `useConnectivity`, `useToast`, `MSG_COMMON`.
- Guard en `handleSave`: si `isOffline`, toast.warning con `noConnectionForProfile` + return.
- Agregar `|| isOffline` al `disabled` del boton Guardar.

### 4.6 ProfileScreen avatar offline

**Archivo:** `src/components/profile/ProfileScreen.tsx`

- Importar `useToast`, `MSG_COMMON` (ya esta `useConnectivity` — `isOffline` ya se usa).
- Wrap del `onClick` del Avatar para guard offline: si `isOffline`, toast.warning + return.
- Agregar `aria-disabled={isOffline}` al Avatar.

Pasos 4.1 - 4.6 independientes ||.

---

## Fase 5 — Componentes nuevos y UI auxiliar

### 5.1 MapErrorBoundary (nuevo)

**Archivo:** `src/components/search/MapErrorBoundary.tsx` (crear)

- Clase `MapErrorBoundary extends Component<Props, State>`.
- `getDerivedStateFromError` setea `hasError: true`.
- `componentDidCatch` hace `logger.error`, `trackEvent(EVT_MAP_LOAD_FAILED)`, llama `onFallback?.()`.
- Render fallback con Alert + boton "Reintentar" que hace `setState({ hasError: false })`.

### 5.2 Integrar MapErrorBoundary en SearchScreen

**Archivo:** `src/components/search/SearchScreen.tsx`

- Agregar `const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';` (ya existe).
- Cambiar `useState<SearchViewMode>('map')` a evaluar API key: `GOOGLE_MAPS_API_KEY ? 'map' : 'list'`.
- Wrappear el bloque `<APIProvider>...</APIProvider>` con `<MapErrorBoundary onFallback={() => setViewMode('list')}>`.
- Renderizar bloque de mapa solo si `GOOGLE_MAPS_API_KEY && viewMode === 'map'`.
- Mover `APIProvider` dentro del condicional (no montarlo si no hay key o no esta en map mode).

### 5.3 Chip "Desactualizado" en SharedListsView

**Archivo:** `src/components/lists/SharedListsView.tsx`

- Agregar state `const [isFeaturedStale, setIsFeaturedStale] = useState(false);`.
- En el `.catch` de `fetchFeaturedLists`, setear `setIsFeaturedStale(true)` solo si `warmedFromCache`.
- En el render del header de featured lists, mostrar `<Chip label={MSG_LIST.featuredStale} ... />` condicionalmente.

### 5.4 PendingActionsSection labels + iconos

**Archivo:** `src/components/profile/PendingActionsSection.tsx`

- Importar `FormatListBulletedIcon`, `BookmarkIcon`, `BookmarkRemoveIcon`, `DeleteOutlineIcon` (este ultimo ya puede estar).
- Agregar 6 entradas a `ACTION_LABELS` y 6 a `ACTION_ICONS`.
- Verificar que TypeScript exige exhaustividad (Record<OfflineActionType, ...>) — si no, agregar assertion.

Pasos 5.1, 5.2 secuencial (5.2 depende de 5.1). 5.3, 5.4 independientes ||.

---

## Fase 6 — Tests

### 6.1 Extender `sharedLists.test.ts`

**Archivo:** `src/services/sharedLists.test.ts`

- `createList` con `listId` usa `setDoc` en vez de `addDoc`.
- `createList` con `listId` devuelve el mismo ID.
- `generateListId()` devuelve string de al menos 20 chars.

### 6.2 Extender `syncEngine.test.ts`

**Archivo:** `src/services/syncEngine.test.ts`

- Mock `./sharedLists` con los 5 services necesarios.
- 6 tests: cada action type invoca el service con los args correctos.
- 3 tests de error: `list_update`, `list_delete`, `list_toggle_public` sin `listId` throw.

### 6.3 Extender `offlineInterceptor.test.ts`

**Archivo:** `src/services/offlineInterceptor.test.ts`

- Test: `actionMeta.listId` se propaga al enqueue.

### 6.4 NotificationsContext tests

**Archivo:** `src/context/NotificationsContext.test.tsx` (nuevo)

- Render con `ConnectivityContext` mockeado (`isOffline: true`).
- `markRead` no llama a service + no setState optimistic.
- `markAllRead` idem.
- `isOffline: false` → behaviour normal.

### 6.5 CreateListDialog tests

**Archivo:** `src/components/lists/CreateListDialog.test.tsx` (nuevo)

- Mock `generateListId` con valor fijo.
- Offline + submit: `onCreated` llamado con el listId pre-generado; dialog se cierra.
- Online + submit: `createList` llamado con listId, idem resultado.

### 6.6 ListDetailScreen tests

**Archivo:** `src/components/lists/ListDetailScreen.test.tsx` (nuevo)

- Offline: delete button disabled, toggle public funciona (encola), handleRemoveItem optimistic.
- Online: comportamiento actual.

### 6.7 AddToListDialog tests

**Archivo:** `src/components/business/AddToListDialog.test.tsx` (nuevo)

- Offline create: listId pre-generado, secuencia `list_create` → `list_item_add` encolada en orden.
- Online: flow normal.

### 6.8 EditDisplayNameDialog tests

**Archivo:** `src/components/profile/EditDisplayNameDialog.test.tsx` (nuevo)

- Offline: submit muestra toast warning, no llama `setDisplayName`.
- Online: llama `setDisplayName`, cierra dialog.

### 6.9 MapErrorBoundary tests

**Archivo:** `src/components/search/MapErrorBoundary.test.tsx` (nuevo)

- Hijo que throw: `onFallback` se llama, fallback UI se muestra.
- Retry button resetea state.

### 6.10 SharedListsView stale chip test

**Archivo:** `src/components/lists/SharedListsView.test.tsx` (nuevo o extend)

- `fetchFeaturedLists` rechaza + cache localStorage presente → chip se renderiza.

**Verificacion Fase 6:** `npm run test:coverage` >= 80% en archivos nuevos/modificados.

Tests 6.1-6.10 independientes ||.

---

## Fase 7 — Lint, build y verificacion manual

### 7.1 Lint

```bash
npm run lint
```

Verificar que no hay warnings nuevos. Especialmente atentos a:

- `@typescript-eslint/no-empty-function` (sin silent .catch)
- `react-hooks/exhaustive-deps` (agregado `isOffline` a deps de callbacks)

### 7.2 Build

```bash
npm run build
```

Verificar bundle size no aumenta significativamente (MapErrorBoundary es ~60 lineas, syncEngine +60 lineas).

### 7.3 Pre-staging check

```bash
bash scripts/pre-staging-check.sh
```

### 7.4 Verificacion manual

Usando `npm run dev:full` (Vite + Firebase emulators):

- [ ] Chrome DevTools > Network > Offline checkbox.
- [ ] Crear lista → verificar toast "Guardado offline", lista aparece en UI, pendiente en SideMenu section.
- [ ] Agregar comercio a la lista → encolado.
- [ ] Cambiar color → encolado.
- [ ] Toggle public → encolado.
- [ ] Intentar eliminar → Alert "Requiere conexión" + boton disabled.
- [ ] Click en notification → no ocurre nada visible (early return silencioso).
- [ ] Intentar cambiar nombre → toast warning.
- [ ] Intentar cambiar avatar → toast warning.
- [ ] Reconectar → todas las acciones encoladas sincronizan, toast "N acciones sincronizadas".
- [ ] Verificar en Firestore que la lista creada tiene el listId client-gen esperado.
- [ ] Forzar error en Google Maps (bloquear API key via invalid key) → MapErrorBoundary cae a list view.

---

## Fase 8 — Documentacion

### 8.1 Actualizar `docs/reference/features.md`

- Seccion "Modo offline mejorado (#136)": cambiar "las acciones del usuario (ratings, comments, favorites, price levels, tags)" a "...+ checkins, follows, recomendaciones, **listas (crear/editar/items)**".

### 8.2 Actualizar `docs/reference/patterns.md`

- Seccion "Offline queue" → bullet "Offline action types": cambiar "9 tipos" a "23 tipos" (17 existentes + 6 list_*).

### 8.3 Actualizar `docs/_sidebar.md`

Agregar entradas bajo `**Infra**`:

```markdown
  - [#304 Offline Lists + Notifications](/feat/infra/304-offline-lists-notifications/prd.md)
    - [Specs](/feat/infra/304-offline-lists-notifications/specs.md)
    - [Plan](/feat/infra/304-offline-lists-notifications/plan.md)
```

### 8.4 Actualizar `docs/reports/backlog-producto.md`

- Incrementar "Issues cerrados" de 103 a 104.
- Actualizar fecha de "ultima actualizacion" si aplica.

---

## Fase 9 — Commit y PR

### 9.1 Commit

Mensaje sugerido:

```text
fix(#304): offline guards para Lists domain + notifications

- Agregar 6 action types (list_create, list_update, list_toggle_public,
  list_delete, list_item_add, list_item_remove) al offline queue.
- createList acepta listId client-generated para enable optimistic UI offline.
- Guard isOffline en NotificationsContext.markRead/markAllRead (elimina
  toast ruidoso tras #295).
- Bloqueo offline en EditDisplayNameDialog y avatar click.
- deleteList bloqueado offline (cascade delete inseguro).
- MapErrorBoundary para SearchScreen con fallback a list view.
- Chip "Desactualizado" en SharedListsView featured cuando fallback a cache.

Closes #304
```

### 9.2 PR

Usar skill `/stage` o `/merge` segun proceda. Antes de mergear:

- [ ] Todos los CI checks verdes (tests + coverage + lint + build).
- [ ] Verificacion manual completa en `dev:full`.
- [ ] Squash commits si corresponde.

---

## Checklist final de la implementacion

### Modularizacion

- [ ] Ningun componente nuevo importa `firebase/firestore` directamente.
- [ ] `MapErrorBoundary` es un componente generico (reutilizable).
- [ ] `generateListId` helper en `sharedLists.ts` service layer.
- [ ] `listId` en `OfflineAction` es opcional (backward compat).
- [ ] No se agrega contexto nuevo (se reutilizan `ConnectivityContext`, `AuthContext`, `ToastContext`).
- [ ] Archivos nuevos en carpetas correctas (`search/`, `lists/`, `business/`, `profile/`, `context/`, `services/`).

### Robustez

- [ ] `withOfflineSupport` cubierto por tests.
- [ ] Error path en `syncEngine` branches con listId faltante.
- [ ] `MapErrorBoundary.componentDidCatch` no dispara infinite loops.
- [ ] FIFO de queue preservado para `list_create` → `list_item_add` (validar en test de integracion).
- [ ] Optimistic UI con revert en todos los handlers offline.

### Seguridad

- [ ] Firestore rules sin cambios verificado en `firestore.rules`.
- [ ] Rate limit server-side `onSharedListCreated` (10/dia) preservado en replay.
- [ ] Idempotencia de `setDoc` con ID compuesto en `addBusinessToList`.
- [ ] Sin field whitelist changes (verificado).

### A11y y copy

- [ ] `aria-label` en boton retry de MapErrorBoundary.
- [ ] `aria-disabled` en avatar cuando offline.
- [ ] Textos con tildes y voseo correctos.
- [ ] Todos los toasts usan `MSG_*` centralizados (no string literals).

### Tests

- [ ] `syncEngine.test.ts` 6 tests nuevos + 3 error paths.
- [ ] `sharedLists.test.ts` 2 tests nuevos (createList con listId + generateListId).
- [ ] `offlineInterceptor.test.ts` 1 test nuevo.
- [ ] `NotificationsContext.test.tsx` 3 tests.
- [ ] `CreateListDialog.test.tsx` 2 tests.
- [ ] `ListDetailScreen.test.tsx` 4 tests.
- [ ] `AddToListDialog.test.tsx` 2 tests.
- [ ] `EditDisplayNameDialog.test.tsx` 2 tests.
- [ ] `MapErrorBoundary.test.tsx` 3 tests.
- [ ] `SharedListsView.test.tsx` 1 test nuevo.
- [ ] `npm run test:coverage` >= 80%.

### Documentacion

- [ ] `docs/reference/features.md` actualizado.
- [ ] `docs/reference/patterns.md` actualizado (23 action types).
- [ ] `docs/_sidebar.md` con 3 nuevas entradas.
- [ ] `docs/reports/backlog-producto.md` issues cerrados +1.
