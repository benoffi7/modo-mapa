# PRD: Admin Config Collection Viewer/Editor

**Feature:** 256-admin-config-viewer
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #256
**Prioridad:** Alta

---

## Contexto

El admin panel de Modo Mapa tiene 16 tabs que cubren metricas, feedback, usuarios, alertas y mas, pero la coleccion `config` de Firestore (que contiene feature flags, contadores, moderacion, version de app y performance counters) solo es visible parcialmente via el DashboardOverview que lee `config/counters`. No hay forma de inspeccionar o editar documentos individuales como `config/moderation` (banned words) o `config/appVersion`. Tampoco existe visibilidad sobre la subcolleccion `activityFeed/{userId}/items`, lo que impide diagnosticar feeds vacios o stale de usuarios. Actualmente, cualquier cambio o diagnostico requiere acceso directo a la consola de Firebase.

## Problema

- **Config invisible**: Los documentos `config/counters`, `config/moderation`, `config/perfCounters`, `config/appVersion`, `config/aggregates` y `config/analyticsCache` no tienen un panel dedicado para inspeccion. Solo `counters` se lee indirectamente desde DashboardOverview.
- **Sin editor de feature flags/moderacion**: Cambiar la lista de banned words o inspeccionar el estado de `appVersion.minVersion` requiere abrir la consola de Firestore en produccion, sin audit trail ni validacion.
- **Activity feed opaco**: Cuando un usuario reporta que su feed de actividad esta vacio, no hay forma de verificar si `activityFeed/{userId}/items` tiene datos, si estan expirados, o si el fan-out fallo. El diagnostico requiere queries manuales en la consola.

## Solucion

### S1: Config Viewer Panel (nueva tab en AdminLayout)

Agregar una tab "Config" (tab 17) al AdminLayout que muestre todos los documentos de la coleccion `config` en un layout de accordion/cards. Cada documento se renderiza con sus campos en formato key-value legible.

Documentos conocidos a mostrar:

- `counters` — totales y operaciones diarias (read-only, ya gestionado por Cloud Functions)
- `moderation` — lista de banned words (editable)
- `appVersion` — minVersion y updatedAt (read-only, gestionado por CI/CD)
- `perfCounters` — timings de Cloud Functions (read-only, reset diario)
- `aggregates` — datos agregados para featured lists y daily metrics (read-only)
- `analyticsCache` — cache de reportes de analytics (read-only)

La UI usa `useAsyncData` + `AdminPanelWrapper` siguiendo el patron existente de todos los paneles admin.

### S2: Config Editor para moderation

Permitir edicion inline de `config/moderation.bannedWords` (el unico documento que tiene sentido editar desde el panel). La edicion requiere confirmacion via dialog y se ejecuta mediante una nueva Cloud Function callable `updateModerationConfig` que valida el input y escribe con Admin SDK.

No se permite edicion directa de `counters`, `perfCounters`, `aggregates` ni `appVersion` ya que son gestionados por Cloud Functions y CI/CD respectivamente.

### S3: Activity Feed Diagnostics

Agregar una seccion dentro del panel Config (o como subseccion del tab Social existente) que permita buscar un usuario por ID o nombre y listar los ultimos N items de `activityFeed/{userId}/items`. Muestra: tipo de actividad, actor, negocio, fecha, y si el item esta expirado. Usa una nueva Cloud Function callable `getActivityFeedDiag` que lee la subcolleccion con Admin SDK.

UX: campo de busqueda por userId + boton "Buscar". Resultados en tabla con columnas: Tipo, Actor, Negocio, Fecha, Estado (activo/expirado). Chip de color por tipo (rating=blue, comment=green, favorite=pink).

### S4: Audit log para cambios de config

