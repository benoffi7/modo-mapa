# PRD: Splitear barrel files por dominio para reducir conflictos en paralelo

**Feature:** 248-parallel-barrel-split
**Categoria:** infra
**Fecha:** 2026-03-30
**Issue:** #248
**Prioridad:** Alta

---

## Contexto

En v2.34.0, el proyecto ejecuta 4+ agentes en worktrees paralelos para implementar features simultaneas. Tres archivos son puntos de conflicto sistematicos: `analyticsEvents.ts` (81 lineas, 26 consumidores), `types/index.ts` (373 lineas, 139 consumidores) y `HomeScreen.tsx` (40 lineas, 8 secciones). Cada feature nueva appenda constantes, tipos o secciones al final de estos archivos, generando conflictos de merge predecibles. En v2.34.0 hubo 3 conflictos por este patron exacto.

## Problema

- Cada feature paralela agrega sus constantes de analytics al final de `analyticsEvents.ts`, produciendo conflictos en la misma zona del archivo
- Cada feature paralela agrega interfaces/tipos al final de `types/index.ts` (373 lineas, archivo mas grande de tipos), produciendo conflictos identicos
- Cada feature paralela que agrega una seccion al Home modifica el mismo JSX de `HomeScreen.tsx`, conflictuando en imports y en el return
- El pattern actual de "appendear al barrel" es incompatible con trabajo paralelo y escala linealmente peor con mas agentes

## Solucion

### S1. Splitear `analyticsEvents.ts` en archivos por dominio

Convertir el archivo plano en un directorio con archivos por dominio. Cada archivo agrupa eventos relacionados por feature/area:

```
src/constants/analyticsEvents/
  index.ts          -- barrel re-export: export * from './onboarding'; etc.
  onboarding.ts     -- EVT_ONBOARDING_*, EVT_BENEFITS_*, EVT_ACTIVITY_REMINDER_*, EVT_VERIFICATION_NUDGE_*
  trending.ts       -- EVT_TRENDING_*, EVT_TRENDING_NEAR_*, EVT_RANKINGS_ZONE_*
  offline.ts        -- EVT_OFFLINE_*
  social.ts         -- EVT_FOLLOW, EVT_UNFOLLOW, EVT_FEED_*, EVT_RECOMMENDATION_*
  navigation.ts     -- EVT_TAB_SWITCHED, EVT_SUB_TAB_SWITCHED, EVT_BUSINESS_SHEET_TAB_CHANGED
  system.ts         -- EVT_FORCE_UPDATE_*, EVT_ACCOUNT_DELETED
  business.ts       -- EVT_RATING_PROMPT_*, EVT_BUSINESS_SHEET_PHASE*_MS, EVT_BUSINESS_SHEET_CACHE_HIT, EVT_LIST_ICON_CHANGED
  digest.ts         -- EVT_DIGEST_*
  interests.ts      -- EVT_TAG_FOLLOWED, EVT_TAG_UNFOLLOWED, EVT_INTERESTS_*
```

El barrel `index.ts` re-exporta todo, por lo que los 26 consumidores existentes no necesitan cambiar sus imports (`from '../../constants/analyticsEvents'` sigue funcionando). Alineado con el patron existente de `constants/index.ts` que ya re-exporta 20 modulos por dominio.

Beneficio: una feature nueva crea `analyticsEvents/newDomain.ts` y agrega UNA linea al barrel. Dos features en paralelo tocan lineas distintas del barrel (append en distintas posiciones), o ni siquiera tocan el barrel si su dominio ya existe.

### S2. Splitear `types/index.ts` en archivos por dominio

Mover las interfaces a archivos por dominio, manteniendo el barrel:

```
src/types/
  index.ts          -- barrel re-export + TabId/ALL_TAB_IDS (inline por ser constantes)
  business.ts       -- Business, BusinessCategory, Rating, RatingCriteria, RatingCriterionId, Comment, CommentLike, UserTag, CustomTag, PriceLevel, MenuPhoto, MenuPhotoStatus, TrendingBusiness, TrendingBusinessBreakdown, TrendingData
  user.ts           -- UserProfile, UserSettings, DigestFrequency, CheckIn, VerificationBadge, VerificationBadgeId
  social.ts         -- Follow, ActivityType, ActivityFeedItem, Recommendation, Favorite
  lists.ts          -- SharedList, ListItem
  feedback.ts       -- Feedback, FeedbackCategory, FeedbackStatus
  notifications.ts  -- AppNotification, NotificationType, DigestGroup
  rankings.ts       -- UserRankingEntry, UserRanking
  navigation.ts     -- TabId, ALL_TAB_IDS, SocialSubTab, ListsSubTab, SearchViewMode, LocationSource
  discovery.ts      -- LocalTrendingResult, SuggestedBusiness, SuggestionReason, InterestFeedItem, InterestFeedGroup, PredefinedTagId
  offline.ts        -- (ya existe, sin cambios)
  admin.ts          -- (ya existe, sin cambios)
  metrics.ts        -- (ya existe, sin cambios)
  perfMetrics.ts    -- (ya existe, sin cambios)
```

El barrel `index.ts` re-exporta todo con `export * from './business'`, etc. Los 139 consumidores existentes no necesitan cambiar sus imports. Los archivos existentes (`offline.ts`, `admin.ts`, `metrics.ts`, `perfMetrics.ts`) no se modifican.

Nota: `types/index.ts` actualmente tiene un `import { PREDEFINED_TAGS } from '../constants/tags'` para derivar `PredefinedTagId`. Este tipo se mueve a `types/discovery.ts` manteniendo el import.

### S3. Registro declarativo de secciones en HomeScreen

Extraer la lista de secciones a un array registrable para que cada feature pueda agregar su seccion sin modificar el JSX del HomeScreen:

```typescript
// src/components/home/homeSections.ts
import { lazy, type ComponentType } from 'react';

export interface HomeSection {
  id: string;
  component: ComponentType;
  hasDividerAfter?: boolean;
}

// Cada seccion como lazy component
const GreetingHeader = lazy(() => import('./GreetingHeader'));
const QuickActions = lazy(() => import('./QuickActions'));
// ...

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

`HomeScreen.tsx` itera sobre el array con `Suspense` boundaries individuales. El `RatingPromptBanner` se maneja como caso especial (condicional, con hook) fuera del array.

Beneficio: una feature nueva agrega su seccion al array en `homeSections.ts` (una linea), no modifica `HomeScreen.tsx`. Dos features en paralelo agregan lineas en posiciones distintas del array.

Nota: este approach es mas moderado que un registry pattern con `registerSection()` dinamico. Mantiene el control explicito del orden y es mas facil de razonar.

### S4. Guia para prompts de agentes paralelos

Documentar en el worktree workflow (`docs/procedures/worktree-workflow.md`) una regla explicita:

> **Regla de no-append:** Al implementar una feature en worktree paralelo, NUNCA appendear a archivos barrel compartidos. En su lugar:
> 1. Crear un archivo nuevo en el directorio del dominio (`analyticsEvents/myDomain.ts`, `types/myDomain.ts`)
> 2. Agregar la linea de re-export al barrel correspondiente
> 3. Para HomeScreen, agregar la entrada al array `HOME_SECTIONS`
>
> El merge skill detecta si multiples branches modificaron el mismo barrel y resuelve automaticamente (cada branch agrego una linea de re-export distinta).

Esta guia se incorpora tambien al prompt template de agentes de implementacion.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Split analyticsEvents.ts en 9 archivos + barrel | Must | S |
| S2: Split types/index.ts en 8 archivos nuevos + barrel | Must | M |
| S3: Extraer HOME_SECTIONS array + refactor HomeScreen | Must | S |
| S4: Documentar regla no-append en worktree workflow | Must | S |
| Verificar que los 26 consumidores de analyticsEvents siguen compilando | Must | S |
| Verificar que los 139 consumidores de types siguen compilando | Must | S |
| Actualizar constants/index.ts si analyticsEvents cambia de path | Must | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Splitear otros barrels (ej: `constants/index.ts` ya esta bien organizado con 20 modulos)
- Refactorizar consumidores para importar desde archivos especificos (ej: `from '../types/business'`) — el barrel sigue siendo el punto de import
- Crear un sistema de plugins/registry dinamico para HomeScreen (lazy registration, etc.)
- Automatizar deteccion de conflictos en CI (merge skill ya lo maneja)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/constants/analyticsEvents/index.ts` | Re-export barrel | Que todos los EVT_* exportados en el barrel original siguen accesibles |
| `src/types/index.ts` | Re-export barrel | Que todos los tipos exportados siguen accesibles via barrel |
| `src/components/home/homeSections.ts` | Config array | Que HOME_SECTIONS tiene IDs unicos, componentes definidos |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Test de compilacion: `tsc --noEmit` pasa sin errores (verifica que los 139+ consumidores de types compilan)
- Test de re-export: cada constante EVT_* sigue siendo importable desde el barrel
- Test de unicidad: HOME_SECTIONS no tiene IDs duplicados
- No se requieren tests unitarios para los archivos de tipos puros ni constantes sin logica (excepcion documentada en tests.md)

