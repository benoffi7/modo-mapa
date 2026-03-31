# Specs: Splitear barrel files por dominio para reducir conflictos en paralelo

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No aplica. Este feature es un refactor de estructura de archivos fuente. No modifica colecciones, documentos ni tipos de Firestore.

## Firestore Rules

No aplica. No se modifican reglas ni se agregan queries.

### Rules impact analysis

No hay queries nuevas. Ninguna regla necesita cambios.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | No |

### Field whitelist check

No se agregan ni modifican campos en ninguna coleccion.

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | No |

## Cloud Functions

No aplica. No se crean ni modifican Cloud Functions.

## Componentes

### HomeScreen.tsx (modificado)

Se simplifica de 8 imports estaticos + JSX inline a un iterador sobre `HOME_SECTIONS`. Mantiene `useRatingPrompt` y `RatingPromptBanner` como caso especial fuera del array (depende de un hook condicional).

**Props:** ninguna (componente raiz de tab).

**Cambios clave:**

- Eliminar los 8 imports directos de secciones (`GreetingHeader`, `QuickActions`, etc.)
- Importar `HOME_SECTIONS` de `./homeSections`
- Iterar con `Suspense` + fallback por seccion
- Mantener `RatingPromptBanner` fuera del array (condicional con hook)

**Lineas estimadas:** ~30 (reduccion de 40 a ~30)

### homeSections.ts (nuevo)

Archivo declarativo que define el array `HOME_SECTIONS` y la interfaz `HomeSection`.

```typescript
import { lazy, type ComponentType } from 'react';

export interface HomeSection {
  id: string;
  component: ComponentType;
  hasDividerAfter?: boolean;
}

const GreetingHeader = lazy(() => import('./GreetingHeader'));
const QuickActions = lazy(() => import('./QuickActions'));
const SpecialsSection = lazy(() => import('./SpecialsSection'));
const TrendingNearYouSection = lazy(() => import('./TrendingNearYouSection'));
const YourInterestsSection = lazy(() => import('./YourInterestsSection'));
const RecentSearches = lazy(() => import('./RecentSearches'));
const ForYouSection = lazy(() => import('./ForYouSection'));
const ActivityDigestSection = lazy(() => import('./ActivityDigestSection'));

export const HOME_SECTIONS: HomeSection[] = [
  { id: 'greeting', component: GreetingHeader },
  { id: 'quick-actions', component: QuickActions, hasDividerAfter: true },
  { id: 'specials', component: SpecialsSection, hasDividerAfter: true },
  { id: 'trending-near', component: TrendingNearYouSection, hasDividerAfter: true },
  { id: 'interests', component: YourInterestsSection, hasDividerAfter: true },
  { id: 'recent-searches', component: RecentSearches },
  { id: 'for-you', component: ForYouSection, hasDividerAfter: true },
  { id: 'digest', component: ActivityDigestSection },
];
```

**Lineas estimadas:** ~35

**Nota sobre lazy + default exports:** Cada componente de seccion (GreetingHeader, QuickActions, etc.) debe tener un `export default`. Verificar que cada uno ya lo tiene. Si alguno usa named export, agregar `export default` al archivo.

### Mutable prop audit

No aplica. No hay componentes que reciban datos editables como props.

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| N/A | N/A | N/A | N/A | N/A |

## Textos de usuario

No hay textos nuevos visibles al usuario. Este es un refactor de estructura interna.

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| N/A | N/A | N/A |

## Hooks

No se crean ni modifican hooks.

## Servicios

No se crean ni modifican servicios.

## Estructura de archivos: analyticsEvents split

### Archivos nuevos en `src/constants/analyticsEvents/`

Convertir `src/constants/analyticsEvents.ts` (archivo plano, 81 lineas) en un directorio con archivos por dominio:

| Archivo | Constantes que contiene | Lineas est. |
|---------|------------------------|-------------|
| `onboarding.ts` | `EVT_ONBOARDING_BANNER_SHOWN`, `EVT_ONBOARDING_BANNER_CLICKED`, `EVT_ONBOARDING_BANNER_DISMISSED`, `EVT_BENEFITS_SCREEN_SHOWN`, `EVT_BENEFITS_SCREEN_CONTINUE`, `EVT_ACTIVITY_REMINDER_SHOWN`, `EVT_ACTIVITY_REMINDER_CLICKED`, `EVT_VERIFICATION_NUDGE_SHOWN`, `EVT_VERIFICATION_NUDGE_RESEND`, `EVT_VERIFICATION_NUDGE_DISMISSED` | ~12 |
| `trending.ts` | `EVT_TRENDING_VIEWED`, `EVT_TRENDING_BUSINESS_CLICKED`, `EVT_TRENDING_NEAR_VIEWED`, `EVT_TRENDING_NEAR_TAPPED`, `EVT_TRENDING_NEAR_CONFIGURE_TAPPED`, `EVT_RANKINGS_ZONE_FILTER` | ~8 |
| `offline.ts` | `EVT_OFFLINE_ACTION_QUEUED`, `EVT_OFFLINE_SYNC_COMPLETED`, `EVT_OFFLINE_SYNC_FAILED`, `EVT_OFFLINE_ACTION_DISCARDED` | ~6 |
| `social.ts` | `EVT_FOLLOW`, `EVT_UNFOLLOW`, `EVT_FEED_VIEWED`, `EVT_FEED_ITEM_CLICKED`, `EVT_RECOMMENDATION_SENT`, `EVT_RECOMMENDATION_OPENED`, `EVT_RECOMMENDATION_LIST_VIEWED` | ~9 |
| `navigation.ts` | `EVT_TAB_SWITCHED`, `EVT_SUB_TAB_SWITCHED`, `EVT_BUSINESS_SHEET_TAB_CHANGED` | ~5 |
| `system.ts` | `EVT_FORCE_UPDATE_TRIGGERED`, `EVT_FORCE_UPDATE_LIMIT_REACHED`, `EVT_ACCOUNT_DELETED` | ~5 |
| `business.ts` | `EVT_RATING_PROMPT_SHOWN`, `EVT_RATING_PROMPT_CLICKED`, `EVT_RATING_PROMPT_DISMISSED`, `EVT_RATING_PROMPT_CONVERTED`, `EVT_BUSINESS_SHEET_PHASE1_MS`, `EVT_BUSINESS_SHEET_PHASE2_MS`, `EVT_BUSINESS_SHEET_CACHE_HIT`, `EVT_LIST_ICON_CHANGED` | ~10 |
| `digest.ts` | `EVT_DIGEST_SECTION_VIEWED`, `EVT_DIGEST_ITEM_TAPPED`, `EVT_DIGEST_CTA_TAPPED`, `EVT_DIGEST_FREQUENCY_CHANGED` | ~6 |
| `interests.ts` | `EVT_TAG_FOLLOWED`, `EVT_TAG_UNFOLLOWED`, `EVT_INTERESTS_SECTION_VIEWED`, `EVT_INTERESTS_BUSINESS_TAPPED`, `EVT_INTERESTS_CTA_TAPPED`, `EVT_INTERESTS_SUGGESTED_TAPPED` | ~8 |
| `index.ts` | Barrel re-export: `export * from './onboarding'`; etc. (9 lineas) | ~11 |

**Path de import sin cambios:** Los 26 consumidores importan de `../../constants/analyticsEvents` (o variantes de profundidad). El barrel `index.ts` dentro del directorio resuelve el mismo path, por lo que ningun consumidor necesita cambiar.

**Actualizacion de `constants/index.ts`:** Actualmente no re-exporta `analyticsEvents` (no hay `export * from './analyticsEvents'` en el barrel general). Los consumidores importan directo de `constants/analyticsEvents`. Sin cambios necesarios en `constants/index.ts`.

## Estructura de archivos: types split

### Archivos nuevos en `src/types/`

Splitear `src/types/index.ts` (373 lineas) en archivos por dominio. Los archivos existentes (`offline.ts`, `admin.ts`, `metrics.ts`, `perfMetrics.ts`) no se modifican.

