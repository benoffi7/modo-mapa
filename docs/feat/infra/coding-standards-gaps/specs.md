# Specs: Coding Standards — Documentar patrones arquitecturales faltantes

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No aplica. Este feature es puramente documentacion. No se crean ni modifican colecciones, documentos ni tipos de Firestore.

## Firestore Rules

No aplica. No se modifican Firestore rules.

### Rules impact analysis

No hay queries nuevas. No se modifica codigo de produccion.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | N/A |

### Field whitelist check

No se agregan ni modifican campos.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | N/A |

## Cloud Functions

No aplica. No se crean ni modifican Cloud Functions.

## Componentes

No aplica. No se crean ni modifican componentes React.

### Mutable prop audit

No aplica.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| N/A | N/A | N/A | N/A | N/A |

## Textos de usuario

No aplica. No hay textos user-facing nuevos (el feature es documentacion interna).

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| N/A | N/A | N/A |

## Hooks

No aplica. No se crean ni modifican hooks.

## Servicios

No aplica. No se crean ni modifican servicios.

## Integracion

No aplica. No se modifica codigo de produccion.

### Preventive checklist

No aplica (feature de documentacion pura).

- [x] **Service layer**: No se agrega codigo — N/A
- [x] **Duplicated constants**: No se agrega codigo — N/A
- [x] **Context-first data**: No se agrega codigo — N/A
- [x] **Silent .catch**: No se agrega codigo — N/A
- [x] **Stale props**: No se agrega codigo — N/A

## Tests

No hay codigo de produccion nuevo. No se requieren tests.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| N/A | N/A | N/A |

### Criterios de validacion (no tests, sino review)

1. Cada seccion nueva en `coding-standards.md` tiene: descripcion, ubicacion en codebase, ejemplo de uso, y regla de decision
2. Las cross-references a `patterns.md` usan anchors validos (verificar que los anchors existen)
3. Los 3 issues de GitHub se crean con label `tech debt` y body descriptivo

## Analytics

No aplica. No se agregan eventos de analytics.

---

## Offline

No aplica. Feature de documentacion sin data flows.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

### D1: Documentar en coding-standards.md vs crear documentos separados

**Decision:** Agregar secciones a `coding-standards.md` existente.
**Razon:** El documento ya tiene la estructura y audiencia correcta. Crear documentos separados fragmentaria la referencia y obligaria a buscar en multiples archivos. El scope de cada seccion es breve (descripcion + ejemplo + regla de decision), no justifica archivos separados.

### D2: Cross-reference vs duplicacion

**Decision:** No duplicar contenido que ya existe en `patterns.md`. En su lugar, agregar en `coding-standards.md` un resumen de una linea + link a la seccion de `patterns.md`, mas la regla de decision ("cuando usar esto").
**Razon:** `patterns.md` ya documenta el "que". `coding-standards.md` debe agregar el "cuando" y el "como decidir", no repetir el "que".

### D3: Issues de tech debt como entregable

**Decision:** Crear 3 issues de GitHub con label `tech debt` en vez de resolver las violaciones.
**Razon:** El PRD explicitamente excluye refactoring del scope. Las violaciones quedan trackeadas en el backlog para ser priorizadas independientemente.

---

## Contenido de las 10 secciones nuevas

A continuacion se detalla que debe contener cada seccion nueva de `coding-standards.md`. Esto es la especificacion del contenido, no el contenido final (que se escribe en la fase de implementacion).

### S1. Offline Support System

**Ubicacion en codebase:**
- `src/services/offlineInterceptor.ts` — wrapper `withOfflineSupport()`
- `src/services/offlineQueue.ts` — IndexedDB queue con subscribe/notify
- `src/services/syncEngine.ts` — procesamiento de cola con dynamic imports
- `src/context/ConnectivityContext.tsx` — deteccion de conectividad + auto-sync
- `src/types/offline.ts` — union discriminada `OfflineActionType` (9 tipos)

**Cross-ref:** `patterns.md` seccion "Offline queue" (describe `withOfflineSupport`, `ConnectivityContext`, `offlineQueue`, `syncEngine`)

**Contenido requerido:**
- Diagrama de flujo: componente -> `withOfflineSupport()` -> si online: ejecuta servicio, si offline: encola en IndexedDB
- Regla de decision: cuando wrappear con `withOfflineSupport` (cualquier write user-facing que puede fallar por conectividad)
- Ejemplo de uso real: `useFollow.ts` linea que llama `withOfflineSupport`
- Notas: los servicios no se modifican, el wrapper es transparente

### S2. Client-side Cache con IndexedDB (3-tier)

**Ubicacion en codebase:**
- `src/services/readCache.ts` — IndexedDB cache LRU (20 entries, TTL configurable)
- `src/services/queryCache.ts` — module-level Map cache (TTL 2 min) para primera pagina paginada
- `src/hooks/useBusinessDataCache.ts` — module-level Map cache (TTL 5 min) para business view
- `src/hooks/useBusinessData.ts` — orquesta el flujo 3-tier: memory -> IndexedDB -> Firestore

