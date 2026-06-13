# Specs: Tech debt — perf-instrumentation de count queries en follows/favorites

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-06-10
**Issue:** #347

---

## Resumen tecnico

Feature de observabilidad client-side pura. Envuelve 3 call sites de `getCountOfflineSafe(...)` en `measureAsync(...)` para que su latencia llegue al panel admin (`QueryLatencyTable`), registra las 2 claves nuevas en `QUERY_LABELS` + seed para paridad de dashboard, y hace pasar en verde el guard `R7-getCount-without-measure` (#303) que hoy falla por estos 3 sites.

**No** agrega colecciones, campos, endpoints, rules, Cloud Functions, hooks, componentes ni estado global. **No** cambia firmas ni semantica offline.

### Scope real (cerrado, segun observaciones de Sofia)

| Call site | Funcion | Clave | Estado de la clave |
|-----------|---------|-------|--------------------|
| `src/services/follows.ts:41` | `followUser` (limite de seguidos) | `follows_followingCount` | **NUEVA** — registrar en QUERY_LABELS + seed |
| `src/services/follows.ts:98` | `fetchFollowersCount` | `follows_followersCount` | YA existe en `perfHelpers.ts:72` y seed `:917` — solo emitir desde este site |
| `src/services/favorites.ts:52` | `fetchUserFavoritesCount` | `favorites_count` | **NUEVA** — registrar en QUERY_LABELS + seed |

> **Nota sobre `follows_followingCount` (observacion Sofia):** esta clave se emite **unicamente** desde `followUser` (path de escritura: el check de limite previo al `setDoc`). En produccion recibe muestras **solo cuando un usuario crea un follow**, no en vistas de perfil. Esto es **esperado y correcto** — no es un bug de cobertura del dashboard. La fila `Seguidos: count` tendra `count` bajo comparado con `follows_followersCount` (que corre en cada vista de perfil). Documentar este comportamiento para que QA no lo interprete como instrumentacion rota.

---

## Modelo de datos

Sin cambios. No se agregan ni modifican colecciones, documentos ni indexes. Las queries instrumentadas (`where('followerId','==',...)`, `where('followedId','==',...)`, `where('userId','==',...)`) ya existen y corren en produccion.

## Firestore Rules

Sin cambios. El wrap `measureAsync` es un decorador de medicion client-side; no altera el control de acceso. `getCountOfflineSafe` ya opera bajo las rules de read (`auth != null`) de `follows` y `favorites`.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio? |
|---------------------|------------|--------------|---------------------|---------|
| `followUser` count (`follows.ts:41`) | follows | Usuario autenticado leyendo sus propios follows | `allow read: if request.auth != null` (preexistente) | No |
| `fetchFollowersCount` (`follows.ts:98`) | follows | Usuario autenticado | `allow read: if request.auth != null` (preexistente) | No |
| `fetchUserFavoritesCount` (`favorites.ts:52`) | favorites | Usuario autenticado | `allow read: if request.auth != null` (preexistente) | No |

Ninguna query es nueva — ya se ejecutaban sin instrumentar. El wrap no introduce lecturas adicionales ni cambia el documento/coleccion leido.

### Field whitelist check

N/A — no se agregan ni modifican campos en ninguna interfaz/servicio. Sin escrituras Firestore nuevas.

## Cloud Functions

N/A — sin triggers, scheduled ni callables nuevos o modificados.

## Seed Data

El feature **no crea colecciones Firestore nuevas** ni agrega campos requeridos. El unico cambio de seed es de **paridad de dashboard** (Regla 7 del guard #303): el doc agregado de `perfMetrics.queries` debe incluir las 2 claves nuevas para que `QueryLatencyTable` renderice esas filas tras el seed.

### Emulator seed (`scripts/seed-admin-data.mjs`)

- Documento: el doc agregado de `perfMetrics` (bloque `performance.queries`, lineas `:902-953`).
- Cambio: agregar 2 entradas al objeto `queries` con valores p50/p95/count plausibles, consistentes con el estilo de sus hermanos (`ratings_countByUser`, `follows_followersCount`).
- Ejemplo:

```js
follows_followingCount: { p50: 70, p95: 180, count: 35 },
favorites_count: { p50: 65, p95: 160, count: 90 },
```

- `follows_followersCount` y los demas ya estan presentes (`:917` etc.) — no se tocan.

### Staging seed (`scripts/seed-staging.ts`)

N/A — no existe un seed de perf-metrics dedicado para staging. El doc agregado de `perfMetrics` se seedea via `scripts/seed-admin-data.mjs --target staging` (mismo archivo, flag de target). No hay un `seed-staging.ts` separado que toque `perfMetrics.queries`. El staging recibe las claves nuevas por la misma edicion del `.mjs`.

> El bloque chico de 7 dias del seed (`:844-848`) NO se toca — es vitals-por-dia minimal por diseno y no alimenta `QueryLatencyTable` (que lee del doc agregado). Confirmado en PRD Out of Scope.

## Componentes

Sin componentes nuevos ni modificados. La unica superficie visual afectada es `src/components/admin/perf/QueryLatencyTable` (existente), que renderiza filas via `QUERY_LABELS[name] ?? name` — recibe 2 filas nuevas automaticamente al registrar los labels. No requiere edicion de codigo del componente.

### Mutable prop audit

N/A — sin componentes editables nuevos.

## Textos de usuario

Sin textos visibles al usuario final. Los unicos strings nuevos son labels del panel admin en `QUERY_LABELS`:

| Texto | Donde se usa | Notas |
|-------|--------------|-------|
| `Seguidos: count` | label de `follows_followingCount` en `QueryLatencyTable` (admin) | Consistente con `Seguidores: count` (`:72`) |
| `Favoritos: count` | label de `favorites_count` en `QueryLatencyTable` (admin) | Consistente con estilo `<Sustantivo>: count` |

## Hooks

Sin hooks nuevos ni modificados.

## Servicios

| Funcion | Archivo | Cambio | Firma |
|---------|---------|--------|-------|
| `followUser` | `src/services/follows.ts:36-55` | Envolver el count del limite (linea 41) en `measureAsync('follows_followingCount', () => getCountOfflineSafe(...))`. Agregar import de `measureAsync` desde `../utils/perfMetrics`. | Sin cambios — sigue `Promise<void>` |
| `fetchFollowersCount` | `src/services/follows.ts:97-101` | Envolver el `return getCountOfflineSafe(...)` en `measureAsync('follows_followersCount', () => getCountOfflineSafe(...))`. | Sin cambios — sigue `Promise<number>` |
| `fetchUserFavoritesCount` | `src/services/favorites.ts:51-55` | Envolver el `return getCountOfflineSafe(...)` en `measureAsync('favorites_count', () => getCountOfflineSafe(...))`. Agregar import de `measureAsync` desde `../utils/perfMetrics`. | Sin cambios — sigue `Promise<number>` |

Patron canonico (ya usado en `ratings.ts:141`):

```ts
return measureAsync('favorites_count', () => getCountOfflineSafe(
  query(collection(db, COLLECTIONS.FAVORITES), where('userId', '==', userId)),
));
```

`measureAsync<T>(name, fn): Promise<T>` (`src/utils/perfMetrics.ts:37`) preserva el tipo de retorno. El path offline se preserva: `getCountOfflineSafe` sigue devolviendo `0` cuando `!navigator.onLine`.

## Integracion

El feature toca 3 services + 1 registro de labels + 1 seed. No cruza la boundary del service layer. `QueryLatencyTable` consume `QUERY_LABELS` sin cambios.

### Preventive checklist

- [x] **Service layer**: los services ya importan Firebase SDK (capa permitida). No se agregan imports de `firebase/firestore` en componentes.
- [x] **Duplicated constants**: las claves nuevas se agregan al registro existente `QUERY_LABELS` — no se duplica.
- [x] **Context-first data**: N/A — no se lee data de contextos.
- [x] **Silent .catch**: N/A — `measureAsync` no introduce `.catch` silencioso; propaga el rechazo de la promise como antes.
- [x] **Stale props**: N/A — sin props.

## Tests

| Archivo test | Que testear | Tipo |
|--------------|-------------|------|
| `src/services/follows.test.ts` (existe) | `followUser` invoca `measureAsync` con `follows_followingCount`; `fetchFollowersCount` (agregar a imports — hoy no se testea) invoca `measureAsync` con `follows_followersCount` y retorna el numero de `getCountOfflineSafe`; el limite de 200 sigue lanzando. | Service |
| `src/services/favorites.test.ts` (existe) | `fetchUserFavoritesCount` (agregar a imports y mock de `getCountOfflineSafe` — hoy no presente) invoca `measureAsync` con `favorites_count`; retorno numerico preservado; mantiene los casos existentes de add/remove. | Service |
| `src/components/admin/perf/perfHelpers.test.ts` | **DECISION (observacion Sofia):** ver "Decisiones tecnicas → Cobertura de QUERY_LABELS" mas abajo. | Util |

### Decision explicita sobre perfHelpers.test.ts

`perfHelpers.test.ts` **no existe** hoy. Se elige **NO crearlo**. La verificacion de que las 2 claves nuevas tienen label no vacio se cubre con un **smoke assert dentro de los tests de service ya existentes** (importando `QUERY_LABELS` de `perfHelpers.ts` y asegurando `QUERY_LABELS['follows_followingCount']` y `QUERY_LABELS['favorites_count']` son strings no vacios). Rationale en "Decisiones tecnicas". Esto evita crear un archivo de test nuevo para un registro de constantes (excepcion documentada en `tests.md`: "Constantes sin logica") manteniendo el assert de paridad.

### Mock strategy

- `follows.test.ts` ya mockea `getCountOfflineSafe` (linea 11-14) — reutilizar. **Mockear `measureAsync`** (`vi.mock('../utils/perfMetrics', () => ({ measureAsync: (name, fn) => fn() }))`) para: (a) que el wrap delegue en `getCountOfflineSafe` y preserve el retorno, (b) capturar el `name` con un spy y assertar la clave. Alternativa equivalente: spy que registre `name` y ejecute `fn()`.
- `favorites.test.ts` hoy **no** mockea `getCountOfflineSafe` ni `measureAsync` (solo testea add/remove). Agregar ambos mocks siguiendo el patron de `follows.test.ts`, e importar `fetchUserFavoritesCount`.
- El path offline (retorno `0`) se cubre haciendo que el mock de `getCountOfflineSafe` resuelva `0` y verificando que el wrap propaga `0`.
- Sin cambios en asserts de `invalidateQueryCache` / `trackEvent` de `followUser` (verificar que siguen pasando — no debe haber regresion de side effects).

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo (el wrap es trivial). No bajar la cobertura existente de `favorites.test.ts` ni `follows.test.ts`.
- Asserts nuevos: `measureAsync` invocado con la clave correcta en los 3 sites; smoke de los 2 labels.

## Analytics

Sin cambios GA4. Las claves de `measureAsync` son perf-metrics (sistema distinto a `trackEvent`/GA4). No requieren `GA4_EVENT_NAMES` ni `ga4FeatureDefinitions.ts`. `followUser` mantiene su `trackEvent(EVT_FOLLOW, ...)` sin cambios.

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| count de following/followers/favorites | `getCountOfflineSafe` devuelve `0` cuando offline (preexistente); el wrap `measureAsync` no lo altera | N/A | Firestore SDK |

### Writes offline

N/A — los 3 call sites son reads. No se cambian writes. `followUser`'s `setDoc` y el `gateServiceWrite` de favorites permanecen intactos.

### Fallback UI

Sin cambios. Comportamiento offline preexistente: contadores muestran `0` offline.

---

## Accesibilidad y UI mobile

Sin componentes interactivos nuevos. `QueryLatencyTable` (admin) ya maneja el fallback `?? name` si faltara un label; igual se agregan ambos labels.

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|------------------|-------------|
| (ninguno nuevo) | N/A | N/A | N/A | N/A |

## Textos y copy

| Texto | Donde | Regla aplicada |
|-------|-------|----------------|
| `Seguidos: count` | label admin `follows_followingCount` | terminologia consistente con `Seguidores: count` |
| `Favoritos: count` | label admin `favorites_count` | terminologia consistente con estilo `<Sustantivo>: count` |

Sin voseo aplicable (no son CTAs de usuario). Sin tildes pendientes en estos strings.

---

## Decisiones tecnicas

### 1. No crear `perfHelpers.test.ts`; cubrir las 2 claves via smoke en tests de service (observacion Sofia)

**Decision:** NO se crea `src/components/admin/perf/perfHelpers.test.ts`. La paridad de labels se asegura con un assert smoke (`QUERY_LABELS['follows_followingCount']` y `['favorites_count']` son strings no vacios) **dentro de** `follows.test.ts` y `favorites.test.ts` respectivamente.

**Rationale:** `QUERY_LABELS` es un registro de constantes sin logica condicional — `tests.md` lo lista como excepcion que no requiere test unitario dedicado. Crear un archivo de test entero para un objeto de constantes agrega superficie de mantenimiento sin valor proporcional. El assert smoke en los tests que ya tocan el feature da la senal de paridad (label presente para la clave que el service emite) sin archivo nuevo. **Alternativa rechazada:** crear `perfHelpers.test.ts` — descartada por sobre-ingenieria para constantes.

### 2. Comando canonico del guard (observacion Sofia)

El gate que corre en CI es **`npm run guards:check`** (= `node scripts/guards/check-baseline.mjs`), invocado en `.github/workflows/guards.yml:43`. Es el unico comando cuyo exit code bloquea (compara contra `.guards-baseline.json`). El reporte legible es `npm run guards` (= `node scripts/guards/run.mjs --pretty`, `guards.yml:50`).

**Criterio de done reproducible:** correr `npm run guards` y verificar que la regla `R7-getCount-without-measure` del guard `303` reporta **0 hits**; y que `npm run guards:check` pasa (no sube el baseline). El grep subyacente de R7 (`checks.mjs:271`) debe devolver vacio tras envolver los 3 sites.

### 3. Wrap inline vs. helper dedicado

Se usa `measureAsync(...)` inline en cada site (patron de `ratings.ts:141`, `recommendations.ts:84,109`) en vez de un helper `measuredGetCount`. **Rationale:** consistencia con el codebase existente y con la deteccion del guard R7 (que busca `measureAsync` en la misma cadena que `getCountOfflineSafe`). Un helper nuevo requeriria agregar una exencion al guard — fuera de scope.

### 4. Seed: `.mjs` y no `.ts`

El doc agregado de `perfMetrics.queries` vive en `scripts/seed-admin-data.mjs:902-953`. El `scripts/seed-admin-data.ts` (usado por `npm run seed`) **no** contiene bloque de perf-metrics. El seed que alimenta `QueryLatencyTable` es el `.mjs` (`node scripts/seed-admin-data.mjs`, tambien `--target staging`). Por eso la edicion de seed va exclusivamente al `.mjs`, alineado con PRD y `patterns.md:153`.

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna. No se agregan superficies escribibles ni legibles nuevas. Los 3 reads ya corrian en produccion bajo las rules existentes de `follows`/`favorites` (`read: if request.auth != null`).

### Rate limiting

N/A — no hay colecciones escribibles nuevas.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| (ninguno nuevo) | El feature solo envuelve reads preexistentes en un decorador de medicion; no expone superficie nueva | N/A |

---

## Deuda tecnica: mitigacion incorporada

Issues consultados: el feature ataca directamente deuda trackeada por el guard #303 (R7 referencia #347 por numero) y extiende el patron de #325.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #303 (guard perf-instrumentation, R7) | Los 3 call sites pasan a tener `measureAsync` inline → grep de R7 queda vacio. Paridad seed/labels (Regla 7). | Fase 1 (S1) + Fase 2 (S2) |
| #325 (perf instrumentation hot paths) | Extiende el mismo patron `measureAsync` a los counts olvidados. | Fase 1 (S1) |

No se introduce deuda nueva. No se agrava deuda existente: los archivos tocados quedan bajo 400 lineas (`follows.ts` ~106, `favorites.ts` ~71, `perfHelpers.ts` ~127).

---

## Validacion Tecnica

(pendiente — Diego)

## Revisión Técnica (Gate Diego)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:**

1. **Guard R7 hace matching línea-por-línea.** El check `R7-getCount-without-measure` corre `grep -rn "getCountOfflineSafe(" ... | grep -v measureAsync` (`scripts/guards/checks.mjs:271`), filtrando por línea física. El plan debe asegurar que en los 3 sites `measureAsync` y `getCountOfflineSafe` queden en la MISMA línea (patrón canónico `ratings.ts:141`). Atención especial a `followUser:41`, que es una asignación (`const followingCount = await getCountOfflineSafe(...)`): el specs muestra el ejemplo inline solo para `favorites_count`. Si el wrap parte `measureAsync` y `getCountOfflineSafe` en líneas distintas, el guard sigue reportando el hit pese a estar instrumentado. Criterio de done: `npm run guards` → R7 con 0 hits.

2. **Naming de claves (camelCase en sufijo) es intencional, NO corregir.** `patterns.md:153` documenta `<feature>_<verb>` snake_case, pero `follows_followingCount` / `follows_followersCount` / `favorites_count` usan sufijo camelCase. Esto replica el precedente ya en producción (`follows_followersCount` en `perfHelpers.ts:72` y seed `:917`, `ratings_countByUser`). El plan no debe normalizar a snake puro: rompería la paridad con la fila `follows_followersCount` existente que ya recibe muestras.

3. **`favorites.test.ts` parte sin infra de mock.** No mockea `getCountOfflineSafe` ni `measureAsync` ni importa `fetchUserFavoritesCount` (verificado). El plan debe contemplar setup de mocks completo (siguiendo el patrón de `follows.test.ts:12-14`), no solo "agregar un assert". `follows.test.ts` ya mockea `getCountOfflineSafe` pero NO `measureAsync` ni testea `fetchFollowersCount` — ambos requieren agregarse.

4. **Verificado contra el código:** los 3 call sites sin `measureAsync` (confirmado), `measureAsync` preserva tipo y semántica offline (devuelve `fn()` directo sin `sessionId`, `perfMetrics.ts:38`), `follows_followingCount`/`favorites_count` ausentes en labels y seed (confirmado), comando canónico `npm run guards:check` (`guards.yml:43`) correcto. Sin cambios de data model, rules, Cloud Functions ni superficie de ataque — coincide con lo declarado. Sin BLOQUEANTES.