---

## Seguridad

Este feature es puramente un refactor de estructura de archivos. No introduce nuevas superficies de ataque, no modifica datos, no agrega endpoints ni escrituras a Firestore.

- [ ] No se exponen datos sensibles en los nuevos archivos
- [ ] No se introducen imports de Firebase SDK en archivos que no lo tenian

### Vectores de ataque automatizado

No aplica. Este feature no expone nuevas superficies.

---

## Deuda tecnica y seguridad

No hay issues abiertos de seguridad ni tech debt en el backlog (solo #168, bloqueado por deps upstream y no relacionado).

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #168 (Vite 8 + ESLint 10) | No relacionado | Sin impacto |

### Mitigacion incorporada

- El split de `types/index.ts` reduce el tamano del archivo mas grande de tipos de 373 a ~30 lineas (solo re-exports), mejorando la navegabilidad
- El patron de `analyticsEvents/` por dominio alinea con el patron existente de `constants/` (20 modulos por dominio con barrel)
- La guia de no-append previene recurrencia del problema en futuras features

---

## Offline

### Data flows

No aplica. Este feature es un refactor de estructura de archivos sin operaciones de datos en runtime.

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] No hay data flows nuevos — sin impacto offline

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) — HomeScreen se simplifica a un iterador
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout — homeSections.ts es declarativo
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (analyticsEvents/, types/, home/)
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | HomeScreen pasa de 8 imports estaticos a 1 import del array, reduce acoplamiento |
| Estado global | = | Sin cambios en estado global |
| Firebase coupling | = | Sin cambios en imports de Firebase |
| Organizacion por dominio | - | types/ y analyticsEvents/ pasan de monolito a organizacion por dominio |

**Nota:** `-` significa reduce acoplamiento/mejora organizacion.

---

## Success Criteria

1. `tsc --noEmit` pasa sin errores despues del refactor (los 139+ consumidores de types y 26 de analyticsEvents compilan)
2. `npm run build` produce un bundle identico (mismos chunks, mismo tamano +/- 1KB) — el split es puramente de archivos fuente
3. Dos branches paralelas que agregan tipos/eventos/secciones nuevas no producen conflictos de merge en los archivos barrel (verificable con merge de prueba)
4. La guia de no-append esta documentada en worktree workflow y es referenciable desde prompts de agentes
5. Ningun consumidor existente cambia su linea de import (el barrel re-exporta todo)
