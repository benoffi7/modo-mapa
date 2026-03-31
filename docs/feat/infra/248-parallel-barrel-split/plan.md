# Plan: Splitear barrel files por dominio para reducir conflictos en paralelo

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Split de analyticsEvents

**Branch:** `feat/248-parallel-barrel-split`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/analyticsEvents/onboarding.ts` | Crear archivo con los 10 EVT_ONBOARDING_*, EVT_BENEFITS_*, EVT_ACTIVITY_REMINDER_*, EVT_VERIFICATION_NUDGE_* |
| 2 | `src/constants/analyticsEvents/trending.ts` | Crear archivo con EVT_TRENDING_VIEWED, EVT_TRENDING_BUSINESS_CLICKED, EVT_TRENDING_NEAR_*, EVT_RANKINGS_ZONE_FILTER |
| 3 | `src/constants/analyticsEvents/offline.ts` | Crear archivo con los 4 EVT_OFFLINE_* |
| 4 | `src/constants/analyticsEvents/social.ts` | Crear archivo con EVT_FOLLOW, EVT_UNFOLLOW, EVT_FEED_*, EVT_RECOMMENDATION_* |
| 5 | `src/constants/analyticsEvents/navigation.ts` | Crear archivo con EVT_TAB_SWITCHED, EVT_SUB_TAB_SWITCHED, EVT_BUSINESS_SHEET_TAB_CHANGED |
| 6 | `src/constants/analyticsEvents/system.ts` | Crear archivo con EVT_FORCE_UPDATE_*, EVT_ACCOUNT_DELETED |
| 7 | `src/constants/analyticsEvents/business.ts` | Crear archivo con EVT_RATING_PROMPT_*, EVT_BUSINESS_SHEET_PHASE*_MS, EVT_BUSINESS_SHEET_CACHE_HIT, EVT_LIST_ICON_CHANGED |
| 8 | `src/constants/analyticsEvents/digest.ts` | Crear archivo con los 4 EVT_DIGEST_* |
| 9 | `src/constants/analyticsEvents/interests.ts` | Crear archivo con EVT_TAG_FOLLOWED, EVT_TAG_UNFOLLOWED, EVT_INTERESTS_* |
| 10 | `src/constants/analyticsEvents/index.ts` | Crear barrel con `export * from './onboarding'`; ... (9 re-exports) |
| 11 | `src/constants/analyticsEvents.ts` | Eliminar archivo original (reemplazado por directorio) |
| 12 | Verificacion | `npx tsc --noEmit` — confirmar que los 26 consumidores compilan |

### Fase 2: Split de types/index.ts

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/business.ts` | Crear con Business, BusinessCategory, RatingCriteria, RatingCriterionId, Rating, Comment, CommentLike, UserTag, CustomTag, PriceLevel, MenuPhoto, MenuPhotoStatus, TrendingBusiness, TrendingBusinessBreakdown, TrendingData |
| 2 | `src/types/user.ts` | Crear con UserProfile, UserSettings, DigestFrequency, CheckIn, VerificationBadge, VerificationBadgeId |
| 3 | `src/types/social.ts` | Crear con Follow, ActivityType, ActivityFeedItem, Recommendation, Favorite |
| 4 | `src/types/lists.ts` | Crear con SharedList, ListItem |
| 5 | `src/types/feedback.ts` | Crear con Feedback, FeedbackCategory, FeedbackStatus |
| 6 | `src/types/notifications.ts` | Crear con AppNotification, NotificationType, DigestGroup |
| 7 | `src/types/rankings.ts` | Crear con UserRankingEntry, UserRanking |
| 8 | `src/types/navigation.ts` | Crear con TabId, ALL_TAB_IDS, SocialSubTab, ListsSubTab, SearchViewMode, LocationSource |
| 9 | `src/types/discovery.ts` | Crear con LocalTrendingResult, SuggestedBusiness, SuggestionReason, InterestFeedItem, InterestFeedGroup, PredefinedTagId. Incluye `import { PREDEFINED_TAGS } from '../constants/tags'` y `import type { Business } from './business'` y `import type { TrendingBusiness } from './business'` |
| 10 | `src/types/index.ts` | Reescribir como barrel: `export * from './business'`; ... (9 nuevos) + mantener re-exports de offline y admin |
| 11 | Verificacion | `npx tsc --noEmit` — confirmar que los 139 consumidores compilan |

### Fase 3: Registro declarativo de HomeScreen

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/home/homeSections.ts` | Crear con interfaz HomeSection, lazy imports de los 8 componentes, array HOME_SECTIONS |
| 2 | `src/components/home/HomeScreen.tsx` | Reescribir: eliminar 8 imports estaticos de secciones, importar HOME_SECTIONS, iterar con Suspense + Divider condicional. Mantener useRatingPrompt + RatingPromptBanner como caso especial |
| 3 | Verificacion | `npx tsc --noEmit` + `npm run build` |

### Fase 4: Documentacion de regla no-append

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/procedures/worktree-workflow.md` | Agregar seccion "Regla de no-append para barrel files" despues de "Patron aditivo para constantes". Incluir instrucciones para analyticsEvents, types y HOME_SECTIONS |

