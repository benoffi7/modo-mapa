# Auditorías Phase 4 — Threads, Multi-Criteria, Suggestions

**Branch:** `feat/phase4-threads-criteria-suggestions`
**Fecha:** 2026-03-13
**Version:** 2.3.0

---

## Auditoría de Seguridad

### Crítico

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **C1** | `isValidCriteria()` valida keys pero **no los valores** — un usuario puede setear `criteria.food: 999` y pasa las rules. Debe validar `is int && >= 1 && <= 5` por cada key. | `firestore.rules:50-57` |

### Alto

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **H1** | Rating update valida `request.resource.data.userId` (incoming) pero no `resource.data.userId` (existing) — cualquier user puede pisar el rating de otro. Fix: agregar `resource.data.userId == request.auth.uid` y `request.resource.data.userId == resource.data.userId`. | `firestore.rules:71` |
| **H2** | `replyCount` puede ser incrementado/decrementado por cualquier user autenticado sin validar que realmente crea/borra un reply. Fix ideal: mover replyCount a Cloud Function trigger. | `firestore.rules:111-116` |
| **H3** | `serialize-javascript` CVE (CVSS 8.1) en dependencia transitiva de `vite-plugin-pwa -> workbox-build -> @rollup/plugin-terser`. Solo build-time. Fix: upgrade/downgrade `vite-plugin-pwa`. | `node_modules` (transitiva) |

### Medio

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **M1** | Borrar un comentario padre no borra los replies hijos — orphaned docs en Firestore. Fix: Cloud Function `onDelete` trigger con cascade delete. | `src/services/comments.ts:77-91` |
| **M2** | `fetchUserSuggestionData` ejecuta 3 queries sin `.limit()` — sin cota para power users. Fix: agregar `.limit(100)` a cada query. | `src/services/suggestions.ts:17-36` |
| **M3** | Rate limiting de comments/dia es solo client-side (`MAX_COMMENTS_PER_DAY`), no en Firestore rules. Verificar que Cloud Function trigger lo enforce server-side. | `src/components/business/BusinessComments.tsx:99-103` |

### Bajo / Informativo

| ID | Hallazgo | Ubicación |
|----|----------|-----------|
| **L1** | Comment create no usa `keys().hasOnly()` — se pueden inyectar campos extra como `likeCount: 9999`. Fix: agregar hasOnly en create rule. | `firestore.rules:89-98` |
| **L2** | Privacy policy correctamente actualizada con threads, criteria, y sugerencias. | `src/components/menu/PrivacyPolicy.tsx` |
| **L3** | Seed script es emulator-only, sin secrets. OK. | `scripts/seed-admin-data.mjs` |
| **L4** | No se encontraron vectores XSS (no `dangerouslySetInnerHTML`, no `eval()`, no `innerHTML`). | `src/` |

### Bien implementado (seguridad)

- Criteria key whitelist con `hasOnly` en rules
- `writeBatch` para atomicidad de threads (crear reply + increment replyCount)
- Comment update immutability guards (userId, businessId, userName, createdAt no mutables)
- `replyCount` inicializado a 0 en create
- Typed converters con `withConverter<T>()`
- Validación client-side de criteria values 1-5 (defense-in-depth)
- Sugerencias 100% client-side (sin leak de datos de comportamiento al server)
- `.env` files en `.gitignore`, seed sin credentials
- `serverTimestamp()` usado consistentemente con validación en rules

---

## Auditoría de Arquitectura

### Bien implementado (arquitectura)

- Service layer pattern respetado en los 3 features
- Types centralizados en `src/types/index.ts` (parentId, replyCount, RatingCriteria, SuggestionReason, SuggestedBusiness)
- Constants con barrel export en `src/constants/` (criteria.ts, suggestions.ts)
- `withConverter` en reads, `COLLECTIONS` sin magic strings
- Compound doc ID pattern (`{userId}__{businessId}`)
- Props-driven components (BusinessComments, BusinessRating)
- `writeBatch` para atomicidad de threads
- Optimistic UI con revert en criteria ratings
- `Promise.all` para queries paralelas en sugerencias

