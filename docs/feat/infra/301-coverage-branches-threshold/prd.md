# PRD: Coverage — branches below 80% threshold (CI blocker)

**Feature:** 301-coverage-branches-threshold
**Categoria:** infra
**Fecha:** 2026-04-18
**Issue:** #301
**Prioridad:** Alta (CI blocker)

---

## Contexto

El `/health-check` ejecutado el 2026-04-18 sobre `new-home` detecto que la cobertura de ramas (branches) del frontend bajo al 79.3%, por debajo del umbral de 80% configurado en `vitest.config.ts`. Esto bloquea el workflow de deploy (`.github/workflows/deploy.yml`) que ejecuta `npm run test:coverage` con thresholds enforced. El resto de metricas (functions 86.79%, lines 91.2%, statements 90.58%) estan por encima del umbral, por lo que la causa raiz es puntual: servicios y triggers user-facing que acumularon logica condicional sin tests.

## Problema

- CI/CD rechaza cualquier push porque branch coverage (79.3%) esta por debajo del threshold de 80%. No se pueden desplegar features nuevos hasta resolverlo.
- 5 servicios del frontend (`abuseLogs.ts`, `achievements.ts`, `businessData.ts`, `trending.ts`, `specials.ts`) contienen logica condicional (filtros, `snap.exists()`, batching, cascade-delete semantico) sin cobertura, concentrando las ramas no cubiertas.
- 7 triggers de Cloud Functions (`authBlocking.ts`, `customTags.ts`, `priceLevels.ts`, `recommendations.ts`, `sharedLists.ts`, `userTags.ts`, `users.ts`) y 1 callable admin (`perfMetrics.ts` con transaccion de rate-limit) no tienen tests, lo que deja sin verificar paths criticos de seguridad (rate limits, moderacion, cascade deletes, IP blocking).

## Solucion

### S1. Tests de servicios frontend (cobertura directa)

Agregar archivos `*.test.ts` en `src/services/` para los 5 servicios faltantes. Seguir el patron establecido en `feedback.test.ts` y `adminPhotos.test.ts` (`patterns.md` seccion Testing):

- **`abuseLogs.test.ts`** — mockear `onSnapshot`, validar callback invocado con logs mapeados, branch de `onError`, docChanges serialization.
- **`achievements.test.ts`** — `fetchAchievements` (order by), `saveAllAchievements` con branches: delete de removidos, upsert con `updatedAt` timestamp.
- **`businessData.test.ts`** — `fetchUserLikes` (batching de 30, empty input, doc id parsing), `fetchSingleCollection` (7 branches por tipo de coleccion con filtros: `flagged`, sorting, `status === 'approved'`), `fetchBusinessData` (happy path agregado + favorito no existente).
- **`trending.test.ts`** — `fetchTrending` con `snap.exists()` branches (null vs data).
- **`specials.test.ts`** — `fetchSpecials`, `fetchActiveSpecials` (where active), `saveAllSpecials` con branches de delete + upsert.

### S2. Tests de Cloud Functions triggers (seguridad)

Agregar tests en `functions/src/__tests__/triggers/` siguiendo el patron establecido en `comments.test.ts` (`vi.hoisted` + captura de handlers via mock de `firebase-functions/v2/firestore`):

- **`authBlocking.test.ts`** — `onBeforeUserCreated`: skip si no es anonymous, skip si no hay IP, log-only threshold (`ANON_FLOOD_ALERT_THRESHOLD`), block + `HttpsError('resource-exhausted')` + `logAbuse` high severity cuando excede `MAX_ANON_CREATES_PER_IP_PER_DAY`.
- **`customTags.test.ts`** — `onCustomTagCreated`: exceed per-entity (delete + logAbuse), exceed daily (delete + logAbuse), flagged moderation (delete + logAbuse), happy path. `onCustomTagDeleted`: decremento + trackDelete.
- **`priceLevels.test.ts`** — `onPriceLevelCreated` con/sin userId, rate limit exceeded path, happy path. `onPriceLevelUpdated`: trackWrite.
- **`recommendations.test.ts`** — `onRecommendationCreated`: self-recommend delete, rate limit exceeded, message flagged, message vacio (skip moderation), happy path con notification + counters.
- **`sharedLists.test.ts`** — `onSharedListCreated`: sin ownerId (early return), count <= 10 happy path, count > 10 delete + logAbuse.
- **`userTags.test.ts`** — `onUserTagCreated`: rate limit exceeded, happy path. `onUserTagDeleted`.
- **`users.test.ts`** — `onUserCreated`: sin displayName (solo counters), con displayName (update + lowercase + followerCounts init).
- **`admin/perfMetrics.test.ts`** — `writePerfMetrics`: unauth, invalid sessionId/vitals/appVersion, rate limit exceeded (transaccion), happy path con setDoc.

### S3. Restaurar threshold + estabilidad CI

Validar que tras agregar los tests:

1. `npm run test:coverage` reporta branches >= 80% (tanto en frontend como functions). Meta: 85% de margen para absorber variaciones de futuras features.
2. Cada test archivo tiene ≥ 5 casos (1 happy path + 4 ramas condicionales minimo) para que la adicion sea robusta.
3. No se modifican funciones productivas — solo se agregan archivos `*.test.ts`.
4. `vitest.config.ts` mantiene threshold en 80 (no bajar). Opcionalmente agregar comentario referenciando #301 en la config.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1.1 `abuseLogs.test.ts` | Alta | XS |
| S1.2 `achievements.test.ts` | Alta | S |
| S1.3 `businessData.test.ts` | Alta | M |
| S1.4 `trending.test.ts` | Alta | XS |
| S1.5 `specials.test.ts` | Alta | S |
| S2.1 `authBlocking.test.ts` | Alta | S |
| S2.2 `customTags.test.ts` | Alta | S |
| S2.3 `priceLevels.test.ts` | Alta | S |
| S2.4 `recommendations.test.ts` | Alta | S |
| S2.5 `sharedLists.test.ts` | Alta | S |
| S2.6 `userTags.test.ts` | Alta | XS |
| S2.7 `users.test.ts` (trigger) | Media | XS |
| S2.8 `admin/perfMetrics.test.ts` | Alta | M |
| S3 Validacion coverage + CI | Alta | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactor de servicios/triggers para reducir complejidad ciclomatica — solo agregar tests.
- Bajar threshold del 80% (contraria a la politica de tests).
- Agregar tests para servicios ya cubiertos parcialmente (`userProfile`, `menuPhotos`) — ya tienen tests, no son la causa del blocker.
- Tests de componentes UI visuales — no son la causa del drop de branches.
- Migrar a un provider de coverage diferente (seguimos con `@vitest/coverage-v8`).

---

## Tests