Cada escritura a `config/moderation` via la callable loguea un entry en `abuseLogs` con `type: 'config_edit'`, `detail` con el campo modificado y valores antes/despues, y el `userId` del admin. Reutiliza la infraestructura existente de `abuseLogger.ts`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| ConfigPanel component (viewer de todos los docs config) | P0 | M |
| Service layer: `src/services/admin/config.ts` (fetch config docs) | P0 | S |
| Cloud Function callable `updateModerationConfig` | P0 | M |
| Editor inline de moderation.bannedWords con dialog de confirmacion | P0 | M |
| Cloud Function callable `getActivityFeedDiag` | P1 | M |
| Activity feed diagnostics UI (busqueda + tabla de items) | P1 | M |
| Audit log de cambios via abuseLogger | P1 | S |
| Tab en AdminLayout (tab 17: Config) | P0 | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Editor generico de cualquier documento Firestore (solo config collection)
- Edicion de `config/counters`, `config/appVersion`, `config/perfCounters`, `config/aggregates` (gestionados por Functions/CI)
- Crear nuevos documentos en la coleccion config desde el panel
- Activity feed cleanup/repair desde el panel (solo diagnostico)
- Migracion de la estructura de la coleccion config

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/admin/config.ts` | Service | fetchConfigDocs, fetchConfigDoc para cada doc conocido, manejo de docs inexistentes |
| `functions/src/admin/moderationConfig.ts` | Callable | Validacion de input (bannedWords array, strings, length), assertAdmin, audit log write, App Check |
| `functions/src/admin/activityFeedDiag.ts` | Callable | Validacion de userId, paginacion, assertAdmin, items expirados vs activos |
| `src/components/admin/ConfigPanel.tsx` | Component | Render de cada seccion, loading/error states via AdminPanelWrapper |
| `src/components/admin/config/ModerationEditor.tsx` | Component | Dialog open/close, submit con confirmacion, validacion client-side |
| `src/components/admin/config/ActivityFeedDiag.tsx` | Component | Busqueda, render de resultados, estados vacio/loading/error |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (bannedWords array, userId search)
- Todos los paths condicionales cubiertos (doc existe/no existe, array vacio, items expirados)
- Side effects verificados (audit log write, cache invalidation)

---

## Seguridad

- [x] `config` collection ya tiene Firestore rules: read solo para `isAdmin()`, write `false` (Admin SDK bypasea)
- [x] `activityFeed/{userId}/items` tiene read solo para owner; la callable usa Admin SDK
- [ ] Nueva callable `updateModerationConfig` debe verificar admin via `assertAdmin()` (email + email_verified)
- [ ] Nueva callable `getActivityFeedDiag` debe verificar admin via `assertAdmin()`
- [ ] Ambas callables deben tener `enforceAppCheck: !IS_EMULATOR`
- [ ] Rate limit en `updateModerationConfig`: 5/min por usuario via `checkCallableRateLimit`
- [ ] Validar que `bannedWords` es un array de strings, cada string <= 50 chars, array <= 500 items
- [ ] No exponer datos sensibles de usuarios en el diagnostico de activity feed (solo actorName publico, no UIDs completos en UI — aunque admin ya tiene acceso a UIDs)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `updateModerationConfig` callable | Spam de actualizaciones para degradar moderacion | Rate limit 5/min + assertAdmin + App Check |
| `getActivityFeedDiag` callable | Scraping de activity feed de otros usuarios | assertAdmin + App Check + limit en resultados (max 50) |

No se escriben nuevas colecciones de Firestore desde el cliente. Las writes son exclusivamente via Admin SDK en Cloud Functions, por lo que no aplican reglas de `hasOnly()` ni `affectedKeys()` para este feature.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #168 Vite 8 + ESLint 10 bloqueado | No afecta | Sin accion |

No hay issues abiertos de seguridad o tech debt que afecten directamente a este feature. La coleccion `config` ya tiene rules correctas (admin read, Functions write). La infraestructura de `assertAdmin` y `checkCallableRateLimit` esta probada y reutilizable.

### Mitigacion incorporada

- Audit log de cambios a `config/moderation` reutilizando `abuseLogger.ts` existente. Esto agrega trazabilidad que hoy no existe para cambios manuales en Firestore Console.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `useAsyncData` ya implementa cancelacion correcta (`let ignore = false`) — los nuevos paneles lo reutilizan
- [ ] Handlers de edicion de moderation tienen `try/catch` con toast de error
- [ ] No hay `setState` despues de operaciones async sin guard de unmount (garantizado por `useAsyncData`)
- [ ] Funciones internas del servicio no se exportan innecesariamente
- [ ] Archivos en `src/hooks/` usan al menos un React hook
- [ ] Constantes de coleccion usan `COLLECTIONS` de `src/config/collections.ts`
- [ ] Ningun archivo nuevo supera 300 lineas

### Checklist de documentacion

- [ ] Nuevos analytics events en archivo de dominio bajo `src/constants/analyticsEvents/admin.ts`
- [ ] `docs/reference/features.md` actualizado con la nueva feature (tab Config en admin)
- [ ] `docs/reference/firestore.md` no requiere actualizacion (no hay colecciones nuevas)
- [ ] `docs/reference/patterns.md` actualizado si el patron de config editor es reutilizable

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Fetch config docs | read | Firestore persistent cache en prod | AdminPanelWrapper error state con retry |
| Update moderation bannedWords | write (callable) | No soportado offline | Boton deshabilitado + mensaje si offline |
| Fetch activity feed diag | read (callable) | No soportado offline | Error state con mensaje de conectividad |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline via `persistentLocalCache` en prod
- [ ] Writes: callable no tiene queue offline (aceptable para admin — siempre con conexion)
- [ ] APIs externas: N/A
- [ ] UI: mostrar estado offline si `navigator.onLine === false` deshabilitando botones de accion
- [x] Datos criticos: config docs disponibles en cache de Firestore para primera carga

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica de negocio en `src/services/admin/config.ts` (no inline en componentes)
- [ ] ConfigPanel es reutilizable como tab independiente
- [ ] No se agregan useState de logica de negocio a AdminLayout (solo tab state existente)
- [ ] Props explicitas en subcomponentes (ModerationEditor, ActivityFeedDiag)
- [ ] Cada prop de accion tiene handler real (onSave, onSearch)
- [ ] Ningun componente nuevo importa directamente de `firebase/firestore` — usa service layer
- [ ] Archivos nuevos van en `src/components/admin/config/` (subdirectorio de dominio)
- [ ] Ningun archivo nuevo supera 400 lineas
- [ ] Callables nuevas van en `functions/src/admin/` (directorio correcto)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | ConfigPanel es un tab independiente, subcomponentes en subdirectorio propio |
| Estado global | = | Sin contextos nuevos, usa useAsyncData existente |
| Firebase coupling | = | Queries en service layer, callable via httpsCallable |
| Organizacion por dominio | + | Nuevo subdirectorio `admin/config/` sigue patron de `admin/perf/` y `admin/alerts/` |

---

## Success Criteria

1. El admin puede ver todos los documentos de la coleccion `config` desde el panel sin acceder a Firestore Console
2. El admin puede editar la lista de banned words de moderacion con validacion y confirmacion, y el cambio queda registrado en audit log
3. El admin puede buscar un usuario y ver los ultimos 50 items de su activity feed para diagnosticar feeds vacios o stale
4. Todas las operaciones admin estan protegidas por assertAdmin + App Check + rate limiting
5. La nueva tab se integra al AdminLayout existente sin romper el flujo de las 16 tabs actuales
