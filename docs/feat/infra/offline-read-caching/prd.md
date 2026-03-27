# PRD: Offline read caching -- businesses, comments, profile

**Feature:** offline-read-caching
**Categoria:** infra
**Fecha:** 2026-03-27
**Issue:** #197
**Prioridad:** Media

---

## Contexto

Modo Mapa ya tiene un sistema robusto de escrituras offline (#136): las acciones del usuario se encolan en IndexedDB via `withOfflineSupport` y se sincronizan al reconectar. En produccion, Firestore usa `persistentLocalCache` con `persistentMultipleTabManager`, lo cual cachea documentos que ya fueron leidos por el SDK. Sin embargo, no hay una capa de cache de lectura explicita a nivel de aplicacion que garantice acceso offline a datos de negocios visitados, comentarios o perfil del usuario. Ademas, la busqueda depende completamente de datos en memoria que se pierden al recargar.

## Problema

- Cuando el usuario pierde conexion, no puede volver a ver negocios que ya visito en la sesion porque `useBusinessData` depende de queries Firestore que pueden no resolver desde el cache persistente de Firestore si los datos no fueron cacheados por el SDK.
- La busqueda (`SearchScreen` / `useBusinesses`) filtra sobre `businesses.json` (datos estaticos en memoria), pero los datos dinamicos (ratings, comentarios) no estan disponibles offline, lo que hace que abrir un negocio falle.
- El cache in-memory actual (`useBusinessDataCache` con Map y TTL 5 min, `queryCache` con TTL 2 min) se pierde al recargar la pagina. No hay persistencia entre sesiones.

## Solucion

### S1. Read-through cache persistente para business data

Extender `useBusinessDataCache` para que, ademas del cache in-memory (`Map`), persista las entradas en IndexedDB. Al hacer un fetch exitoso de business data, guardar el resultado en IndexedDB. Al solicitar datos de un negocio, intentar: (1) cache in-memory, (2) IndexedDB, (3) Firestore. Mantener el TTL de 5 min para el cache in-memory, pero usar un TTL mas largo (24h) para IndexedDB como fallback offline. Cuando se sirven datos de IndexedDB, marcarlos como `stale: true` para que la UI muestre un indicador.

Alinear con el patron existente de `offlineQueue.ts`: usar IndexedDB nativa (sin dependencias externas), singleton DB, y constantes en `src/constants/cache.ts`.

### S2. Cache de ultimos N negocios visitados

Mantener un registro de los ultimos 20 negocios visitados en IndexedDB (ya existe `STORAGE_KEY_VISITS` en localStorage para recientes, pero solo guarda IDs). Cada vez que `useBusinessData` resuelve datos de un negocio, persistir el snapshot completo (ratings, comments, tags, priceLevels, menuPhoto, isFavorite) en IndexedDB. Usar un store separado del offline queue (`modo-mapa-read-cache`). Al alcanzar el limite de 20, evictar el mas antiguo (LRU).

### S3. Busqueda offline con fallback a datos locales

Cuando `ConnectivityContext` indica offline, la busqueda en `SearchScreen` debe ofrecer resultados del cache de IndexedDB. Los datos estaticos de `businesses.json` ya estan disponibles en memoria para nombre/categoria. Para datos dinamicos, cruzar con los negocios cacheados en IndexedDB. Mostrar un chip/badge "Resultados offline" cuando se usen datos cacheados.

### S4. Indicador de datos stale

Cuando la UI muestra datos servidos desde IndexedDB (no frescos de Firestore), renderizar un banner sutil: "Datos pueden no estar actualizados" (Alert severity="info", dismissible). Reutilizar el patron de `OfflineIndicator` existente. El banner debe aparecer dentro de `BusinessSheet`, no a nivel global.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Read-through cache con IndexedDB para business data | Alta | M |
| S2. Persistencia de ultimos 20 negocios (LRU en IndexedDB) | Alta | M |
| S3. Busqueda offline con fallback a cache local | Media | S |
| S4. Indicador de datos stale en BusinessSheet | Media | S |
| Constantes nuevas en `constants/cache.ts` | Alta | XS |
| Analytics events para cache hits/misses | Baja | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Cache de datos de perfil de otros usuarios (solo datos de business view)
- Sincronizacion bidireccional de cache (el cache de lectura es read-only, no se escriben cambios locales)
- Cache de imagenes de menu (las fotos se manejan via Service Worker/Workbox precaching)
- Notificaciones offline (ya tienen su propio sistema de polling)
- Migracion del cache in-memory existente a una libreria externa (idb, Dexie)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/readCache.ts` (nuevo) | Service | CRUD en IndexedDB mock, TTL expiry, LRU eviction, serialization/deserialization de Sets |
| `src/hooks/useBusinessDataCache.ts` (modificado) | Hook | Fallback a IndexedDB cuando in-memory miss, stale flag propagation |
| `src/hooks/useBusinessDataCache.test.ts` (extender) | Test | Nuevos casos de cache miss -> IndexedDB hit, cache miss -> IndexedDB expired, LRU eviction |
| `src/components/business/StaleBanner.tsx` (nuevo) | Component | Render cuando stale=true, no render cuando fresh, dismiss behavior |
| `src/services/readCache.test.ts` (nuevo) | Test | openDb, getEntry, setEntry, evictOldest, clearAll |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para TTL expiry (fake timers)
- Todos los paths condicionales cubiertos (in-memory hit, IndexedDB hit stale, IndexedDB hit fresh, full miss)
- Side effects verificados (IndexedDB writes, analytics events)
- Mock de IndexedDB siguiendo el patron de `offlineQueue.test.ts`

---

## Seguridad

- [x] Sin colecciones nuevas de Firestore (solo cache client-side)
- [ ] Datos en IndexedDB no contienen secretos, pero si contienen datos de usuario (comentarios, ratings). Documentar en PrivacyPolicy que IndexedDB almacena datos de negocios visitados
- [ ] Limpiar cache de IndexedDB en `DeleteAccountDialog` (alinear con `clearAllBusinessCache()` y `invalidateAllQueryCache()` existentes)
- [ ] No cachear datos sensibles de otros usuarios (solo datos publicos que ya se muestran en la UI)
- [ ] El cache debe respetar el scope del usuario autenticado: al hacer logout, limpiar el cache (alinear con el cleanup de `signOut` en `emailAuth.ts`)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Abrir negocio visitado | read | IndexedDB read-through cache (TTL 24h) | Datos cacheados + banner "datos pueden no estar actualizados" |
| Abrir negocio no visitado | read | Sin cache | Empty state con mensaje "No disponible offline" |
| Busqueda | read | `businesses.json` (estatico, siempre disponible) + cruce con cache IndexedDB | Chip "Resultados offline", datos dinamicos solo para negocios cacheados |
| Escribir rating/comment offline | write | Ya soportado via `withOfflineSupport` + offlineQueue | Toast "Guardado offline" (existente) |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline via `persistentLocalCache` en prod
- [x] Writes: tienen queue offline via `withOfflineSupport` + IndexedDB
- [ ] Capa de cache explicita: read-through con IndexedDB para garantizar disponibilidad (este PRD)
- [ ] UI: banner de datos stale en BusinessSheet cuando se sirven del cache
- [ ] Datos criticos: ultimos 20 negocios visitados disponibles en cache para primera carga

### Esfuerzo offline adicional: M

---

## Modularizacion

La solucion debe mantener la separacion estricta entre la capa de persistencia (IndexedDB), la capa de cache (hooks) y la UI.

### Arquitectura propuesta

- `src/services/readCache.ts` -- operaciones puras de IndexedDB (open, get, set, evict, clear). Sin dependencias de React.
- `src/hooks/useBusinessDataCache.ts` -- extender para integrar `readCache.ts` como fallback. Exponer `stale: boolean` en la interfaz.
- `src/components/business/StaleBanner.tsx` -- componente presentacional que recibe `stale: boolean` como prop.
- `src/constants/cache.ts` -- agregar constantes: `READ_CACHE_DB_NAME`, `READ_CACHE_TTL_MS`, `READ_CACHE_MAX_ENTRIES`.

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout)
- [ ] `readCache.ts` es un servicio puro reutilizable fuera del contexto de business data
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] `StaleBanner` recibe `stale` como prop explicita, sin acceder a contextos internos
- [ ] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado -- nunca noop `() => {}`

---

## Success Criteria

1. Un usuario que visito 5 negocios puede volver a ver sus datos completos (ratings, comments, tags, price levels) despues de perder conexion
2. La busqueda offline muestra resultados de negocios visitados con datos dinamicos cacheados
3. Los datos servidos desde cache muestran un indicador visual claro de que pueden estar desactualizados
4. El cache se limpia correctamente al eliminar cuenta o hacer logout
5. El rendimiento de apertura de negocios visitados mejora (cache hit evita 7 queries a Firestore)
6. La cobertura de tests del codigo nuevo es >= 80%
