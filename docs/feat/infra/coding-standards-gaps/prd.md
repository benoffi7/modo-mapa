# PRD: Coding Standards — Documentar patrones arquitecturales faltantes

**Feature:** coding-standards-gaps
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #226
**Prioridad:** Media

---

## Contexto

El proyecto tiene 10+ patrones arquitecturales activamente utilizados en el codebase que no estan documentados en `docs/reference/coding-standards.md`. Algunos de estos patrones (offline support, IndexedDB cache, deep linking, optimistic updates) son criticos para el desarrollo de nuevas features y actualmente solo se pueden aprender leyendo el codigo. Ademas, se identificaron 3 violaciones activas de los estandares existentes.

## Problema

- Desarrolladores (humanos o agentes) que consultan `coding-standards.md` no encuentran guia sobre patrones clave como offline queue, 3-tier cache, deep linking, screen tracking, o converter layers, lo que lleva a implementaciones inconsistentes o duplicadas.
- No hay criterios documentados para decidir entre `localStorage` vs `Context` vs `IndexedDB` para persistencia de estado, obligando a revisar multiples archivos para entender la convencion actual.
- Existen 3 violaciones activas de estandares documentados (BusinessComments 398 lineas, BusinessQuestions 392 lineas + noop callbacks, FollowedList importando directamente de firebase/firestore) que no estan trackeadas como tech debt.

## Solucion

### S1. Documentar patrones faltantes en coding-standards.md

Agregar secciones para cada patron no documentado, con descripcion, ubicacion en el codebase, y ejemplo de uso:

1. **Offline support system** — documentar `offlineInterceptor`, `offlineQueue`, `syncEngine`, `withOfflineSupport()` wrapper. Referenciar `patterns.md` seccion "Offline queue" y expandir con guia de cuando y como usar.
2. **Client-side cache con IndexedDB** — documentar `readCache.ts` (LRU + TTL), `queryCache`, y el flujo 3-tier (memory -> IndexedDB -> Firestore). Explicar cuando usar cada nivel.
3. **Deep linking** — documentar el patron `?business={id}` y `?list={id}`, el hook `useDeepLinks`, y como agregar nuevos deep links.
4. **Screen tracking** — documentar `useScreenTracking` y la convencion de nombres de pantalla para analytics.
5. **Optimistic updates** — documentar los patrones existentes: `useOptimisticLikes`, `useUndoDelete`, `pendingRating`/`pendingLevel`, `FavoriteButton` derived state. Dar guia de cuando usar cada variante.
6. **Converter layers** — documentar `converters.ts` (user-facing reads), `adminConverters.ts` (admin panel), `metricsConverter.ts` (public metrics). Explicar cuando usar cada uno.
7. **Analytics event naming** — documentar la convencion `EVT_*` en `constants/analyticsEvents.ts` y las reglas para nuevos eventos. Referenciar `patterns.md` que ya menciona esto brevemente.
8. **Storage decision criteria** — documentar criterios para `localStorage` (preferencias de dispositivo), `Context` (estado de sesion compartido), `IndexedDB` (cache de datos grandes, offline queue).
9. **Advanced pagination** — documentar cursor-based pagination con `QueryDocumentSnapshot`, `usePaginatedQuery` constraints, `loadAll(maxItems)`, y el patron de `cacheKey`.
10. **Component sub-folder organization** — documentar cuando crear sub-carpetas (3+ archivos relacionados: componente principal + subcomponentes/types/utils/hooks) vs mantener estructura plana.

### S2. Trackear violaciones como tech debt

Crear issues de GitHub separados para cada violacion activa, categorizados como tech debt:

1. `BusinessComments.tsx` — 398 lineas (limite documentado: 300)
2. `BusinessQuestions.tsx` — 392 lineas + noop callbacks (debe usar `throw new Error`)
3. `FollowedList.tsx` — importa `QueryDocumentSnapshot` de firebase/firestore (viola boundary de service layer)

