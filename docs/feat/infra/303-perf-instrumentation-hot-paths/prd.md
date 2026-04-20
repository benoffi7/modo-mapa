# PRD: Perf instrumentation — untracked Firestore reads en hot paths

**Feature:** 303-perf-instrumentation-hot-paths
**Categoria:** infra
**Fecha:** 2026-04-18
**Issue:** #303
**Prioridad:** Media

---

## Contexto

El proyecto tiene infraestructura madura de observabilidad server-side (17 de 17 Cloud Function triggers con `trackFunctionTiming`, agregacion diaria via `dailyMetrics`, panel admin con p50/p95 por funcion) pero el lado cliente esta sub-instrumentado. De aproximadamente 30 sitios de query Firestore en `src/services/`, solo 4 usan `measureAsync` (`notifications`, `unreadCount`, `userSettings`, `paginatedQuery`). La auditoria `/health-check` del 2026-04-18 detecto que los paths mas calientes del usuario — `businessData.ts` (7 queries por apertura de BusinessSheet) y `userProfile.ts` (6 reads paralelos por apertura de perfil) — son completamente invisibles en el `QueryLatencyTable` del admin PerformancePanel.

## Problema

- **Hottest paths invisibles**: cada apertura de BusinessSheet ejecuta 7 queries (ratings, comments, userTags, customTags, priceLevels, menuPhotos, favorites) + `fetchUserLikes` batcheada, y cada apertura de perfil publico ejecuta 6 reads paralelos. Ninguno se mide, por lo que degradaciones de latencia en el path mas transitado pasan desapercibidas hasta que el usuario reporta.
- **Drift continuo**: no hay guardrail (lint rule, helper wrapper) que fuerce el uso de `measureAsync` en queries nuevas. Cada servicio nuevo agrega nuevos untracked reads silenciosamente — por ejemplo, los servicios recientes `follows.ts`, `recommendations.ts` y `sharedLists.ts` nacieron sin instrumentacion.
- **FunctionTimingTable vacio por seed gap**: `config/perfCounters` no se siembra en `scripts/seed-admin-data.mjs`, por lo que el panel admin muestra la tabla vacia en local/staging hasta que algun trigger corre. Dificulta probar el panel y diagnosticar issues.

## Solucion

### S1. Wrappear hot paths con `measureAsync`

Envolver cada `getDocs` / `getDoc` de los servicios listados en el issue con `measureAsync('<query_name>', () => ...)`. Los nombres de query siguen la convencion existente (`notifications`, `userSettings`, `paginatedQuery`): un identificador corto unico por tipo de operacion. Los agrupamos por prioridad de trafico:

- **P0 (hot paths)**: `businessData.ts` (7 queries + `fetchUserLikes`), `userProfile.ts` (6 reads paralelos).
- **P1 (user-facing frecuentes)**: `ratings.ts` (5 sitios), `checkins.ts` (3 sitios), `recommendations.ts` (1 read), `menuPhotos.ts` (3 reads), `follows.ts` (2 reads + count).
- **P2 (paginados y secundarios)**: `sharedLists.ts` (6 reads), `suggestions.ts` (3 reads paralelos), `users.ts` (3 reads: fetchProfileVisibility batches, searchUsers, fetchUserDisplayNames), `rankings.ts` (2 reads: fetchRanking, fetchLatestRanking).
- **P3 (infrecuentes)**: `trending.ts` (1 read), `metrics.ts` (1 read), `config.ts` (1 read), `priceLevels.ts` (fetchPriceLevelMap ya tiene cache — medir igual).

Referencia de patron: `notifications.ts` ya usa `measureAsync('notifications', () => getDocs(...))` — replicar esa forma minima, sin cambios de signature.

### S2. Seedear `config/perfCounters` en el script de seed

Agregar un bloque al final de `scripts/seed-admin-data.mjs` que escriba `config/perfCounters` con timings de muestra de los 17 triggers (ej: `onCommentCreated: [120, 150, 180, 200, 250]`) + algunos query timings aggregated (simulando lo que `dailyMetrics` ya agrego, por ejemplo valores bajo `queries.businessData_ratings`). Esto llena el `FunctionTimingTable` y `QueryLatencyTable` del panel admin inmediatamente post-seed, sin esperar a que corran triggers reales.

