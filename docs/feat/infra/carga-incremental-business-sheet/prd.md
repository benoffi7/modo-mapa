# PRD: Performance — carga incremental en BusinessSheet

**Feature:** carga-incremental-business-sheet
**Categoria:** infra
**Fecha:** 2026-03-27
**Issue:** #198
**Prioridad:** Media

---

## Contexto

BusinessSheet es la vista principal de detalle de un comercio en Modo Mapa. Actualmente, `useBusinessData` ejecuta 7 queries de Firestore en un solo `Promise.all` (favoritos, ratings, comentarios + likes, userTags, customTags, priceLevels, menuPhotos). El hook ya cuenta con cache client-side de 5 min TTL, selective refetch por coleccion, y proteccion contra race conditions con `patchedRef`. Sin embargo, cuando el cache esta frio, la UI muestra un skeleton completo hasta que **todas** las queries completen, incluyendo la mas lenta (tipicamente comments, que puede crecer a cientos de docs).

## Problema

- **Time to Interactive alto (~2s):** El usuario no puede interactuar con ningun elemento del BusinessSheet hasta que las 7 queries terminen. Si una sola query (ej: comments con muchos docs + fetchUserLikes en batches) es lenta, bloquea toda la vista.
- **Skeleton monolitico:** `BusinessSheetSkeleton` muestra un placeholder para toda la vista. El usuario no puede ver el nombre, categoria ni rating del comercio mientras carga, a pesar de que esos datos (nombre, direccion, categoria) ya estan disponibles localmente en el JSON estatico (`businesses.json`).
- **Percepcion de lentitud innecesaria:** Los datos del header (nombre, direccion, categoria) no requieren Firestore en absoluto, y los datos de rating/favorites/priceLevels son queries simples que completan rapido. Mezclarlos con queries pesadas (comments) penaliza la percepcion del usuario.

## Solucion

### S1. Render inmediato del header (datos locales)

El header del BusinessSheet (nombre, categoria, direccion, telefono, botones de compartir/favorito/direcciones) no depende de Firestore. Los datos vienen del JSON estatico via `selectedBusiness` de `MapContext`. Actualmente el skeleton cubre todo incluyendo el header.

**Cambio:** BusinessSheet debe renderizar el header inmediatamente cuando `selectedBusiness` no es null, sin esperar a `useBusinessData`. El skeleton solo debe cubrir las secciones que dependen de datos de Firestore. El FavoriteButton muestra un estado "indeterminado" (disabled) hasta que `isFavorite` se resuelva.

### S2. Carga en dos fases con `useBusinessData`

Refactorizar `fetchBusinessData` para ejecutar las queries en dos fases secuenciales:

**Fase 1 (rapida):** favorite, ratings, priceLevels, userTags, customTags, menuPhotos
- Estas queries son rapidas porque: favorite es un getDoc unico, ratings/priceLevels/userTags/customTags son queries simples filtradas por businessId con pocos docs, menuPhotos devuelve 0 o 1 doc.
- Al completar Fase 1, actualizar state y renderizar las secciones correspondientes.

**Fase 2 (potencialmente lenta):** comments + fetchUserLikes
- Comments puede tener muchos docs y requiere un segundo round-trip para user likes (batched en grupos de 30).
- Al completar Fase 2, actualizar state y renderizar la seccion de comentarios/preguntas.

Cada fase actualiza el state de forma incremental. El hook expone `isLoading` (fase 1 aun no completo) y un nuevo `isLoadingComments` (fase 2 aun no completo) para que BusinessSheet pueda mostrar skeletons independientes por seccion.

**Interaccion con cache existente:** Si hay cache hit (TTL 5 min), toda la data se inyecta de una vez como hoy — no hay fases. Las fases solo aplican cuando el cache esta frio.

**Interaccion con `patchedRef`:** El mecanismo de `patchedRef` sigue funcionando igual. Si un refetch parcial ocurre durante la fase 1, patchedRef marca esa coleccion y la fase 2 no la sobreescribe.