Esta feature **es** sobre tests. La seccion equivalente a "archivos que necesitan tests" es el scope mismo (S1/S2/S3).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/abuseLogs.test.ts` | Service | subscribe onNext/onError branches, docChanges mapping |
| `src/services/achievements.test.ts` | Service | fetch + saveAll (delete removidos, upsert con timestamp) |
| `src/services/businessData.test.ts` | Service | fetchUserLikes batching + 7 branches de fetchSingleCollection |
| `src/services/trending.test.ts` | Service | `snap.exists()` null path |
| `src/services/specials.test.ts` | Service | fetch + fetchActive + saveAll |
| `functions/src/__tests__/triggers/authBlocking.test.ts` | Trigger | anon check, IP check, threshold log-only, block path |
| `functions/src/__tests__/triggers/customTags.test.ts` | Trigger | 2 rate limits + moderation + happy + delete |
| `functions/src/__tests__/triggers/priceLevels.test.ts` | Trigger | rate limit con/sin userId + update |
| `functions/src/__tests__/triggers/recommendations.test.ts` | Trigger | self-rec, rate, moderation, empty message, happy |
| `functions/src/__tests__/triggers/sharedLists.test.ts` | Trigger | sin ownerId, count<=10, count>10 delete |
| `functions/src/__tests__/triggers/userTags.test.ts` | Trigger | rate limit + delete trigger |
| `functions/src/__tests__/triggers/users.test.ts` | Trigger | sin/con displayName |
| `functions/src/__tests__/admin/perfMetrics.test.ts` | Callable | unauth, invalid inputs, rate limit tx, happy |

### Criterios de testing

- Cobertura **branches >= 80%** global (meta: >=85% de margen)
- Cada archivo de test minimo 5 casos (1 happy + 4 condicionales)
- Mocks alineados con patrones existentes (`vi.hoisted`, `firebase/firestore` mock, `firebase-admin/firestore` mock, `vi.mock('firebase-functions/v2/firestore')` capturando handlers)
- Tests de validacion para todos los inputs (sessionId, vitals, appVersion en perfMetrics)
- Todos los paths condicionales de rate limit + moderation cubiertos
- Side effects verificados (`logAbuse`, `createNotification`, `incrementCounter`, `trackWrite`, `snap.ref.delete`)

---

## Seguridad

Esta feature agrega tests sobre codigo existente; no modifica rules, callables, ni superficies publicas. Aun asi, los tests cubren **directamente** paths de seguridad que hoy no estan verificados:

- [x] Rate limiting server-side (comments, customTags, recommendations, userTags, sharedLists, priceLevels, perfMetrics callable) — tests cubren tanto happy path como exceeded path
- [x] IP rate limiting (`authBlocking`) — tests cubren threshold log-only y block
- [x] Moderation (`customTags.label`, `recommendations.message`) — tests cubren flagged path con `snap.ref.delete` + `logAbuse`
- [x] Self-recommend guard en `recommendations` — test cubre delete inmediato
- [x] Cascade semantics en `sharedLists` (count > 10 → delete) — test cubre delete path
- [x] Admin callable validation (`perfMetrics`) — tests cubren unauth, invalid payloads, rate limit exceeded
- [ ] N/A — no se agregan campos a Firestore
- [ ] N/A — no se agregan colecciones
- [ ] N/A — no se agregan inputs de usuario

### Vectores de ataque automatizado

Esta feature no expone superficies nuevas. Los tests agregados **verifican** que las mitigaciones existentes funcionan ante vectores automatizados ya conocidos:

| Superficie existente | Ataque ya mitigado | Test que lo verifica |
|----------------------|---------------------|----------------------|
| `customTags` trigger | Bot creando 1000 tags | `exceeded daily` + `exceeded per-entity` tests |
| `recommendations` trigger | Spam de recomendaciones | `rate limit exceeded` + `flagged message` tests |
| `sharedLists` trigger | Bot creando listas | `count > 10` delete test |
| `userTags` trigger | Bot etiquetando masivamente | `rate limit exceeded` test |
| `authBlocking` | Flooding de cuentas anonimas desde misma IP | `MAX_ANON_CREATES_PER_IP_PER_DAY` block + high severity abuse log test |
| `writePerfMetrics` callable | Spam de perf reports | `rate limit exceeded` transaction test |

---

## Deuda tecnica y seguridad

Issues abiertos consultados (`gh issue list --state open`):

- #168 Vite 8 / ESLint 10 bloqueado por peer deps (no afecta)
- #300 security audit — **afecta**: si #300 agrega rate limits nuevos, sus tests deben incluirse antes de mergear #300; pero #301 es prerequisite de cualquier merge
- #302-#311 tech debt (copy, perf, admin, ux, arch, dark-mode, privacy, offline, instrumentation) — no afectan coverage branches directamente

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #300 security — App Check enforcement + abuse vectors | afecta (si se mergea antes, sus cambios afectan coverage) | Mergear #301 primero para desbloquear CI |
| #303 perf-instrumentation (Firestore reads sin tracking) | no afecta | N/A |
| #306 architecture (prop-drilling + sabanas) | no afecta | N/A |

### Mitigacion incorporada

Unica mitigacion es resolver el blocker CI. No hay deuda adicional que pueda encararse "de paso" porque el scope es puramente agregar archivos `.test.ts` (no se tocan archivos productivos). Si durante la implementacion se detecta codigo muerto en los servicios/triggers, se documenta en un issue separado, no se modifica en este PR.

---

## Robustez del codigo

No se agrega codigo de produccion (solo tests). Checklist aplica a los archivos de test:

### Checklist de hooks async

- [ ] N/A — no se agregan hooks
- [ ] N/A — no se agregan handlers async
- [x] Tests usan `await` con expectativas explicitas, no promises pendientes
- [x] Archivos de test no superan 300 lineas (warn) — si alguno crece mas, dividir por funcion exportada

### Checklist de observabilidad

- [x] Tests verifican que `trackFunctionTiming` se llama en cada trigger (happy path)
- [ ] N/A — no se agregan services con queries nuevas
- [ ] N/A — no se agregan `trackEvent` nuevos

### Checklist offline

- [ ] N/A — no se agregan formularios/dialogs
- [ ] N/A — no se agregan handlers de escritura

### Checklist de documentacion

- [ ] N/A — no se modifica HomeScreen
- [ ] N/A — no se agregan analytics events
- [ ] N/A — no se agregan tipos
- [ ] `docs/reference/tests.md` actualizado con nuevos archivos de test en inventario (⏳ → cobertura final)
- [ ] N/A — firestore.md no cambia
- [ ] N/A — patterns.md no cambia

---

## Offline

No aplica. Feature solo agrega tests unitarios que corren en CI + local; no toca data flows ni UI.

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|--------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [ ] N/A — no se agregan reads/writes
- [ ] N/A — no se agregan APIs externas
- [ ] N/A — no se modifica UI

### Esfuerzo offline adicional: —

---

## Modularizacion y % monolitico

Feature neutral: solo se agregan archivos `*.test.ts` en directorios ya establecidos. No se tocan componentes, hooks ni services productivos.

### Checklist modularizacion

- [x] No se mueve logica de negocio
- [x] No se agregan componentes
- [x] No se agregan useState a AppShell / layout
- [x] Tests colocados junto al archivo testeado (patron del proyecto: `src/services/X.test.ts` y `functions/src/__tests__/triggers/X.test.ts`)
- [x] Tests no importan directamente de `firebase/firestore` productivo — usan mocks
- [x] Archivos nuevos van en la carpeta correcta por dominio
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes |
| Estado global | = | No se agregan contextos |
| Firebase coupling | = | Tests mockean el SDK, no lo importan en runtime |
| Organizacion por dominio | + | Tests colocados por dominio reflejan estructura existente |

---

## Accesibilidad y UI mobile

No aplica — no se modifica UI.

### Checklist de accesibilidad

- [ ] N/A

### Checklist de copy

- [ ] N/A — test descriptions en ingles (convencion vitest del proyecto)

---

## Success Criteria

1. `npm run test:coverage` reporta branches >= 80% localmente y en CI (`.github/workflows/deploy.yml`).
2. `cd functions && npm run test:coverage` reporta branches >= 80% para Cloud Functions.
3. Los 13 archivos de test (5 frontend services + 7 triggers + 1 admin callable) existen y corren verde en CI.
4. Deploy de `new-home` a staging/production no se bloquea por coverage threshold.
5. `docs/reference/tests.md` refleja el nuevo inventario de tests (pasar de "⏳" a "✓" las filas correspondientes).