| Archivo | Tipos que contiene | Lineas est. |
|---------|-------------------|-------------|
| `business.ts` | `Business`, `BusinessCategory`, `RatingCriteria`, `RatingCriterionId`, `Rating`, `Comment`, `CommentLike`, `UserTag`, `CustomTag`, `PriceLevel`, `MenuPhoto`, `MenuPhotoStatus`, `TrendingBusiness`, `TrendingBusinessBreakdown`, `TrendingData` | ~95 |
| `user.ts` | `UserProfile`, `UserSettings`, `DigestFrequency`, `CheckIn`, `VerificationBadge`, `VerificationBadgeId` | ~55 |
| `social.ts` | `Follow`, `ActivityType`, `ActivityFeedItem`, `Recommendation`, `Favorite` | ~40 |
| `lists.ts` | `SharedList`, `ListItem` | ~25 |
| `feedback.ts` | `Feedback`, `FeedbackCategory`, `FeedbackStatus` | ~25 |
| `notifications.ts` | `AppNotification`, `NotificationType`, `DigestGroup` | ~25 |
| `rankings.ts` | `UserRankingEntry`, `UserRanking` | ~20 |
| `navigation.ts` | `TabId`, `ALL_TAB_IDS`, `SocialSubTab`, `ListsSubTab`, `SearchViewMode`, `LocationSource` | ~10 |
| `discovery.ts` | `LocalTrendingResult`, `SuggestedBusiness`, `SuggestionReason`, `InterestFeedItem`, `InterestFeedGroup`, `PredefinedTagId` | ~35 |

**Nota sobre `PredefinedTagId`:** Actualmente definido en `index.ts` con `import { PREDEFINED_TAGS } from '../constants/tags'`. Se mueve a `discovery.ts` manteniendo el mismo import.

**Nota sobre `TabId` y `ALL_TAB_IDS`:** Son un `type` y un `const` respectivamente. Ambos van a `navigation.ts`. El barrel re-exporta todo.

### Barrel `index.ts` despues del split

```typescript
// Domain types (new files)
export * from './business';
export * from './user';
export * from './social';
export * from './lists';
export * from './feedback';
export * from './notifications';
export * from './rankings';
export * from './navigation';
export * from './discovery';

// Existing domain files (unchanged)
export type {
  OfflineAction,
  OfflineActionType,
  OfflineActionStatus,
  OfflineActionPayload,
  RatingUpsertPayload,
  RatingDeletePayload,
  CommentCreatePayload,
  FavoriteTogglePayload,
  PriceLevelUpsertPayload,
  PriceLevelDeletePayload,
  TagTogglePayload,
  CommentLikePayload,
  FollowPayload,
  RecommendationPayload,
  EmptyPayload,
} from './offline';

export type { Special, AchievementCondition, Achievement } from './admin';
```

**Lineas estimadas del barrel:** ~25 (reduccion de 373 a ~25)

**Dependencias cruzadas entre archivos nuevos:**

- `discovery.ts` importa `Business` de `./business` (para `SuggestedBusiness`, `InterestFeedItem`)
- `discovery.ts` importa `TrendingBusiness` de `./business` (para `LocalTrendingResult`)
- `notifications.ts` importa `AppNotification` para `DigestGroup` (definido en el mismo archivo, sin dep cruzada)
- `user.ts` NO depende de otros archivos nuevos
- `social.ts` NO depende de otros archivos nuevos
- `business.ts` NO depende de otros archivos nuevos

## Integracion

### Archivos existentes que se modifican

| Archivo | Cambio |
|---------|--------|
| `src/constants/analyticsEvents.ts` | Se elimina (reemplazado por directorio `analyticsEvents/`) |
| `src/types/index.ts` | Se reduce a barrel de re-exports (~25 lineas) |
| `src/components/home/HomeScreen.tsx` | Se simplifica a iterador sobre `HOME_SECTIONS` |
| `docs/procedures/worktree-workflow.md` | Se agrega seccion "Regla de no-append" |

### Archivos que NO se modifican