**Interaccion con `refetch(collectionName)`:** Sin cambios. `refetch` sigue operando coleccion por coleccion.

### S3. Skeletons independientes por seccion

Reemplazar el skeleton monolitico con skeletons individuales por seccion dentro de BusinessSheet:

- **Rating section skeleton:** Mientras `isLoading` es true, mostrar skeleton de estrellas + barra.
- **Tags section skeleton:** Mientras `isLoading` es true, mostrar skeleton de chips.
- **Comments/Questions skeleton:** Mientras `isLoadingComments` es true, mostrar skeleton de lista de comentarios (ya existe logica similar en el skeleton actual).
- **Price level skeleton:** Mientras `isLoading` es true, mostrar skeleton de botones $/$$/$$$$.
- **Menu photo skeleton:** Mientras `isLoading` es true, mostrar skeleton rectangular.

Las secciones que ya cargaron se renderizan normalmente mientras las pendientes muestran skeleton. Usar `Skeleton` de MUI directamente en cada componente hijo, no un componente wrapper nuevo.

### S4. Analytics: medir impacto

Agregar metricas para medir el impacto real del cambio:

- `business_sheet_phase1_ms`: tiempo desde apertura del sheet hasta que fase 1 completa.
- `business_sheet_phase2_ms`: tiempo desde apertura del sheet hasta que fase 2 completa.
- `business_sheet_cache_hit`: booleano indicando si se uso cache.

