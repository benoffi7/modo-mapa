# PRD: Extraer data-fetching de useBusinessData a service

**Feature:** extract-business-data-service
**Categoria:** infra
**Fecha:** 2026-03-28
**Issue:** #219
**Prioridad:** Media

---

## Contexto

`useBusinessData.ts` (324 lineas) es el hook central que carga los datos del BusinessSheet: ejecuta 7 queries de Firestore en `Promise.all`, maneja 3 tiers de cache (memory, IndexedDB, Firestore), controla loading/error states, y orquesta refetches parciales con proteccion contra race conditions via `patchedRef`. El proyecto ya tiene un service layer establecido (`src/services/`) y el patron documentado en `patterns.md` es `Component -> Hook -> Service -> Firebase`. Sin embargo, este hook rompe ese patron al contener directamente las queries raw de Firestore (imports de `collection`, `query`, `where`, `getDocs`, `getDoc`, `doc`, `documentId`).

## Problema

- **Violacion del patron de capas**: `useBusinessData` importa directamente 7 funciones de `firebase/firestore` y construye queries inline. El patron del proyecto dicta que solo `src/services/`, `src/config/`, `src/context/` y `src/hooks/` pueden importar de `firebase/firestore`, pero la convencion es que los hooks deleguen CRUD a services.
- **Testability reducida**: testear el hook requiere mockear `firebase/firestore` completo. Si la logica de fetching viviera en un service, se podria testear el service aislado (queries) y el hook aislado (orquestacion de cache), simplificando ambos test suites.
- **Responsabilidad dual**: el hook mezcla dos concerns distintos: (1) como obtener datos de Firestore (queries, converters, batched likes) y (2) como orquestar cache tiers, loading states y race conditions. Separar estos concerns mejora la mantenibilidad.

## Solucion

### S1. Crear `services/businessData.ts`

Extraer las funciones `fetchBusinessData()`, `fetchSingleCollection()` y `fetchUserLikes()` (lineas 49-182 del hook actual) a un nuevo modulo de servicio. Estas funciones ya son puras (reciben `bId` y `uid`, retornan datos) y no tienen dependencias de React state, por lo que la extraccion es mecanica.

El servicio exporta:

- `fetchBusinessData(businessId: string, userId: string)` — ejecuta las 7 queries en `Promise.all` + post-processing (filter flagged, sort, fetch likes)
- `fetchSingleCollection(businessId: string, userId: string, collection: CollectionName)` — refetch de una sola coleccion
- `fetchUserLikes(userId: string, commentIds: string[])` — batched likes query (consumida internamente por las dos anteriores, pero exportada para testing)

El tipo `CollectionName` se mueve a `types/` o se exporta desde el servicio.

### S2. Simplificar `useBusinessData` como orquestador puro

El hook queda con una unica responsabilidad: orquestar los 3 tiers de cache, loading/error states, `patchedRef` race condition fix, y el `refetch` callback. Importa `fetchBusinessData` y `fetchSingleCollection` desde el service en vez de construir queries.

Los imports de `firebase/firestore` se eliminan del hook. Solo quedan imports de React, del service, del cache (`useBusinessDataCache`, `readCache`), del auth context, y de tipos.

### S3. Alinear con el patron existente de services

El nuevo servicio sigue las convenciones de `src/services/`:

- Usa `db` de `src/config/firebase`
- Usa `COLLECTIONS` de `src/config/collections`
- Usa converters tipados de `src/config/converters`
- No tiene estado (funciones puras async)
- No importa hooks ni contextos de React

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Crear `src/services/businessData.ts` con las 3 funciones extraidas | Must | S |
| Exportar tipo `CollectionName` desde el servicio | Must | XS |
| Refactorizar `useBusinessData.ts` para importar del servicio | Must | S |
| Tests para `services/businessData.ts` | Must | M |
| Verificar que tests existentes de `useBusinessData` siguen pasando | Must | XS |

**Esfuerzo total estimado:** S (30-45 minutos como indica el issue)

---

## Out of Scope

- Cambiar la logica de cache tiers (memory, IndexedDB, Firestore) — se mueve tal cual
- Modificar la interfaz publica de `useBusinessData` (el return type no cambia)
- Agregar nuevas colecciones o queries al business view
- Refactorizar `useBusinessDataCache.ts` o `readCache.ts`

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/businessData.ts` | Service | `fetchBusinessData`: 7 queries ejecutadas en parallel, post-processing (filter flagged comments, sorting, batched likes). `fetchSingleCollection`: cada uno de los 7 branches del switch. `fetchUserLikes`: batching en grupos de 30, set vacio para 0 comments, extraccion de commentId del doc ID compuesto. |
| `src/hooks/useBusinessData.ts` | Hook (existente) | Verificar que tests existentes (`useBusinessData.test.ts` — no existe actualmente en inventario, pero `useBusinessDataCache.test.ts` si) siguen pasando. Opcionalmente agregar tests de orquestacion de cache con el service mockeado. |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

Este refactor es interno (mover codigo entre archivos) y no cambia ningun flujo de datos, query, ni interaccion con Firestore. No hay impacto en seguridad.

- [x] No se agregan colecciones nuevas
- [x] No se modifican queries ni filtros
- [x] No se agregan inputs de usuario
- [x] No se exponen datos adicionales

---

## Offline

Este refactor no cambia el comportamiento offline. Las 3 tiers de cache (memory, IndexedDB, Firestore persistent cache) permanecen identicas. Solo se mueve donde viven las funciones de fetching.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchBusinessData` | read | Sin cambio: 3-tier cache (memory -> IndexedDB -> Firestore persistent cache) | Sin cambio: StaleBanner + error state |
| `fetchSingleCollection` | read | Sin cambio: Firestore persistent cache | Sin cambio: error silencioso en DEV logger |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline? -- Si, sin cambio
- [x] Writes: tienen queue offline o optimistic UI? -- N/A (solo reads)
- [x] APIs externas: hay manejo de error de red? -- N/A
- [x] UI: hay indicador de estado offline en contextos relevantes? -- Sin cambio (StaleBanner)
- [x] Datos criticos: disponibles en cache para primera carga? -- Sin cambio (IndexedDB read cache)

### Esfuerzo offline adicional: N/A

---

## Modularizacion

Este refactor mejora directamente la modularizacion al separar la capa de acceso a datos (service) de la capa de orquestacion (hook).

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) — el refactor mueve data-fetching al service layer
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout — N/A (no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu — N/A
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout — N/A
- [x] Cada prop de accion tiene un handler real especificado — N/A

---

## Success Criteria

1. `src/services/businessData.ts` existe con `fetchBusinessData`, `fetchSingleCollection` y `fetchUserLikes` exportados
2. `src/hooks/useBusinessData.ts` no importa nada de `firebase/firestore` directamente
3. La interfaz publica de `useBusinessData` (return type) no cambia — zero impacto en consumidores
4. Tests del servicio cubren >= 80% del codigo nuevo
5. `npm run test:run` pasa sin regresiones
