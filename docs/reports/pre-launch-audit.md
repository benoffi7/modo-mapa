# Pre-Launch Audit Report — Modo Mapa v2.3.0

**Fecha:** 2026-03-13
**Objetivo:** Preparar la app para lanzamiento con 500+ usuarios

---

## 1. Seguridad (3 rondas completadas — 0 vulnerabilidades)

Todas las vulnerabilidades identificadas en las 3 rondas de auditoría fueron resueltas:

| Ronda | Fixes | PRs |
|-------|-------|-----|
| R1 | C1 (criteria validation), H1 (ratings ownership), H3 (serialize-javascript), M2 (query limits), L1 (keys().hasOnly) | #68, #69 |
| R2 | N1 (priceLevels ownership), N2 (keys().hasOnly x7), N3 (customTags immutability), H2 (replyCount server-only), M1 (cascade deletes) | #71 |
| R3 | N4 (menuPhotos keys), N5 (userSettings keys), N6 (comments affectedKeys) | #72 |

**Patrones de seguridad aplicados en todas las colecciones:**

- `keys().hasOnly()` en todos los create rules
- `affectedKeys().hasOnly()` en updates con campos server-managed
- `resource.data.userId` ownership check (no `request.resource.data`)
- userId inmutabilidad en updates
- Server timestamps obligatorios
- replyCount/likeCount gestionados exclusivamente por Cloud Functions
- Cascade delete de replies huérfanas

---

## 2. Arquitectura — Fortalezas

- Clean layered architecture: Components → Services → Firestore (sin imports directos)
- Typed converters en todas las lecturas (12 converters)
- Collection names centralizados (16 colecciones)
- 14 módulos de constantes sin magic numbers
- Composite doc IDs previenen duplicados sin queries extra
- Props-driven design en BusinessSheet (1 punto de datos, N componentes)
- Optimistic UI con revert en errores
- Admin route aislada (no carga Google Maps)

## 3. Arquitectura — Deuda técnica

| ID | Severidad | Descripción |
|----|-----------|-------------|
| DT-1 | Media | Dependencia bidireccional services ↔ hooks (invalidateQueryCache) |
| DT-3 | Media | `usePriceLevelFilter` fetch ALL price levels sin limit() — 20K docs a 500 users |
| DT-4 | Media | `dailyMetrics` Cloud Function hace full collection scans |
| DT-5 | Media | N+1 `getDoc` calls en `fetchUserLikes` (1 por comentario) |
| DT-6 | Baja | `BusinessComments` 670 líneas — mega-component |
| DT-8 | Baja | Notification polling sin visibility awareness (500 queries/min a escala) |
| VC-1 | Media | `AuthContext` re-suscribe `onAuthStateChanged` en cada cambio de ruta |

---

## 4. Performance — Findings

### Bundle size (main chunk: 1,551 kB / 484 kB gzip)

| ID | Impacto | Descripción | Ahorro estimado |
|----|---------|-------------|-----------------|
| P1.1 | Alto | Sentry loaded eagerly en main.tsx | 30-50 kB gzip |
| P1.2 | Medio | recharts en main chunk (via StatsView en SideMenu) | ~18 kB gzip |
| P1.3 | Medio | SideMenu importa 10 secciones eagerly | Variable |
| P1.4 | Bajo | Sin manual chunk splitting (firebase, MUI en un solo chunk) | Cache hit rate |

### Firestore queries (impacto en billing a escala)

| ID | Impacto | Descripción | Costo a 500 users |
|----|---------|-------------|--------------------|
| P2.1 | Alto | N+1 getDoc en fetchUserLikes | 20 reads/business open |
| P2.2 | Medio | usePriceLevelFilter unbounded fetch | ~20K docs on load |
| P2.5 | Medio | Notification polling getCountFromServer cada 60s | 30K queries/hora |

### Re-renders

| ID | Impacto | Descripción |
|----|---------|-------------|
| P3.1 | Alto | MapContext value change re-renders 40+ markers en cada selección |

---

## 5. Tests — Cobertura actual

| Área | Archivos | Tests | Cobertura |
|------|----------|-------|-----------|
| Frontend hooks | 16 | 6 testeados (76 tests) | ~38% |
| Frontend services | 14 | 2 testeados (25 tests) | ~14% |
| Frontend utils | 3 | 0 | **0%** |
| Frontend contexts | 2 | 2 testeados (22 tests) | 100% |
| Backend triggers | 9 | 2 testeados (28 tests) | ~22% |
| Backend utils | 6 | 4 testeados (22 tests) | 67% |
| **Total** | | **161 tests passing** | |

### Top 7 tests críticos — TODOS COMPLETADOS (PRs #75, #76)

1. ~~`functions/src/triggers/comments.ts`~~ — 18 tests (cascade delete, replyCount, rate limit, moderation, re-moderation) ✅
2. ~~`src/services/comments.ts`~~ — 12 tests (input validation, trim, parentId) ✅
3. ~~`src/services/ratings.ts`~~ — 10 tests (score validation, criteria merge, create vs update) ✅
4. ~~`src/hooks/useSuggestions.ts`~~ — 10 tests (scoring, penalties, sorting, limit) ✅
5. ~~`functions/src/triggers/commentLikes.ts`~~ — 10 tests (likeCount, rate limit, notifications) ✅
6. ~~`functions/src/utils/notifications.ts`~~ — 9 tests (shouldNotify preferences, all types, expiry) ✅

---

## 6. Recomendaciones priorizadas para lanzamiento

### Must-have — COMPLETADO (PR #75)

1. ~~**Tests críticos (#1-#4)**~~: cascade delete, rate limiting, input validation ✅
2. ~~**Fix P2.1**~~: N+1 likes → batched `documentId('in')` (30 per batch) ✅
3. ~~**Fix P2.2**~~: `limit(20K)` + TTL 5min en `usePriceLevelFilter` ✅

### Should-have — COMPLETADO (PRs #75, #76)

4. ~~**Fix P1.1**~~: Sentry lazy-loaded via dynamic import ✅
5. ~~**Fix P1.3**~~: SideMenu sections lazy-loaded (main chunk 484→361 kB gzip, -25%) ✅
6. ~~**Fix P2.5**~~: Notification polling con visibility awareness ✅
7. ~~**Tests #5-#7**~~: suggestions, likeCount, notifications ✅

### Nice-to-have (post-launch iterativo)

8. **Fix P3.1**: Split MapContext en selection + filters
9. **Fix DT-1**: Extraer cache invalidation a módulo separado
10. **Fix P1.4**: Manual chunk splitting (firebase, MUI, recharts)
11. **Fix DT-4**: Pre-aggregate dailyMetrics