- Los 26 consumidores de `analyticsEvents` (import path no cambia)
- Los 139 consumidores de `types` (import path no cambia)
- `src/constants/index.ts` (no re-exporta analyticsEvents)
- `src/types/offline.ts`, `admin.ts`, `metrics.ts`, `perfMetrics.ts` (sin cambios)

### Preventive checklist

- [x] **Service layer**: Ningun componente importa `firebase/firestore` para writes en este refactor
- [x] **Duplicated constants**: No se duplican constantes; se redistribuyen
- [x] **Context-first data**: No aplica (no hay data fetching)
- [x] **Silent .catch**: No aplica (no hay logica async)
- [x] **Stale props**: No aplica (no hay props mutables)

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Que todos los EVT_* del archivo original siguen siendo exportados desde el barrel | Re-export verification |
| `src/types/__tests__/barrel.test.ts` | Que todos los tipos/constantes exportados siguen accesibles via barrel | Re-export verification |
| `src/components/home/__tests__/homeSections.test.ts` | Que `HOME_SECTIONS` tiene IDs unicos y componentes definidos | Config validation |

### Estrategia de test para re-exports

Los tests de barrel verifican que el contrato publico no se rompe. Importan desde el barrel y verifican que cada export existe:

```typescript
// analyticsEvents barrel test
import * as events from '../index';

it('exporta todos los eventos de onboarding', () => {
  expect(events.EVT_ONBOARDING_BANNER_SHOWN).toBeDefined();
  // ... etc
});
```

### Test adicional implicito

- `tsc --noEmit` debe pasar sin errores (verifica que los 139+ consumidores de types y 26 de analyticsEvents compilan correctamente)
- `npm run build` debe producir bundle sin errores

## Analytics

No se agregan eventos nuevos. Los eventos existentes se redistribuyen en archivos sin cambio de nombre ni comportamiento.

---

## Offline

No aplica. Este feature es un refactor de estructura de archivos sin operaciones de datos en runtime.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

No aplica.

---

## Decisiones tecnicas

### 1. Barrel re-export vs imports directos

**Decision:** Mantener barrel re-export. Los consumidores siguen importando de `types/` y `constants/analyticsEvents`.

**Alternativa rechazada:** Migrar todos los consumidores a imports directos (`from '../types/business'`). Requiere cambiar 139+ archivos y no aporta beneficio funcional (tree-shaking ya funciona con el barrel).

### 2. Lazy components en homeSections vs imports estaticos

**Decision:** Usar `lazy()` con `Suspense` individual por seccion.

**Alternativa rechazada:** Imports estaticos en el array. No aprovecha code-splitting y aumenta el bundle inicial del Home tab.

**Riesgo:** Los componentes de seccion deben tener `export default`. Verificar antes de implementar.

### 3. RatingPromptBanner fuera del array

**Decision:** Mantener como caso especial fuera del iterador.

**Razon:** Depende del hook `useRatingPrompt()` que es condicional y no se ajusta al patron declarativo del array. Meterlo en el array requeriria un wrapper component innecesario.

### 4. `InterestFeedItem.business` como dependencia cruzada

**Decision:** `discovery.ts` importa `Business` de `./business` con `import type`.

**Alternativa rechazada:** Duplicar la interfaz Business en discovery.ts. Viola DRY.

---

## Hardening de seguridad

No aplica. Este feature no introduce superficies nuevas de escritura, lectura ni endpoints.

### Firestore rules requeridas

Ninguna.

### Rate limiting

No aplica.

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| N/A | N/A | N/A |

### Vectores de ataque mitigados

No aplica. Sin superficies nuevas.

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A | N/A | N/A |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de seguridad ni tech debt en el backlog.

El split en si mismo reduce deuda tecnica existente:

| Aspecto | Mejora |
|---------|--------|
| `types/index.ts` (373 lineas) | Se reduce a ~25 lineas; los tipos se organizan por dominio |
| `analyticsEvents.ts` (81 lineas, append-only) | Se organiza en 9 archivos por dominio, eliminando conflictos de merge |
| `HomeScreen.tsx` (40 lineas, imports rigidos) | Se simplifica a iterador declarativo; nuevas secciones no modifican el JSX |