Usar `trackEvent` con el patron existente de `EVT_*` constants en `constants/analyticsEvents.ts`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Render inmediato del header (sin skeleton para datos locales) | Alta | S |
| S2. Refactorizar `useBusinessData` con carga en dos fases | Alta | M |
| S3. Skeletons independientes por seccion en BusinessSheet | Alta | M |
| S4. Analytics de tiempos de carga por fase | Baja | S |
| Actualizar `useBusinessDataCache` para soportar entries parciales | Media | S |
| Actualizar tests de `useBusinessDataCache` y agregar tests para fases | Alta | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- **Virtualizar la lista de comentarios en BusinessSheet:** Ya existe virtualizacion condicional en CommentsList del menu lateral (>= 20 items con `@tanstack/react-virtual`), pero no aplica aqui porque BusinessSheet muestra todos los comments en un drawer sin scroll independiente.
- **Streaming/real-time listeners:** Cambiar de queries one-shot a `onSnapshot` listeners para updates en tiempo real. Esto cambiaria fundamentalmente el patron de datos del BusinessSheet.
- **Server-side aggregation:** Pre-computar datos agregados (promedio de ratings, count de comments) en Cloud Functions para eliminar queries client-side. Esto seria una optimizacion mayor que requiere nuevo modelo de datos.
- **Lazy loading de secciones por scroll:** Cargar comments solo cuando el usuario scrollea hasta esa seccion. Agregar complejidad de IntersectionObserver sin beneficio claro dado que el drawer es corto.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useBusinessData.ts` | Hook | Carga en dos fases: fase 1 resuelve antes que fase 2, state parcial intermedio correcto, `isLoadingComments` transitions, interaccion con cache (hit = sin fases), interaccion con patchedRef entre fases, stale request handling con fetchIdRef entre fases |
| `src/hooks/useBusinessDataCache.ts` | Hook (existente, ampliar) | Cache parcial: `setBusinessCache` con datos de fase 1, `patchBusinessCache` con datos de fase 2, TTL sigue funcionando |
| `src/hooks/useBusinessDataCache.test.ts` | Test existente | Agregar casos para nuevos flujos de carga parcial si cambia la interfaz del cache |

### Casos a cubrir

- Fase 1 completa: state tiene ratings, favorites, tags, priceLevels, menuPhoto; `isLoading` pasa a false; `isLoadingComments` sigue true
- Fase 2 completa: state tiene comments + userCommentLikes; `isLoadingComments` pasa a false
- Cache hit: ambos `isLoading` e `isLoadingComments` son false inmediatamente, sin queries
- Fase 1 completa pero fase 2 falla: datos de fase 1 visibles, error parcial manejado
- Refetch parcial durante fase 1: patchedRef previene sobreescritura
- Cambio de businessId durante carga: fetchIdRef invalida ambas fases
- `refetch('comments')` sigue funcionando independiente de fases

### Mock strategy

- Firestore: mock `getDoc`, `getDocs` como en tests existentes (ver `src/services/comments.test.ts`)
- Cache: mock `useBusinessDataCache` exports
- Auth: mock `useAuth()` context

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

---

## Seguridad

Este feature es una optimizacion de performance client-side que no introduce nuevos endpoints, colecciones ni inputs de usuario. Las queries de Firestore siguen siendo las mismas, con las mismas rules y validaciones.

- [x] Sin nuevas colecciones de Firestore
- [x] Sin nuevos inputs de usuario
- [x] Sin cambios a Firestore rules
- [x] Sin nuevos secretos o API keys
- [ ] Verificar que la separacion en fases no exponga datos parciales incorrectos (ej: mostrar rating=0 antes de cargar ratings reales — usar skeleton, no valor default visible)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Fase 1 queries (favorites, ratings, tags, priceLevels, menuPhotos) | read | Firestore persistent cache (IndexedDB en prod) sirve datos cacheados automaticamente | Skeleton por seccion mientras resuelve |
| Fase 2 queries (comments + userLikes) | read | Firestore persistent cache (IndexedDB en prod) sirve datos cacheados automaticamente | Skeleton de comentarios mientras resuelve |
| Header (nombre, direccion, categoria) | read (local) | JSON estatico, siempre disponible | Ninguno necesario — datos locales |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (persistentLocalCache en prod)
- [x] Writes: no aplica (este feature es read-only)
- [x] APIs externas: no aplica
- [x] UI: el header se muestra inmediatamente sin red; las secciones de Firestore muestran skeleton individual
- [x] Datos criticos: header siempre disponible en cache local (JSON); datos de Firestore disponibles via persistent cache

### Esfuerzo offline adicional: S

No se requiere trabajo offline adicional. El feature aprovecha la infraestructura existente (Firestore persistent cache + JSON local). El beneficio es que offline, el usuario ve el header inmediatamente en vez de un skeleton completo.

---

## Modularizacion

La refactorizacion propuesta mantiene y mejora la separacion existente:

- `useBusinessData` sigue siendo el unico hook que orquesta las queries. La logica de fases vive enteramente en este hook, no en BusinessSheet ni en componentes hijos.
- BusinessSheet solo consume `isLoading` e `isLoadingComments` del hook para decidir que renderizar. No agrega logica de negocio.
- Los componentes hijos (BusinessRating, BusinessTags, etc.) siguen recibiendo datos como props — el patron de `Props-driven business components` documentado en patterns.md no cambia.
- Los skeletons se agregan inline en cada seccion de BusinessSheet, no como componentes nuevos separados (son 2-3 lineas de `<Skeleton>` de MUI por seccion).

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (toda la logica de fases en `useBusinessData`)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout (no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado

---

## Success Criteria

1. Al abrir un BusinessSheet con cache frio, el header (nombre, categoria, direccion, botones) se muestra en menos de 100ms.
2. Las secciones de rating, tags, precio y foto se renderizan tan pronto completa la fase 1, sin esperar a comments.
3. La seccion de comentarios muestra su propio skeleton mientras carga, sin bloquear el resto de la vista.
4. Con cache caliente (TTL 5 min), el comportamiento es identico al actual: toda la data aparece de una vez.
5. Los tests de `useBusinessData` cubren los flujos de dos fases, incluyendo interacciones con cache y patchedRef, con >= 80% de cobertura.