### S3. Cross-reference con patterns.md

Varios de los patrones faltantes ya estan documentados parcialmente en `patterns.md`. En vez de duplicar, agregar referencias cruzadas claras en `coding-standards.md` que apunten a las secciones relevantes de `patterns.md`, con un resumen de una linea y la regla de decision.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Seccion offline support en coding-standards.md | Alta | S |
| Seccion IndexedDB cache en coding-standards.md | Alta | S |
| Seccion deep linking en coding-standards.md | Media | S |
| Seccion screen tracking en coding-standards.md | Baja | S |
| Seccion optimistic updates en coding-standards.md | Alta | S |
| Seccion converter layers en coding-standards.md | Media | S |
| Seccion analytics event naming en coding-standards.md | Media | S |
| Seccion storage decision criteria en coding-standards.md | Alta | S |
| Seccion advanced pagination en coding-standards.md | Media | S |
| Seccion component sub-folder organization en coding-standards.md | Media | S |
| Crear 3 issues de tech debt para violaciones activas | Media | S |
| Cross-references entre coding-standards.md y patterns.md | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactorizar las 3 violaciones activas (se trackean como issues separados, no se resuelven en este feature)
- Reescribir `patterns.md` o fusionarlo con `coding-standards.md` (son documentos complementarios: patterns describe "que patrones usamos", coding-standards describe "como escribir codigo nuevo")
- Documentar patrones de Cloud Functions (ya cubiertos en `coding-standards.md` seccion "Cloud Functions")
- Agregar linting rules automatizadas para los patrones documentados (seria un feature separado)

---

## Tests

Este feature es puramente documentacion. No hay codigo de produccion nuevo que requiera tests unitarios.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| N/A | N/A | Feature de documentacion, sin codigo nuevo |

### Criterios de testing

- Verificar que cada seccion nueva tiene al menos: descripcion, ubicacion en codebase, ejemplo de uso, y regla de decision
- Verificar que las cross-references a patterns.md son validas (los anchors existen)
- Verificar que los 3 issues de tech debt se crearon con labels correctas

---

## Seguridad

Este feature no introduce superficie de ataque nueva. Es documentacion interna del proyecto.

- [x] No se agregan endpoints, colecciones ni inputs de usuario
- [x] No se modifica codigo de produccion

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A | N/A |

---

## Deuda tecnica y seguridad

No hay issues abiertos de seguridad ni tech debt en GitHub actualmente.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #226 (este issue) | principal | Documentar patrones y crear issues para violaciones |

### Mitigacion incorporada

- Se crean 3 issues nuevos de tech debt para las violaciones activas detectadas en #226, asegurando que queden trackeadas en el backlog en vez de perderse en el cuerpo de un issue de documentacion.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] N/A — feature de documentacion, sin data flows

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature no introduce componentes, hooks ni servicios nuevos.

### Checklist modularizacion

- [x] N/A — feature de documentacion, sin codigo nuevo

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Sin cambios de codigo |
| Estado global | = | Sin cambios de codigo |
| Firebase coupling | = | Sin cambios de codigo |
| Organizacion por dominio | = | Sin cambios de codigo |

---

## Success Criteria

1. `coding-standards.md` contiene secciones para los 10 patrones faltantes, cada una con descripcion, ubicacion en codebase, ejemplo, y regla de decision
2. Cada seccion nueva incluye cross-references a `patterns.md` cuando el patron ya esta parcialmente documentado ahi
3. La seccion "Storage decision criteria" proporciona una tabla clara de cuando usar localStorage vs Context vs IndexedDB
4. Se crean 3 issues de GitHub con label `tech debt` para las violaciones activas (BusinessComments 398 lineas, BusinessQuestions 392 lineas + noops, FollowedList firebase import)
5. El documento mantiene el formato y tono consistente con las secciones existentes de `coding-standards.md`