**Cross-ref:** `patterns.md` seccion "Queries y cache" (describe `readCache 3-tier lookup`, `patchBusinessCache`, `selective refetch`)

**Contenido requerido:**
- Diagrama 3-tier: memory cache (Map) -> IndexedDB (readCache) -> Firestore
- Cuando datos vienen de IndexedDB, se marcan `stale: true` y se muestra `StaleBanner`
- Regla de decision: memory cache para re-renders rapidos, IndexedDB para persistencia entre sesiones, Firestore como fuente de verdad
- TTLs actuales: memory 5 min (business data), 2 min (query cache), IndexedDB configurable via `READ_CACHE_TTL_MS`
- Invalidacion: `invalidateBusinessCache()`, `invalidateQueryCache()`, se llaman en cada write

### S3. Deep Linking

**Ubicacion en codebase:**
- `src/hooks/useDeepLinks.ts` — procesa query params al montar
- `src/components/layout/TabShell.tsx` — llama `useDeepLinks()`

**Cross-ref:** `patterns.md` seccion "UI patterns" (menciona `?business={id}`) y seccion "Shared lists" (menciona `?list={id}`)

**Contenido requerido:**
- Deep links soportados: `?business={id}` (abre BusinessSheet en tab Buscar), `?tab={tabId}` (cambia a tab)
- Validacion: `BUSINESS_ID_RE = /^biz_\d{1,6}$/`, tabs validadas contra `VALID_TABS`
- Los params se consumen y eliminan de la URL despues de procesar (`replace: true`)
- Regla de decision: para agregar un nuevo deep link, agregar case en `useDeepLinks.ts`, validar input con regex, limpiar el param despues de consumirlo
- Ejemplo: `ShareButton` genera URL con `?business={id}`

### S4. Screen Tracking

**Ubicacion en codebase:**
- `src/hooks/useScreenTracking.ts` — trackea `screen_view` en cada cambio de ruta

**Cross-ref:** `patterns.md` seccion "Analytics event naming" (convencion `EVT_*`)

**Contenido requerido:**
- Convencion de nombres: path `/` -> `map`, `/admin/users` -> `admin_users`
- Usa `trackEvent('screen_view', { screen_name })` (evento de Firebase Analytics)
- Se llama una vez en `App.tsx`, no necesita integracion por componente
- Regla de decision: no agregar screen tracking manual; el hook lo maneja automaticamente para todas las rutas

### S5. Optimistic Updates

**Ubicacion en codebase:**
- `src/hooks/useOptimisticLikes.ts` — Map-based toggle con delta count
- `src/hooks/useUndoDelete.ts` — Map de pending deletes con timer + snackbar
- `src/hooks/useBusinessRating.ts` — `pendingRating` state
- `src/components/business/BusinessPriceLevel.tsx` — `pendingLevel` state
- `src/components/business/FavoriteButton.tsx` — derived state (`prevIsFavorite` + `optimistic`)
- `src/hooks/useFollow.ts` — optimistic toggle con revert on error

**Cross-ref:** `patterns.md` seccion "UI patterns" > "Optimistic UI" (describe cada variante)

**Contenido requerido:**
- Tabla de variantes con regla de decision:
  - **Map-based (likes):** cuando hay N items independientes que pueden togglarse
  - **Pending state (rating/price):** cuando hay un solo valor que se actualiza
  - **Derived state (favorite):** cuando el parent re-renderiza y puede sobreescribir el optimistic
  - **Undo delete:** cuando la accion es destructiva y reversible
  - **Revert on error (follow):** cuando no hay undo UI, solo rollback silencioso
- Ejemplo de codigo de cada variante (snippet corto)
- Regla: siempre hacer optimistic update para acciones user-facing. Elegir variante segun la tabla

### S6. Converter Layers

**Ubicacion en codebase:**
- `src/config/converters.ts` — 15+ converters para reads de colecciones user-facing
- `src/config/adminConverters.ts` — converters para admin panel (counters, metrics, abuse)
- `src/config/metricsConverter.ts` — converter para metricas publicas

**Cross-ref:** `patterns.md` seccion "Datos y estado" > `withConverter<T>()` y seccion en `firestore.md` > "Converters"

**Contenido requerido:**
- Regla de decision: que converter usar segun quien lee:
  - User-facing reads -> `converters.ts`
  - Admin panel reads -> `adminConverters.ts`
  - Public metrics (no auth) -> `metricsConverter.ts`
- Regla: lecturas siempre con `withConverter<T>()`, escrituras sin converter (por `serverTimestamp()`)
- Patron: todos los converters usan `toDate()` de `src/utils/formatDate.ts` para timestamps
- Ejemplo de como agregar un converter nuevo

### S7. Analytics Event Naming

**Ubicacion en codebase:**
- `src/constants/analyticsEvents.ts` — constantes `EVT_*` agrupadas por feature
- `src/utils/analytics.ts` — `trackEvent()` wrapper