### S3. Helper `measuredGetDocs` / `measuredGetDoc` opcional

Crear wrappers en `src/utils/perfMetrics.ts` que encapsulen el patron `measureAsync(name, () => getDocs(q))`:

```ts
export async function measuredGetDocs<T>(name: string, q: Query<T>): Promise<QuerySnapshot<T>> {
  return measureAsync(name, () => getDocs(q));
}
```

Adoptarlos en los archivos tocados por S1 reduce verbosidad y facilita que code review detecte queries nuevas sin instrumentacion (un `getDocs` crudo en un service fuera de tests se vuelve excepcion y no norma). No es blocker: si complica imports en servicios que tambien usan otras funciones de `firebase/firestore`, se queda con `measureAsync` directo.

### S4. Documentar convencion en patterns.md

Agregar al capitulo "Queries y cache" de `docs/reference/patterns.md` una linea explicita: "Todo `getDocs` / `getDoc` en `src/services/` debe envolverse con `measureAsync(name, fn)` o `measuredGetDocs(name, q)`. Nombres convencion: `<servicio>_<operacion>` (ej: `businessData_ratings`, `userProfile_comments`)". Esto previene drift futuro.

### UX impact

Ninguno directo. El usuario final no ve cambios. El admin tendra visibilidad de los hot paths via `QueryLatencyTable` con entradas por cada `<servicio>_<operacion>` y percentiles p50/p95. Sirve para diagnosticar cuellos de botella futuros sin reportes anecdoticos.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1.P0 Wrappear `businessData.ts` (7 queries + fetchUserLikes) | Must | S |
| S1.P0 Wrappear `userProfile.ts` (6 reads paralelos) | Must | S |
| S1.P1 Wrappear `ratings.ts`, `checkins.ts`, `recommendations.ts`, `menuPhotos.ts`, `follows.ts` | Must | S |
| S1.P2 Wrappear `sharedLists.ts`, `suggestions.ts`, `users.ts`, `rankings.ts` | Should | S |
| S1.P3 Wrappear `trending.ts`, `metrics.ts`, `config.ts`, `priceLevels.ts` | Could | XS |
| S2 Seedear `config/perfCounters` en seed-admin-data.mjs | Must | XS |
| S3 Helper `measuredGetDocs` / `measuredGetDoc` en perfMetrics.ts | Should | XS |
| S4 Documentar convencion en patterns.md | Must | XS |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Lint rule que obligue `measureAsync` en queries nuevas (podria ser un seguimiento si detectamos drift post-merge).
- Cambiar la estrategia de flush de `perfMetrics.ts` (el `PERF_FLUSH_DELAY_MS` y el limite "una sesion = un flush" no se tocan).
- Agregar nuevas metricas a `dailyMetrics` que todavia no calcula (ej: errores por query). Solo instrumentamos lo existente.
- Instrumentar escrituras (`setDoc`, `addDoc`, `updateDoc`). El scope es solo lecturas que el issue identifica como untracked; las escrituras se trackean server-side via triggers.
- Refactorizar `measureAsync` para soportar tracing distribuido o correlacion con Sentry.
- Instrumentar queries en `src/hooks/` distintas a `usePaginatedQuery` (ya instrumentado).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/businessData.test.ts` (NUEVO) | Service | Que `fetchBusinessData` y `fetchSingleCollection` envuelven cada read con `measureAsync` (mock `measureAsync` y verificar llamadas con los nombres correctos) |
| `src/services/userProfile.test.ts` (ampliar existente) | Service | Que `fetchUserProfile` llama `measureAsync` 6 veces con los nombres correctos |
| `src/services/ratings.test.ts` (ampliar) | Service | Que `fetchUserRatings`, `fetchUserRatingsCount`, `hasUserRatedBusiness`, `fetchRatingsByBusinessIds` usan `measureAsync` |
| `src/services/checkins.test.ts` (ampliar) | Service | Que los 3 fetch calls usan `measureAsync` |
| `src/services/recommendations.test.ts` (NUEVO) | Service | Que `countUnreadRecommendations`, `markAllRecommendationsAsRead` usan `measureAsync` |
| `src/services/follows.test.ts` (NUEVO o ampliar) | Service | Que `isFollowing`, `fetchFollowing`, `fetchFollowersCount` usan `measureAsync` |
| `src/services/menuPhotos.test.ts` (ampliar) | Service | Que `getApprovedMenuPhoto`, `getUserPendingPhotos`, pending count check usan `measureAsync` |
| `src/services/suggestions.test.ts` (NUEVO) | Service | Que los 3 reads paralelos usan `measureAsync` |
| `src/services/users.test.ts` (NUEVO) | Service | Que `searchUsers`, `fetchProfileVisibility`, `fetchUserDisplayNames` usan `measureAsync` |
| `src/utils/perfMetrics.test.ts` (ampliar) | Util | `measuredGetDocs` y `measuredGetDoc` delegan a `measureAsync` con el nombre provisto; retornan el snapshot |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario (N/A: solo wrappers, no hay inputs nuevos)
- Todos los paths condicionales cubiertos (ej: `fetchSingleCollection` tiene 7 cases — verificar que cada case llama `measureAsync` con un nombre distinto)
- Side effects verificados: `measureAsync` llamado con el nombre correcto, pasa el callback correcto, no se pierde el resultado

---

## Seguridad

No aplica cambios en Firestore rules, Cloud Functions o autenticacion. Solo wrappeo de lecturas existentes. Verificaciones:

- [ ] No se agregan campos nuevos a colecciones → no hay cambios en `hasOnly()` de firestore.rules
- [ ] No se cambian las queries existentes, solo se envuelven → no hay cambio de superficie de lectura
- [ ] Los nombres de query pasados a `measureAsync` se persisten en `perfMetrics/{sessionId}.queries` → no exponen datos de usuario (solo identificadores de operacion como `businessData_ratings`)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `writePerfMetrics` callable (existente) | Bot escribe metricas fake para envenenar el panel admin | Ya mitigado: rate limit 5/dia por usuario en `_rateLimits/perf_{userId}` + App Check en prod. Sin cambios. |

No hay superficies nuevas. Las queries envueltas son exactamente las existentes con una funcion extra que mide tiempo client-side. No hay escrituras nuevas a Firestore.

---

## Deuda tecnica y seguridad

Issues abiertos al momento de escribir este PRD: ninguno con label `security` o `tech debt` (consulta `gh issue list --label security --state open` y `--label "tech debt"` devuelve `[]`). Solo `#168` (Vite 8 y ESLint 10 bloqueados por peer deps) esta abierto y no esta relacionado con este feature.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #303 | El propio issue base | Implementar S1 a S4 |
| #245 (cerrado) | Paralelizo batches en `fetchUserLikes` | Ya integrado; este feature solo agrega `measureAsync` encima sin tocar la logica |
| #296 (cerrado) | Agrego `trackFunctionTiming` a triggers (lado server) | Este feature hace el equivalente client-side (simetria de observabilidad) |