### Violaciones

| ID | Hallazgo | Fix |
|----|----------|-----|
| **V1** | `services/index.ts` no exporta `upsertCriteriaRating`, `deleteRating`, `fetchUserSuggestionData` | Agregar al barrel export |
| **V2** | `UserSuggestionData` definido en `services/suggestions.ts` en vez de `types/index.ts` | Mover a types |
| **V3** | `CriterionConfig` definido en `constants/criteria.ts` en vez de `types/index.ts` | Mover a types |
| **V4** | Reply path usa `doc(collection(...))` + `batch.set()` vs normal path usa `addDoc(collection(...))` — inconsistencia menor en addComment | Unificar patrón |

### Concerns

| ID | Hallazgo | Impacto |
|----|----------|---------|
| **C1** | `useSuggestions` importa `allBusinesses` directo de `useBusinesses` (cross-hook coupling) | Testabilidad. Extraer a `src/data/` |
| **C2** | `BusinessComments.tsx` tiene 647 lineas, 13+ useState — demasiada responsabilidad | Mantenibilidad. Extraer `CommentItem` + `useCommentThreads` |
| **C3** | Colores hardcodeados (`#1a73e8`, `#e91e63`, `#5f6368`) en vez de theme tokens | Consistencia con dark mode. Usar `theme.palette` |
| **C5** | Scoring de sugerencias es O(N*M) con `allBusinesses.find()` dentro de loop de favoritos | No impacta con 40 negocios. Optimizar si escala |
| **C6** | `eslint-disable` para exhaustive-deps por `initialState` recreado cada render | Mover `initialState` fuera del hook como constante de módulo |
| **C7** | Replies huérfanos no se limpian al borrar padre (= M1 de seguridad) | Cloud Function cascade delete |

### Sugerencias de refactor

| ID | Acción | Esfuerzo |
|----|--------|----------|
| **S1** | Agregar exports faltantes a `services/index.ts` barrel | 5 min |
| **S2** | Mover `UserSuggestionData` y `CriterionConfig` a `types/index.ts` | 10 min |
| **S3** | Extraer `allBusinesses` a `src/data/index.ts` | 15 min |
| **S4** | Extraer `CommentItem.tsx` + `useCommentThreads.ts` de BusinessComments | 1-2 hs |
| **S5** | Cloud Function cascade delete para replies huérfanos | 30 min |
| **S6** | Mover `initialState` de useSuggestions fuera del hook | 5 min |
| **S7** | Reemplazar hex colors con theme tokens en BusinessComments | 15 min |

---

## Prioridades de acción

| Prioridad | IDs | Acción | Esfuerzo |
|-----------|-----|--------|----------|
| **Crítico** | C1 | Validar valores int 1-5 por criterio en Firestore rules | 15 min |
| **Alto** | H1 | Agregar ownership check a ratings update rule | 5 min |
| **Alto** | H2 | Mover replyCount a Cloud Function trigger | 30 min |
| **Alto** | H3 | Resolver CVE de serialize-javascript | 10 min |
| **Rápido** | V1-V3, S1-S2, S6 | Barrel exports + mover types + initialState | 20 min |
| **Medio** | M1/C7, S5 | Cloud Function cascade delete para replies | 30 min |
| **Medio** | M2 | Agregar `.limit()` a queries de sugerencias | 5 min |
| **Medio** | C2, S4 | Extraer CommentItem + useCommentThreads | 1-2 hs |
| **Bajo** | L1 | hasOnly en comment create rule | 5 min |
| **Bajo** | C3, S7 | Theme tokens en BusinessComments | 15 min |
| **Bajo** | C1-arq, S3 | Extraer allBusinesses a data module | 15 min |
