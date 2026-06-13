# PRD: Tech debt — perf-instrumentation de count queries en follows/favorites

**Feature:** 347-perf-instrumentation-count-queries
**Categoria:** infra
**Fecha:** 2026-06-09
**Issue:** #347
**Prioridad:** Media

---

## Contexto

El sistema de observabilidad client-side (#303, #325) mide la latencia de las queries Firestore via `measureAsync` / `measuredGetDoc` / `measuredGetDocs` (`src/utils/perfMetrics.ts`) y la expone en el panel admin de Performance (`QueryLatencyTable`). Tres llamadas a `getCountOfflineSafe(...)` en los services `follows.ts` y `favorites.ts` quedaron sin envolver, dejando ciegos al dashboard dos hot paths sociales (cada follow y cada vista de perfil).

## Problema

- `src/services/follows.ts:41` (`followUser`, following-limit count, corre en CADA follow), `src/services/follows.ts:98` (`fetchFollowersCount`, corre en CADA vista de perfil) y `src/services/favorites.ts:52` (`fetchUserFavoritesCount`) llaman a `getCountOfflineSafe` sin `measureAsync`. Sus hermanos en `ratings.ts:141`, `notifications.ts:62` y `recommendations.ts:84,109` SI estan envueltos — la inconsistencia significa latencia invisible al panel admin para estos counts.
- El guard de regresion `303-perf-instrumentation` ya tiene la regla `R7-getCount-without-measure` codificada en `scripts/guards/checks.mjs:266-272` (referencia explicita a #347), pero hoy esta **fallando**: los 3 call sites son detectados. El guard no puede pasar hasta que se envuelvan.
- El seed `scripts/seed-admin-data.mjs` y el registro `QUERY_LABELS` (`perfHelpers.ts`) no contienen las dos claves nuevas que se introduciran (`follows_followingCount`, `favorites_count`). Sin esa paridad, el dashboard renderiza filas sin label en espanol y el seed sub-reporta tras `npm run seed-admin` (Regla 7 del guard #303).

> **Nota sobre el cuerpo del issue:** la afirmacion de que el seed "omite `unreadCount` y `businessData_*`/`rankings_*`/`recommendations_*`" esta **desactualizada**. El doc grande de `perfMetrics` (`seed-admin-data.mjs:902-953`) ya incluye esas claves. El unico gap real de seed es para las DOS claves nuevas que crea este feature. El gap genuino de "seed completeness" es el bloque chico de 7 dias (`seed-admin-data.mjs:844-848`) que solo tiene 3 claves (`notifications`, `userSettings`, `paginatedQuery`) — pero ese bloque es deliberadamente minimal (vitals por dia) y NO alimenta `QueryLatencyTable`, que lee del doc agregado. No requiere cambios.

## Solucion

### S1 — Envolver los 3 call sites en `measureAsync`

Aplicar el patron canonico ya usado en `ratings.ts:141` y `recommendations.ts:84,109`: `measureAsync('<feature>_<verb>', () => getCountOfflineSafe(...))`. Claves en snake_case segun la convencion documentada en `patterns.md` ("Naming convention de claves"):

| Call site | Funcion | Clave nueva |
|-----------|---------|-------------|
| `follows.ts:41` | `followUser` (limite de seguidos) | `follows_followingCount` |
| `follows.ts:98` | `fetchFollowersCount` | `follows_followersCount` (YA existe en QUERY_LABELS/seed) |
| `favorites.ts:52` | `fetchUserFavoritesCount` | `favorites_count` |

`follows_followersCount` ya esta registrado en `QUERY_LABELS:72` y en el seed `:917` (lo emitia otra ruta) — solo hay que emitirlo tambien desde `fetchFollowersCount`. Las dos claves genuinamente nuevas son `follows_followingCount` y `favorites_count`.

`measureAsync` es `async` y devuelve `Promise<T>` — el wrap preserva el tipo de retorno `Promise<number>` de las tres funciones sin cambios de firma. No hay efectos sobre la semantica offline: `getCountOfflineSafe` sigue devolviendo `0` cuando `!navigator.onLine`.

### S2 — Registrar las claves nuevas (paridad seed + labels)

Para cada clave nueva (`follows_followingCount`, `favorites_count`):

- Agregar entrada en `QUERY_LABELS` (`src/components/admin/perf/perfHelpers.ts`) con label en espanol (ej: "Seguidos: count", "Favoritos: count").
- Agregar entrada en el doc agregado de `perfMetrics.queries` del seed (`scripts/seed-admin-data.mjs:902-953`) con valores p50/p95/count plausibles, para que la fila renderice tras `npm run seed-admin` (Regla 7 del guard #303).

### S3 — Cerrar el guard #303 R7

El guard `R7-getCount-without-measure` ya existe en `scripts/guards/checks.mjs`. Tras S1, su grep debe devolver vacio (los 3 sites pasan a tener `measureAsync` inline). No se requiere extender el guard — la "extension" pedida por el issue ya esta codificada (R7 para `getCountOfflineSafe`, R3 para `getCountFromServer`). El trabajo es **hacerlo pasar**, no agregar reglas. Verificar que la corrida del guard (`node scripts/guards/checks.mjs` o el runner equivalente) reporte R7 limpio.

> Los call sites de `rankings.ts:118,193` corren dentro de un `measureAsync('rankings_userLiveScore')` de mayor nivel y llevan el marker `// guard:exempt` — no se tocan.

### UX

Cambio invisible al usuario final. El efecto observable es en el panel admin `/admin` → tab Performance → `QueryLatencyTable`: aparecen dos filas nuevas (`Seguidos: count`, `Favoritos: count`) con su latencia p50/p95 real en produccion, y la fila `Seguidores: count` empieza a recibir muestras desde el nuevo origen.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — Wrap `follows.ts:41` en `measureAsync('follows_followingCount', ...)` | Alta | S |
| S1 — Wrap `follows.ts:98` en `measureAsync('follows_followersCount', ...)` | Alta | S |
| S1 — Wrap `favorites.ts:52` en `measureAsync('favorites_count', ...)` | Alta | S |
| S2 — Agregar `follows_followingCount` + `favorites_count` a `QUERY_LABELS` | Media | S |
| S2 — Agregar las 2 claves nuevas al seed `perfMetrics.queries` | Media | S |
| S3 — Verificar guard #303 R7 pasa en verde | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Modificar el bloque chico de 7 dias del seed (`:844-848`) — es minimal por diseño y no alimenta `QueryLatencyTable`.
- Re-instrumentar otros services o agregar nuevos counts no listados.
- Cambiar la firma o el comportamiento offline de `getCountOfflineSafe`.
- Agregar nuevas reglas al guard #303 (ya existen R7 y R3); solo se hace que la corrida quede en verde.
- Optimizar el costo Firestore de los counts (cache, agregados server-side) — es un followup de performance, no de instrumentacion.

---

## Tests

Cambio de instrumentacion de bajo riesgo. La cobertura existente de los services debe seguir pasando; se agregan asserts puntuales de que `measureAsync` se invoca con la clave correcta.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/follows.test.ts` | Service | `followUser` y `fetchFollowersCount` invocan `measureAsync` con `follows_followingCount` / `follows_followersCount`; retorno numerico preservado; limite de 200 sigue lanzando |
| `src/services/favorites.test.ts` | Service | `fetchUserFavoritesCount` invoca `measureAsync` con `favorites_count`; retorno numerico preservado |
| `src/components/admin/perf/perfHelpers.test.ts` (si existe; si no, cubierto via QUERY_LABELS smoke) | Util | Las 2 claves nuevas tienen label no vacio en `QUERY_LABELS` |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (el wrap es trivial; el foco es no romper la cobertura existente de `favorites.test.ts` —7 casos, 100%— ni `follows.test.ts`).
- Mock strategy: mockear `measureAsync` (o `perfMetrics`) para verificar que se llama con la clave esperada y que delega en `getCountOfflineSafe`. Mock de `getCountOfflineSafe` para controlar el valor de retorno.
- Verificar que el path offline (`getCountOfflineSafe` devuelve 0) sigue funcionando a traves del wrap.
- Side effects verificados: `measureAsync` registrado, sin cambios en `invalidateQueryCache` / `trackEvent` de `followUser`.

---

## Seguridad

Cambio puramente de observabilidad client-side. No agrega colecciones, campos, endpoints ni inputs de usuario. No toca Firestore rules ni Cloud Functions.

- [ ] No se agregan campos a ninguna coleccion → sin cambios en `firestore.rules`.
- [ ] No hay texto libre nuevo → sin moderacion.
- [ ] `getCountOfflineSafe` ya requiere `request.auth != null` via rules de `follows`/`favorites` (read: auth) — el wrap no altera el control de acceso.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| (ninguna nueva) | El feature no expone superficie nueva; solo envuelve reads ya existentes | N/A — los counts ya estaban en produccion sin instrumentar |

No escribe a Firestore. No agrega campos a `userSettings`. No lee datos nuevos (los counts ya se ejecutaban). No habilita scraping adicional.

---

## Deuda tecnica y seguridad

Este feature **resuelve** deuda tecnica de instrumentacion explicitamente trackeada por el guard #303 (R7 referencia #347 por numero). No introduce deuda nueva.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #303 (guard perf-instrumentation) | mitiga | Cerrar R7 en verde; mantener paridad seed (Regla 7) |
| #325 (perf instrumentation hot paths / `measureAsync`) | mitiga | Extiende el mismo patron a los counts olvidados |

### Mitigacion incorporada

- Cerrar `R7-getCount-without-measure` del guard #303 (3 call sites) → pasos S1.
- Mantener paridad seed/labels para las claves nuevas (Regla 7 del guard #303) → pasos S2.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] N/A — no se agregan hooks ni `useEffect`. Solo se envuelven funciones de service ya existentes.
- [ ] Funciones exportadas: `fetchFollowersCount`, `fetchUserFavoritesCount`, `followUser` ya son parte de la API publica del service — sin cambios de export.
- [ ] Archivos en `src/services/` (no `hooks/`) — correcto, no usan React hooks.
- [ ] Sin nuevas constantes de localStorage.
- [ ] Archivos no superan 300/400 lineas (`follows.ts` ~104, `favorites.ts` ~70, `perfHelpers.ts` ~125).
- [ ] Sin `logger.error` envuelto en `if (DEV)`.

### Checklist de observabilidad

- [ ] N/A — no se agregan Cloud Function triggers ni services nuevos con queries (se instrumentan reads existentes).
- [ ] Las 2 claves nuevas se registran en `QUERY_LABELS` (`perfHelpers.ts`) y en el seed `perfMetrics.queries` — paridad Regla 7 del guard #303.
- [ ] N/A — no son `trackEvent` (GA4); son claves de `measureAsync` (perf metrics, sistema distinto). No requieren `GA4_EVENT_NAMES` ni `ga4FeatureDefinitions.ts`.

### Checklist offline

- [ ] N/A — son reads. `getCountOfflineSafe` ya devuelve 0 offline; el wrap lo preserva.
- [ ] N/A — sin formularios/dialogs nuevos.

### Checklist de documentacion

- [ ] N/A — sin nuevas secciones de HomeScreen.
- [ ] N/A — no son analytics events GA4.
- [ ] N/A — sin tipos nuevos.
- [ ] `docs/reference/features.md` — sin cambio (no es feature de usuario).
- [ ] `docs/reference/firestore.md` — sin cambio (sin colecciones/campos nuevos).
- [ ] `docs/reference/patterns.md` — sin cambio (el patron `measureAsync` ya esta documentado en "Performance instrumentation").
- [ ] `docs/reference/guards/303-perf-instrumentation.md` — opcional: nota de que R7 quedo en verde (no obligatorio).

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| `followUser` following-count check | read (count) | `getCountOfflineSafe` devuelve 0 offline → no bloquea el follow | Sin UI; offline el follow se encola via interceptor del service de escritura |
| `fetchFollowersCount` | read (count) | `getCountOfflineSafe` devuelve 0 offline | El perfil muestra 0 seguidores cuando offline (comportamiento preexistente) |
| `fetchUserFavoritesCount` | read (count) | `getCountOfflineSafe` devuelve 0 offline | Contador 0 offline (comportamiento preexistente) |

### Checklist offline

- [ ] Reads de Firestore: usan `getCountOfflineSafe` (guard offline ya implementado). El wrap `measureAsync` no lo altera.
- [ ] Writes: N/A (no se cambian writes).
- [ ] APIs externas: N/A.
- [ ] UI: sin cambios (comportamiento offline preexistente).
- [ ] Datos criticos: counts no son criticos para primera carga.

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

Cambio confinado a 3 services + 1 helper de labels + 1 script de seed. No toca componentes de layout, no agrega estado global, no cruza la boundary del service layer.

### Checklist modularizacion

- [ ] Logica en services (`follows.ts`, `favorites.ts`) — correcto.
- [ ] N/A — no se agregan componentes.
- [ ] No se agregan `useState` a AppShell/SideMenu.
- [ ] N/A — sin props nuevas.
- [ ] N/A — sin handlers de accion nuevos.
- [ ] Firebase SDK: `getCountOfflineSafe` ya aisla `getCountFromServer`; los services pueden importar de Firebase SDK (capa permitida).
- [ ] Archivos en `src/services/` contienen logica de service — correcto.
- [ ] Ningun archivo supera 400 lineas.
- [ ] N/A — sin converters nuevos.
- [ ] Archivos en carpeta de dominio correcta (`services/`, `components/admin/perf/`).
- [ ] N/A — sin estado global nuevo.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No toca componentes; solo services y un registro de labels |
| Estado global | = | Sin estado nuevo |
| Firebase coupling | = | `getCountFromServer` ya aislado en `getCountOfflineSafe`; el wrap es un decorador de medicion |
| Organizacion por dominio | = | Archivos en sus dominios correctos |

---

## Accesibilidad y UI mobile

No hay UI nueva. La unica superficie visual afectada es `QueryLatencyTable` en el panel admin, que ya renderiza filas via `QUERY_LABELS[name] ?? name`.

### Checklist de accesibilidad

- [ ] N/A — sin componentes interactivos nuevos.
- [ ] N/A — sin IconButtons, Box clickeables, formularios nuevos.
- [ ] `QueryLatencyTable` ya maneja el fallback `?? name` si falta el label (no quedaria sin texto), pero igual se agregan ambos labels.

### Checklist de copy

- [ ] Labels nuevos en `QUERY_LABELS` en espanol con tildes correctas (ej: "Seguidos: count", "Favoritos: count") — consistentes con el estilo existente del registro (`'Seguidores: count'`, `'Ratings: count por usuario'`).
- [ ] Terminologia consistente con el resto de `QUERY_LABELS`.
- [ ] N/A — sin mensajes de error nuevos.

---

## Success Criteria

1. Los 3 call sites (`follows.ts:41`, `follows.ts:98`, `favorites.ts:52`) ejecutan `getCountOfflineSafe` dentro de `measureAsync` con claves snake_case (`follows_followingCount`, `follows_followersCount`, `favorites_count`).
2. La corrida del guard #303 reporta `R7-getCount-without-measure` en verde (grep vacio).
3. `QUERY_LABELS` contiene `follows_followingCount` y `favorites_count` con label en espanol no vacio; `QueryLatencyTable` renderiza esas filas tras `npm run seed-admin`.
4. El doc agregado de `perfMetrics.queries` del seed incluye las 2 claves nuevas (paridad Regla 7 del guard #303).
5. La suite de tests existente de `follows.test.ts` y `favorites.test.ts` sigue pasando, con asserts nuevos de que `measureAsync` se invoca con la clave correcta; cobertura del codigo nuevo >= 80%.


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** perfHelpers.test.ts no existe: elegir crear el archivo o smoke via QUERY_LABELS. Fijar el comando canonico del guard. follows_followingCount solo se emite desde followUser (no en vistas de perfil).