### Mitigacion incorporada

- **Drift preventivo**: S3 (wrapper `measuredGetDocs`) + S4 (doc en patterns) actuan como deuda preventiva — cualquier service nuevo deberia adoptar el wrapper directamente en vez de agregar reads sin instrumentacion. Sin esto, la deuda vuelve a crecer en 1-2 sprints.
- **Seed gap**: S2 resuelve un papercut operacional (panel admin vacio post-seed) que hoy se workaroundea corriendo triggers manualmente.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] No se tocan hooks — solo services. Los `useEffect` existentes que consumen estos services ya tienen patrones de cancelacion.
- [ ] Handlers async de componentes: sin cambios en su error handling.
- [ ] `measureAsync` no rethrow si la funcion subyacente throwea: ya lo hace (propaga el error).
- [ ] Archivos nuevos no superan 300 lineas — solo se modifican archivos existentes (wrappeo minimo) y se agrega 1 helper en `perfMetrics.ts` (~10 lineas).
- [ ] `logger.error` no se toca.

### Checklist de observabilidad

- [ ] Todo Cloud Function trigger nuevo: N/A (no se crean triggers)
- [ ] Todo service nuevo con queries Firestore incluye `measureAsync`: este feature ES la implementacion de ese checklist para services existentes
- [ ] Todo `trackEvent` nuevo: N/A (no se agregan events)

### Checklist offline

- [ ] Formularios/dialogs: no se tocan
- [ ] Error handlers: no se tocan