**Cross-ref:** `patterns.md` seccion "Constantes centralizadas" > "Analytics event names"

**Contenido requerido:**
- Convencion: `EVT_` prefix, `SCREAMING_SNAKE_CASE`, agrupadas por feature con comentario de issue
- Regla: nunca usar string literals para `trackEvent`, siempre importar constante de `analyticsEvents.ts`
- Naming: `{feature}_{action}` (ej: `offline_action_queued`, `trending_viewed`, `follow`)
- Ejemplo de como agregar un evento nuevo (definir constante + usar en componente/hook)

### S8. Storage Decision Criteria

**Contenido requerido — tabla de decision:**

| Storage | Cuando usar | Ejemplos en codebase | Caracteristicas |
|---------|------------|---------------------|-----------------|
| `localStorage` | Preferencias de dispositivo, flags de UI, datos pequenos (<10KB) que persisten entre sesiones | Color mode, remembered email, onboarding flags, visit history, quick actions order | Sincrono, string-only, 5MB limite, no estructurado |
| Context (React) | Estado de sesion compartido entre componentes, datos que no persisten entre recargas (excepto si backed by localStorage) | Auth user, selected business, active tab, toast, connectivity, notifications | Reactivo, in-memory, se pierde al recargar (salvo backing store) |
| IndexedDB | Cache de datos grandes, offline queue, datos estructurados que persisten | `readCache.ts` (business data cache), `offlineQueue.ts` (pending writes) | Async, structured, sin limite practico, soporta indices |

**Regla de decision rapida:**
1. Es una preferencia de UI o flag booleano? -> `localStorage`
2. Lo necesitan multiples componentes en la misma sesion? -> Context
3. Es cache de datos grandes o cola de escrituras offline? -> IndexedDB

### S9. Advanced Pagination

**Ubicacion en codebase:**
- `src/hooks/usePaginatedQuery.ts` — hook generico

**Cross-ref:** `patterns.md` seccion "Queries y cache" > `usePaginatedQuery` y `usePaginatedQuery constraints genericos`

**Contenido requerido:**
- API: `usePaginatedQuery<T>(collectionRef, constraints, orderByField, pageSize, cacheKey)`
- Cursor-based: usa `QueryDocumentSnapshot` como cursor con `startAfter`
- `cacheKey` obligatorio para cache compat (`queryCache.ts`)
- `loadAll(maxItems)` para loops async con `hasMoreRef` safety
- Backward compat: `constraints` acepta `string` (userId) o `QueryConstraint[]`
- Regla: usar siempre `cacheKey` unico por query. Para listas de usuario, usar `userId` como key
- Ejemplo de uso: `FavoritesList`, `CommentsList`, `RatingsList`

### S10. Component Sub-folder Organization

**Ubicacion en codebase:**
- `src/components/admin/perf/` — SemaphoreCard, QueryLatencyTable, FunctionTimingTable, StorageCard, perfHelpers
- `src/components/admin/alerts/` — KpiCard, alertsHelpers, ReincidentesView

**Contenido requerido:**
- Regla de decision: crear sub-carpeta cuando un componente tiene 3+ archivos relacionados (componente principal + subcomponentes/types/utils/hooks)
- Estructura estandar de sub-carpeta:
  ```
  ComponentName/
    ComponentName.tsx     # Orquestador principal
    SubComponent.tsx      # Subcomponentes con React.memo
    componentHelpers.ts   # Utilidades puras
    componentTypes.ts     # Tipos/interfaces (opcional)
  ```
- Si un componente tiene 1-2 archivos, mantener estructura plana
- Ejemplo: `admin/perf/` tiene 5 archivos -> sub-carpeta. `business/CustomTagDialog.tsx` es 1 archivo -> plano

---

## Hardening de seguridad

No aplica. Feature de documentacion sin superficie de ataque nueva.

### Firestore rules requeridas

No se modifican rules.

### Rate limiting

No aplica.

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| N/A | N/A | N/A |

### Vectores de ataque mitigados

No aplica.

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | N/A | N/A |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de `tech debt` ni `security` en GitHub actualmente.

Este feature **crea** 3 issues nuevos de tech debt como parte de sus entregables:

| Violacion detectada | Issue a crear | Descripcion |
|-------------------|--------------|-------------|
| `BusinessComments.tsx` — 398 lineas | Tech debt issue | Supera limite de 300 lineas. Requiere extraer subcomponentes |
| `BusinessQuestions.tsx` — 392 lineas + noop callbacks (lineas 139-140: `() => {}`) | Tech debt issue | Supera limite de 300 lineas. Tiene `noopEdit` y `noopEditText` como `() => {}` en vez de `throw new Error('not implemented')` |
| `FollowedList.tsx` — importa `QueryDocumentSnapshot` de `firebase/firestore` | Tech debt issue | Viola boundary de service layer. Debe usar `usePaginatedQuery` o mover la paginacion a un servicio |

Estos issues se crean en la Fase 2 del plan.