### Fase 5: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Crear test que importa todo desde el barrel y verifica que cada EVT_* esta definido (81 constantes) |
| 2 | `src/types/__tests__/barrel.test.ts` | Crear test que importa desde el barrel y verifica que tipos clave son accesibles (Business, UserProfile, Rating, etc.) |
| 3 | `src/components/home/__tests__/homeSections.test.ts` | Crear test que verifica: IDs unicos en HOME_SECTIONS, cada entrada tiene component definido |

### Fase 6: Verificacion final

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | `npx tsc --noEmit` — zero errors |
| 2 | N/A | `npm run build` — build exitoso |
| 3 | N/A | `npx vitest run --dir src` — tests pasan |
| 4 | N/A | `npx eslint --fix src/constants/analyticsEvents/ src/types/ src/components/home/HomeScreen.tsx src/components/home/homeSections.ts` |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar patron "Analytics event names" para reflejar que ahora es un directorio con archivos por dominio. Actualizar patron "Sin circular deps" para mencionar la nueva estructura de types/ |
| 2 | `docs/reference/architecture.md` | Actualizar seccion "Tab: Inicio (HomeScreen)" para reflejar que usa HOME_SECTIONS declarativo |

---

## Orden de implementacion

1. **Fase 1** (analyticsEvents split) — sin dependencias, se puede hacer primero
2. **Fase 2** (types split) — sin dependencias con Fase 1, se puede hacer en paralelo
3. **Fase 3** (HomeScreen refactor) — sin dependencias con Fases 1-2
4. **Fase 4** (documentacion worktree) — sin dependencias de codigo
5. **Fase 5** (tests) — depende de Fases 1-3 completadas
6. **Fase 6** (verificacion) — depende de todo lo anterior
7. **Fase final** (docs) — depende de Fases 1-4

Las Fases 1, 2, 3 y 4 son independientes entre si y podrian ejecutarse en paralelo.

---

## Estimacion de tamano de archivos

| Archivo | Lineas estimadas | Estado |
|---------|-----------------|--------|
| `src/constants/analyticsEvents/index.ts` | ~11 | Ideal |
| `src/constants/analyticsEvents/onboarding.ts` | ~12 | Ideal |
| `src/constants/analyticsEvents/trending.ts` | ~8 | Ideal |
| `src/constants/analyticsEvents/offline.ts` | ~6 | Ideal |
| `src/constants/analyticsEvents/social.ts` | ~9 | Ideal |
| `src/constants/analyticsEvents/navigation.ts` | ~5 | Ideal |
| `src/constants/analyticsEvents/system.ts` | ~5 | Ideal |
| `src/constants/analyticsEvents/business.ts` | ~10 | Ideal |
| `src/constants/analyticsEvents/digest.ts` | ~6 | Ideal |
| `src/constants/analyticsEvents/interests.ts` | ~8 | Ideal |
| `src/types/business.ts` | ~95 | Ideal |
| `src/types/user.ts` | ~55 | Ideal |
| `src/types/social.ts` | ~40 | Ideal |
| `src/types/lists.ts` | ~25 | Ideal |
| `src/types/feedback.ts` | ~25 | Ideal |
| `src/types/notifications.ts` | ~25 | Ideal |
| `src/types/rankings.ts` | ~20 | Ideal |
| `src/types/navigation.ts` | ~10 | Ideal |
| `src/types/discovery.ts` | ~35 | Ideal |
| `src/types/index.ts` (nuevo) | ~25 | Ideal |
| `src/components/home/homeSections.ts` | ~35 | Ideal |
| `src/components/home/HomeScreen.tsx` (modificado) | ~30 | Ideal |

Ningun archivo supera 200 lineas. El archivo mas grande (`types/business.ts`, ~95 lineas) esta bien dentro del limite.

---

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Algun consumidor de types usa un import path no-barrel (ej: `from '../types/index'` directo) | Baja | Buscar con grep `from.*types/index` antes de eliminar. El barrel sigue existiendo |
| Lazy loading de secciones del Home causa flash visible | Media | Cada Suspense tiene fallback null (las secciones son ligeras). Si hay flash, se puede revertir a imports estaticos en el array |
| Dependencia cruzada en types (discovery -> business) causa circular import | Baja | `import type` no genera circular deps en runtime. TypeScript maneja bien los type-only imports |

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`constants/analyticsEvents/`, `types/`, `components/home/`)
- [x] Logica de negocio en hooks/services, no en componentes (HomeScreen se simplifica)
- [x] No se toca ningun archivo con deuda tecnica conocida (no hay issues abiertos)
- [x] Ningun archivo resultante supera 400 lineas (maximo estimado: 95 lineas)

---

## Criterios de done

- [x] S1: analyticsEvents splitado en 9 archivos + barrel
- [x] S2: types/index.ts splitado en 9 archivos nuevos + barrel
- [x] S3: HomeScreen usa HOME_SECTIONS declarativo
- [x] S4: Regla de no-append documentada en worktree workflow
- [x] `tsc --noEmit` pasa sin errores
- [x] `npm run build` exitoso
- [x] Tests de barrel pasan (analyticsEvents, types, homeSections)
- [x] Tests existentes pasan con >= 80% coverage
- [x] No lint errors
- [x] Reference docs actualizados (patterns.md, architecture.md)