### Checklist de documentacion

- [ ] Nuevas secciones de HomeScreen: N/A
- [ ] Nuevos analytics events: N/A
- [ ] Nuevos tipos: N/A
- [ ] `docs/reference/features.md`: no se actualiza (feature es invisible al usuario final)
- [ ] `docs/reference/firestore.md`: no se actualiza (no hay cambios de schema)
- [ ] `docs/reference/patterns.md`: **actualizar** — agregar linea sobre convencion `measureAsync` en services (S4)

---

## Offline

Sin impacto. `measureAsync` solo mide tiempo client-side y almacena en memory. El flush via `writePerfMetrics` callable ya tiene guard `if (!navigator.onLine) return;` en `perfMetrics.ts:172`.

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `measureAsync('businessData_ratings', () => getDocs(q))` | Read wrapper | La query subyacente sigue usando persistent cache Firestore (prod); el timing acumula en memory; se flushea al final de sesion | N/A — el usuario no ve nada distinto |
| `writePerfMetrics` callable al flush | Write (server-side) | Guard `navigator.onLine` existente lo salta si offline; best-effort | Sin UI — metricas perdidas esa sesion |

### Checklist offline

- [ ] Reads de Firestore: ya usan persistencia offline (no cambia)
- [ ] Writes: no hay writes nuevos
- [ ] APIs externas: no se llaman APIs nuevas
- [ ] UI: no hay UI nueva
- [ ] Datos criticos: N/A

### Esfuerzo offline adicional: XS (cero)

---

## Modularizacion y % monolitico

Este feature refuerza la modularidad existente:

- Toda la instrumentacion vive en `src/services/` (capa correcta para queries Firestore).
- No se agregan queries en componentes ni contextos.
- El helper `measuredGetDocs` (S3) vive en `src/utils/perfMetrics.ts` junto a `measureAsync`.
- No se tocan `AppShell`, `SideMenu`, `TabShell` ni otros orquestadores.

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services: se mantiene
- [ ] Componentes nuevos reutilizables: N/A (no hay componentes nuevos)
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu: N/A
- [ ] Props explicitas: N/A
- [ ] Handlers reales especificados: N/A
- [ ] Ningun componente nuevo importa de firebase/firestore directamente: respetado (solo services tocados)
- [ ] Archivos en `src/hooks/` contienen al menos un React hook: N/A
- [ ] Converters nuevos: N/A
- [ ] Archivos nuevos en carpeta correcta: N/A
- [ ] Estado global: N/A
- [ ] Ningun archivo nuevo supera 400 lineas: los services tocados crecen ~5-15 lineas cada uno; `perfMetrics.ts` crece ~10 lineas. Todos bien debajo del limite.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes |
| Estado global | = | No se crea ni modifica contexto |
| Firebase coupling | = | Mismos imports de firebase/firestore en los mismos archivos |
| Organizacion por dominio | + | La convencion `measureAsync` obligatoria por service en patterns.md refuerza el limite entre service layer y consumidores |

---

## Accesibilidad y UI mobile

No hay UI. No aplica.

### Checklist de accesibilidad

- [ ] N/A — feature sin UI

### Checklist de copy

- [ ] N/A — feature sin copy user-facing. La unica cadena nueva es la linea agregada a `patterns.md` (documentacion interna en espanol).

---

## Success Criteria

1. Todos los sitios de query listados en el issue #303 estan envueltos con `measureAsync` y tienen un nombre convencional (`<servicio>_<operacion>`).
2. El `QueryLatencyTable` en el admin panel muestra entradas para al menos 8 nuevos queries hot path (incluyendo `businessData_ratings`, `businessData_comments`, `userProfile_comments`, `userProfile_ratings`) post-deploy, con p50/p95 > 0.
3. `FunctionTimingTable` y `QueryLatencyTable` en el panel admin se llenan inmediatamente tras correr `npm run seed-admin` (en lugar de esperar a que corra un trigger o sesion real).
4. La documentacion `docs/reference/patterns.md` capitulo "Queries y cache" incluye la regla explicita de envolver queries de services con `measureAsync`.
5. Cobertura de tests >= 80% en los archivos modificados; todos los casos de `fetchSingleCollection` en `businessData.ts` verifican que `measureAsync` fue llamado con el nombre correcto.
