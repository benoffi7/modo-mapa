# PRD: Tech debt offline — Lists domain + notifications lack offline guards

**Feature:** 304-offline-lists-notifications
**Categoria:** infra
**Fecha:** 2026-04-18
**Issue:** #304
**Prioridad:** Alta

---

## Contexto

La infraestructura offline (IndexedDB queue, `ConnectivityContext`, `withOfflineSupport` wrapper, `syncEngine`, `OfflineIndicator`) quedó solida tras #136, #197 y la hardening pasada (#271-#273, #284, #295). Actualmente 13 escrituras (ratings, comentarios, favoritos, price levels, tags, checkins, follows, recomendaciones) usan `withOfflineSupport` y se encolan limpiamente. El `/health-check` de hoy (2026-04-18) encontró que el dominio **Lists** y varias operaciones chicas en **notifications**/**profile**/**Google Maps** quedaron fuera de la cobertura, con los siguientes efectos: `createList()` promete un `listId` que nunca llega, `updateList`/`deleteList`/`toggleListPublic` fallan silenciosamente, `markNotificationRead` optimista revierte con toast ruidoso offline, `setDisplayName`/`setAvatarId` fallan silenciosamente, y `SearchScreen` no tiene fallback cuando Google Maps no carga.

## Problema

- **Dominio Lists totalmente sin offline**: 6 operaciones (`createList`, `updateList`, `toggleListPublic`, `deleteList`, `addBusinessToList`, `removeBusinessFromList`) no estan en `syncEngine` ni tienen guard `isOffline`. Casos peores: `CreateListDialog.handleCreate` hace `await createList()` esperando un `listId` que nunca resuelve offline (Firestore `addDoc` queda pendiente); `AddToListDialog.handleCreate` encadena `createList → addBusinessToList` con mismo problema. UI no avisa al usuario: el spinner queda girando indefinidamente.
- **Operaciones pequenas con fallo silencioso**: `markNotificationRead` y `markAllNotificationsRead` en `NotificationsContext` hacen optimistic + revert + `toast.error(MSG_COMMON.markReadError)` cuando estan offline (el fix de #295 agrega el toast pero no un guard offline). `setDisplayName` en `EditDisplayNameDialog` y `setAvatarId` en `ProfileScreen` no muestran ningun feedback cuando fallan offline.
- **UX sin fallback cuando algo no carga**: `SearchScreen` monta `APIProvider` de Google Maps sin error boundary. Si la API key fala, hay rate-limit o el usuario esta offline al primer render, la pantalla queda en blanco sin fallback a `SearchListView`.

## Solucion

### S1 — Expandir OfflineActionType para Lists (alta prioridad)

Agregar 6 tipos nuevos a `OfflineActionType` en `src/types/offline.ts`:

- `list_create` — payload: `{ name, description, icon? }`
- `list_update` — payload: `{ name, description, color?, icon? }`
- `list_toggle_public` — payload: `{ isPublic }`
- `list_delete` — payload: `{ ownerId }` (para invalidacion de cache)
- `list_item_add` — payload: `{ addedBy? }`
- `list_item_remove` — (sin payload extra)

Extender `OfflineAction` con un campo opcional `listId?: string` (las acciones de list usan `listId` en vez de `businessId`; items de lista usan ambos). Agregar los branches correspondientes en `executeAction` de `syncEngine.ts`.

**Problema clave de `createList`**: el caller espera un `listId` sincrono para agregar el item nuevo. Opciones:

- **Opcion A (recomendada)**: generar el `listId` client-side con `doc(collection(db, ...)).id` antes de encolar. `createList()` acepta un `listId` opcional; si esta presente, usa `setDoc(doc(..., listId))` en vez de `addDoc`. Esto permite que offline la cola devuelva el ID inmediatamente y el frontend siga normalmente (UI optimista con la lista nueva incluida en el state local). Cuando la cola ejecuta, el doc se crea con el mismo ID.
- Opcion B: bloquear creacion offline con un Alert en CreateListDialog. Mas simple pero peor UX.

Elegir **A** porque Firestore permite IDs generados client-side y habilita optimistic creation — patron ya usado en `addBusinessToList` que usa doc ID compuesto.

### S2 — Guard offline en operaciones pequenas (media prioridad)

- `NotificationsContext.markRead` y `markAllRead`: agregar `if (isOffline) return;` al inicio (antes del optimistic update). Importar `useConnectivity` desde `ConnectivityContext`. Agregar `isOffline` a deps del `useCallback`. Elimina el toast ruidoso sin necesidad de encolar (mark-as-read es cosmético, el usuario puede intentar de nuevo cuando reconecte).
- **Alternativa considerada**: agregar `notification_read` a `OfflineActionType` (ya existe `recommendation_read`). Decision: no encolar porque el server-side polling refrescara el contador correctamente al reconectar y las notifs ya leidas quedan obvias en UI. Mantenemos behaviour simple.
- `EditDisplayNameDialog` y `ProfileScreen` (avatar): agregar guard `isOffline` que deshabilita los botones `Guardar` y el click en avatar. Toast informativo "No se puede cambiar el nombre sin conexion" cuando el usuario intenta.
- `AuthContext.setDisplayName` / `setAvatarId` ya existen como funciones de contexto; no encolamos pero si bloqueamos UI y mostramos toast en los consumidores.

### S3 — Fallback UI Google Maps (baja prioridad)

Crear `MapErrorBoundary` en `src/components/search/MapErrorBoundary.tsx` (Error Boundary de React). Envuelve `MapView + LocationFAB + OfficeFAB + MapHint` dentro del toggle `viewMode === 'map'`. `componentDidCatch` captura errores de `APIProvider` (API key invalida, quota excedida, offline first-render) y cambia `viewMode` a `list` automaticamente mostrando un toast informativo "El mapa no se pudo cargar. Mostrando lista." Tambien cubre el case de `VITE_GOOGLE_MAPS_API_KEY` vacia: detectar y forzar `viewMode=list` desde el inicio.

### S4 — SharedListsView feedback de cache stale (baja)

En `SharedListsView.tsx` (carga de featured lists): cuando `fetchFeaturedLists()` falla y se usa el cache de localStorage, mostrar un chip discreto "Desactualizado" junto al header de la seccion destacadas. Copy en MSG_LIST: `featuredStale: 'Listas destacadas desactualizadas'`.

### UX

- Toast "Guardado offline — se sincronizara al reconectar" (ya existe como `OFFLINE_ENQUEUED_MSG`) aparece al encolar operaciones de listas.
- Seccion **Pendientes** en perfil ya renderiza todas las acciones en cola; los nuevos tipos de list tendran su icono en `PendingActionsSection` (usar `FormatListBulletedIcon` para list_*).
- Indicador `OfflineIndicator` en top-center ya muestra "Sin conexion - N pendientes". Sin cambios.
- Dialogs de listas (CreateListDialog, ListDetailScreen) no se bloquean offline con A (createList). Solo `deleteList` y `inviteListEditor` (Cloud Function callable) se bloquean: `deleteList` porque hacer cascade delete offline es inseguro; `inviteListEditor` ya esta gated al ser callable que requiere network.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — Expandir `OfflineActionType` con 6 tipos de list | Alta | S |
| S1 — `createList` aceptar listId opcional (client-gen) | Alta | S |
| S1 — Wrappear 6 operaciones de list con `withOfflineSupport` en componentes | Alta | M |
| S1 — Branches en `syncEngine.executeAction` para list_* | Alta | S |
| S1 — Icon/label para list_* en `PendingActionsSection` | Media | XS |
| S2 — Guard offline en `NotificationsContext.markRead/markAllRead` | Alta | XS |
| S2 — Guard offline + toast en `EditDisplayNameDialog` y avatar click | Media | XS |
| S3 — `MapErrorBoundary` + detect empty API key | Media | S |
| S4 — Chip "Desactualizado" en SharedListsView featured | Baja | XS |
| Tests — syncEngine list branches | Alta | S |
| Tests — offlineQueue branches nuevos | Alta | S |
| Tests — list CRUD offline flows (integracion) | Alta | M |

**Esfuerzo total estimado:** M (aprox. 2-3 jornadas)

---

## Out of Scope

- Resolucion de conflictos en updates de listas (ej: dos devices editan nombre offline y se pisan). Last-write-wins es aceptable.
- Queue offline para Cloud Functions callables (`inviteListEditor`, `removeListEditor`). Requieren network obligatorio.
- Re-arquitectura del sistema offline (sigue con IndexedDB + FIFO secuencial).
- Background sync con Service Worker (fuera de #136 scope original).
- Notificacion `notification_read` en queue (ver decision en S2).
- Compression/retry policy diferente para cada tipo de accion.

---

## Tests

Siguiendo la politica de `docs/reference/tests.md` (>=80% de cobertura para codigo nuevo).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/types/offline.ts` | Type | Type-level (no test runtime) |
| `src/services/syncEngine.ts` | Service | 6 branches nuevos de `executeAction`: list_create, list_update, list_toggle_public, list_delete, list_item_add, list_item_remove. Verificar que cada uno llama al service correcto con los args esperados. Extend `src/services/__tests__/syncEngine.test.ts` (o crear si no existe). |
| `src/services/sharedLists.ts` | Service | `createList` con `listId` opcional: verifica que con listId usa setDoc, sin listId usa addDoc. Verificar que el returned listId === el input cuando se provee. Extend `src/services/sharedLists.test.ts`. |
| `src/components/lists/CreateListDialog.tsx` | Component | Offline: generar listId client-side, encolar via `withOfflineSupport`, llamar `onCreated` con el ID pre-generado. No-flow: online funciona igual. |
| `src/components/lists/ListDetailScreen.tsx` | Component | 4 handlers offline: `handleColorChange`, `handleTogglePublic`, `handleDelete`, `handleRemoveItem`. Cada uno con `withOfflineSupport`. Verificar que `handleDelete` bloquea offline con toast (no encola). |
| `src/components/business/AddToListDialog.tsx` | Component | `handleToggle` offline (add/remove items), `handleCreate` offline (create + add flow). |
| `src/context/NotificationsContext.tsx` | Context | `markRead` y `markAllRead` con `isOffline=true` hacen early return. No se dispara optimistic update. No toast. |
| `src/components/profile/EditDisplayNameDialog.tsx` | Component | Offline: boton disabled, click muestra toast "No se puede cambiar el nombre sin conexion". |
| `src/components/search/MapErrorBoundary.tsx` | Component | New. Captura error, switch a list view, muestra toast. Caso `GOOGLE_MAPS_API_KEY` vacia → list view desde el inicio. |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (enforcement CI)
- Tests de validacion para `listId` generado client-side (formato, unicidad entre creates concurrentes)
- Todos los paths condicionales cubiertos: isOffline true/false, createList con/sin listId
- Side effects verificados: `trackEvent(EVT_OFFLINE_ACTION_QUEUED)`, `invalidateQueryCache` post-sync
- Cola offline: verificar que las acciones encoladas en orden mantienen FIFO entre list_create → list_item_add para el mismo listId (createList debe ejecutar antes que addItem en replay, sino hay foreign key violation)

---

## Seguridad

Para este feature las piezas relevantes de `docs/reference/security.md` son:

- [x] **Firestore rules sin cambios**: `sharedLists` y `listItems` ya tienen rules con `keys().hasOnly()` y `affectedKeys().hasOnly()` correctos (ver #251 y #289). La nueva ruta de `createList` con listId client-side sigue pasando por la misma rule create (no cambia shape del doc).
- [x] **Service layer**: todos los cambios de componentes siguen llamando a `src/services/sharedLists.ts`. Ningun componente nuevo importa `firebase/firestore` directamente.
- [x] **Rate limit server-side preservado**: `onSharedListCreated` (10 lists/dia, #289) se ejecuta cuando la cola sincroniza. Si un usuario encola 20 creates offline y reconecta, el trigger rechaza (delete) las que excedan. El cliente debe manejar el fallo en syncEngine (maxRetries ya existe).
- [x] **Validacion de input**: `MAX_LISTS=10`, `MAX_LIST_NAME=50`, `MAX_LIST_DESCRIPTION=200` ya se validan client-side y en rules. Sin cambios.
- [x] **IDs generados client-side**: `doc(collection).id` usa el mismo algoritmo Firestore que addDoc (20 chars, entropia suficiente). No hay riesgo de collision.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Cola offline de list_create | Bot encola 1000 creates offline; al reconectar flooda Firestore | `OFFLINE_QUEUE_MAX_ITEMS=50` (existe) + rate limit server-side `onSharedListCreated` (10/dia, existe) + maxRetries=3 (existe). Sin cambios necesarios. |
| Cola offline de list_item_add | Bot encola items a listas ajenas | Rules check `ownerId == request.auth.uid` OR `editorIds.hasAny([request.auth.uid])` en create. Sin cambios. |
| listId client-side predecible | Bot predice listIds para escribir antes que el owner | Firestore auto-genera IDs con 120 bits de entropia (mismo que `addDoc`). Probabilidad 2^-120. No viable. |

**Este feature NO escribe campos nuevos a Firestore**. Solo cambia ROUTE (sync via queue). Por lo tanto los checklists de `hasOnly()` y `affectedKeys()` no aplican (no se agregan campos).

Sobre userSettings y trigger: no se toca `userSettings` ni se agregan colecciones. No aplica.

---

## Deuda tecnica y seguridad

Issues abiertos revisados con `gh issue list --label security --state open` y `gh issue list --label "tech debt" --state open`: ambos devuelven `[]` al 2026-04-18 (todos resueltos tras #289-#299). El backlog (`docs/reports/backlog-producto.md`) lista solo #168 (Vite 8 bloqueado por peer deps) como abierto.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #295 (offline guards — cerrado) | Mitiga parcialmente (FeedbackForm, NotificationsContext toast, perfMetrics) | #304 completa el audit con Lists + otros gaps. No re-tocar archivos ya modificados en #295 salvo agregar guard isOffline faltante en markRead/markAllRead. |
| #289 (sharedLists rate limit — cerrado) | Refuerza esta feature | La cola offline respeta el rate limit server-side (10 lists/dia). Documentar en PRD. |
| #136 (modo offline mejorado — cerrado) | Extiende directamente | Agrega 6 action types nuevos al mismo sistema. |

### Mitigacion incorporada

- Al agregar `list_create` a la queue, confirmamos que `onSharedListCreated` (trigger de #289) se aplica al replay — documentado en security section.
- `MapErrorBoundary` de S3 reduce la superficie de fallo en primer render si Google Maps no carga (relevante para usuarios con tracker blockers/ad blockers agresivos).

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `CreateListDialog.handleCreate`, `ListDetailScreen.handleColorChange/TogglePublic/Delete/RemoveItem`, `AddToListDialog.handleToggle/Create`: verificar que `try/catch` cubre error de `withOfflineSupport` (enqueue puede fallar si IndexedDB rechaza por quota).
- [ ] `MapErrorBoundary`: no hay useState post-unmount (componente de clase tradicional, cleanup automatico).
- [ ] `NotificationsContext.markRead/markAllRead`: agregar `isOffline` al deps array; no hay setState tras await si el guard esta al inicio.
- [ ] `logger.error` fuera de `if (import.meta.env.DEV)` en todos los catch blocks (verificar que los handlers ya cumplen esto; si no, fix).
- [ ] Archivos nuevos no superan 300 lineas: `MapErrorBoundary.tsx` estimado 60 lineas.
- [ ] `listId` en `OfflineAction` se documenta como alternativa a `businessId` (para list_*) y ambos pueden coexistir en items.

### Checklist de observabilidad

- [ ] Nuevos eventos `trackEvent(EVT_OFFLINE_ACTION_QUEUED)` con `action_type: 'list_*'` ya cubiertos por evento generico existente (no hay que agregar evento nuevo).
- [ ] No se introducen triggers Cloud Functions nuevos (trabajan sobre `sharedLists` / `listItems` existentes).
- [ ] No se introducen services nuevos — `sharedLists.ts` ya tiene `measureAsync` en reads criticos.

### Checklist offline

- [x] **Este feature ES el offline** — los dialogs NO se deshabilitan offline (salvo deleteList y callables). El usuario puede crear, editar y eliminar listas offline; se encolan.
- [ ] Error handlers en catch blocks muestran `toast.error` en todos los environments (no solo DEV). Verificar en ListDetailScreen handlers que el catch no este silenciado.
- [ ] `EditDisplayNameDialog` y avatar click: **si** se deshabilitan offline (no encolamos porque `users/{uid}` tiene rules owner-only y no hay beneficio obvio en encolar cambios cosmeticos).

### Checklist de documentacion

- [ ] `docs/reference/features.md` seccion "Modo offline mejorado": actualizar el bullet de acciones encolables para incluir "ratings, comments, favorites, price levels, tags, checkins, follows, recomendaciones, **listas (crear/editar/eliminar/items)**".
- [ ] `docs/reference/patterns.md` seccion "Offline queue": actualizar bullet "Offline action types" a "15 tipos" (de 9 actuales).
- [ ] `docs/reference/firestore.md`: sin cambios (no hay campos nuevos).
- [ ] Nuevos tipos en `src/types/offline.ts` — archivo existente de dominio, correcto appendear alla (no es barrel).
- [ ] No hay HomeScreen sections nuevas — no aplica `homeSections.ts`.
- [ ] No hay eventos analytics nuevos — no aplica.

---

## Offline

Este PRD **es** la estrategia offline para el dominio Lists. Data flows explicitos:

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `createList` | write | Queue `list_create` + client-gen listId + optimistic UI con la lista nueva en state | Toast "Guardado offline — se sincronizara al reconectar" |
| `updateList` (nombre/desc/color/icon) | write | Queue `list_update` + optimistic UI | Toast offline |
| `toggleListPublic` | write | Queue `list_toggle_public` + optimistic UI con chip "Privada"/"Publica" flip | Toast offline |
| `deleteList` | write | **Bloquear offline** — el cascade delete offline es inseguro (batch de hasta 500 docs). Disabled + Alert "Requiere conexion" | Alert en dialog |
| `addBusinessToList` | write | Queue `list_item_add` + optimistic UI con check en dialog | Toast offline |
| `removeBusinessFromList` | write | Queue `list_item_remove` + optimistic UI | Toast offline |
| `fetchUserLists` / `fetchListItems` | read | Firestore persistent cache (`persistentLocalCache`) ya activo en prod. Primera carga offline muestra lista vacia — reutilizar stale cache si existe. | Empty state |
| `fetchFeaturedLists` (callable) | read | localStorage cache ya existente con TTL. S4 agrega chip "Desactualizado" si fallback | Chip |
| `markNotificationRead/All` | write | Early return si offline (no encolar) | Sin toast, sin optimistic |
| `setDisplayName/Avatar` | write | Block UI offline + toast informativo al intentar | Disabled button + toast |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (ya activa prod via `persistentLocalCache`).
- [x] Writes: queue offline (6 nuevas) o bloqueo intencional (deleteList, mark-read, setDisplayName).
- [x] APIs externas: Google Maps tiene `MapErrorBoundary` fallback.
- [x] UI: `OfflineIndicator` global ya visible.
- [x] Datos criticos: Listas del usuario en persistent cache.

### Esfuerzo offline adicional: M

---

## Modularizacion y % monolitico

El proyecto esta en 30% monolitico. Este feature **reduce** acoplamiento agregando mas operaciones a la capa existente de offline queue en vez de componentes hackear isOffline con if/else.

### Checklist modularizacion

- [ ] Logica de queue en `syncEngine.ts` (service). Componentes solo llaman `withOfflineSupport` wrapper.
- [ ] `MapErrorBoundary` es reutilizable (no hardcodea a SearchScreen).
- [ ] No se agregan `useState` de business logic a AppShell o SideMenu.
- [ ] Props explicitas en CreateListDialog `onCreated`: acepta `listId` (sea pre-generado o post-addDoc — transparente para el caller).
- [ ] Cada prop de accion tiene handler real — sin noops.
- [ ] Ningun componente nuevo importa `firebase/firestore`, `firebase/functions`, `firebase/storage`. `sharedLists.ts` service se extiende.
- [ ] `src/hooks/` sin cambios (no hay hooks nuevos).
- [ ] `src/constants/storage.ts`: agregar key para cache si necesario (S4). Reutilizar key existente.
- [ ] Archivos nuevos no superan 400 lineas: `MapErrorBoundary.tsx` estimado 60 lineas; `syncEngine.ts` crece de ~170 a ~230 lineas (ok).
- [ ] Converters nuevos: ninguno (no hay colecciones nuevas).
- [ ] Archivos nuevos en carpeta correcta: `MapErrorBoundary.tsx` en `components/search/`.
- [ ] No crear contexto nuevo: reutilizar `ConnectivityContext` existente.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Componentes de lists usan wrapper existente, no se acoplan entre si |
| Estado global | = | Solo se consume `useConnectivity` y `useAuth` existentes |
| Firebase coupling | - | `createList` client-gen ID evita hacer round-trip extra, reduce dependency en sync |
| Organizacion por dominio | = | Todos los archivos tocados estan en su dominio (lists/, business/, profile/, search/, context/, services/) |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] `MapErrorBoundary` fallback: boton "Intentar de nuevo" con `aria-label="Reintentar cargar mapa"`.
- [ ] Botones disabled offline en `EditDisplayNameDialog`: `aria-disabled="true"` ademas de `disabled` (MUI lo maneja automaticamente).
- [ ] Avatar `Avatar` en ProfileScreen ya tiene `role="button"` + `tabIndex={0}` + `aria-label="Cambiar avatar"`. Offline: agregar `aria-disabled="true"`.
- [ ] Touch targets: todos los botones afectados son MUI Button/IconButton size-default (>=40x40). Sin cambios.
- [ ] Error state en MapErrorBoundary con texto legible (no solo spinner forever).
- [ ] Imagenes: no aplica.
- [ ] Formularios: CreateListDialog ya tiene labels.

### Checklist de copy

- [x] Espanol con tildes: "No se puede cambiar el nombre sin conexion" (sin tilde necesaria).
- [x] Voseo: "Intentá de nuevo cuando vuelvas a tener conexion".
- [x] Terminologia: "listas" (correcto).
- [x] Strings centralizados en `src/constants/messages/offline.ts` y `lists.ts`: agregar `MSG_LIST.featuredStale`, `MSG_COMMON.noConnectionForAction` (o similar).
- [x] Mensajes accionables: "No se pudo cargar el mapa. Mostrando lista." (en vez de "Error").

---

## Success Criteria

1. Crear, editar y eliminar listas (y agregar/quitar items) offline encola acciones correctamente, muestra toast "Guardado offline" y sincroniza al reconectar sin errores.
2. `createList` offline devuelve un listId valido y la UI optimista muestra la lista nueva sin flickering al reconectar (el listId no cambia post-sync).
3. `markNotificationRead` offline no dispara `toast.error` — es un no-op silencioso que se reintenta logicamente al proximo polling cuando haya red.
4. `EditDisplayNameDialog` y click en avatar muestran estado disabled offline con toast explicativo al intentar interactuar.
5. Si Google Maps no carga (API key vacia, offline first render, quota), `SearchScreen` renderiza `SearchListView` como fallback con toast explicativo y boton de reintentar.
6. Cobertura de tests >= 80% para `syncEngine.ts` y los componentes modificados.
