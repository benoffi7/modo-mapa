# Specs: Admin GA4 behavioral analytics dashboard

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-30

---

## Modelo de datos

No hay cambios en Firestore. Este feature solo reorganiza y extiende la UI del admin panel para consumir datos que ya llegan del `analyticsReport` callable.

El `GA4_EVENT_NAMES` array en `functions/src/admin/analyticsReport.ts` necesita actualizarse para incluir los ~40 event names nuevos que se van a visualizar. Sin este cambio, el callable no los retorna.

### Tipo nuevo: `GA4FeatureCategory`

```typescript
// src/components/admin/features/ga4FeatureDefinitions.ts (inline, no en types/)
interface GA4FeatureDef {
  key: string;
  name: string;
  icon: ReactElement;
  eventNames: string[];
  color: string;
}

interface GA4FeatureCategory {
  id: string;
  label: string;
  features: GA4FeatureDef[];
}
```

Las interfaces `GA4FeatureDef` y `GA4FeatureCategory` son locales al archivo de definiciones porque solo las consume el admin panel. No se agregan a `src/types/admin.ts` para evitar acoplar tipos de UI con tipos de datos.

## Firestore Rules

No aplica. No hay colecciones nuevas ni queries modificadas.

### Rules impact analysis

No hay queries nuevas. El callable `analyticsReport` ya existe y esta protegido.

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `fetchAnalyticsReport()` | N/A (callable) | Admin only | App Check + `assertAdmin` | No |
| `fetchCounters()` | `config/counters` | Admin only | `allow read: if isAdmin()` | No |
| `fetchDailyMetrics()` | `dailyMetrics` | Admin only | `allow read: if request.auth != null` | No |

### Field whitelist check

No hay campos nuevos ni modificados en Firestore.

## Cloud Functions

### Modificacion: `getAnalyticsReport` (`functions/src/admin/analyticsReport.ts`)

El array `GA4_EVENT_NAMES` necesita expandirse para incluir todos los event names que las nuevas categorias requieren. Actualmente tiene 10 entries; se expandira a ~45.

Eventos a agregar:

**Onboarding (10):** `onboarding_banner_shown`, `onboarding_banner_clicked`, `onboarding_banner_dismissed`, `benefits_screen_shown`, `benefits_screen_continue`, `activity_reminder_shown`, `activity_reminder_clicked`, `verification_nudge_shown`, `verification_nudge_resend`, `verification_nudge_dismissed`

**Trending (6):** `trending_viewed`, `trending_business_clicked`, `trending_near_viewed`, `trending_near_tapped`, `trending_near_configure_tapped`, `rankings_zone_filter`

**Home engagement (4):** `special_tapped`, `for_you_tapped`, `quick_action_tapped`, `recent_search_tapped`

**Interests (6):** `tag_followed`, `tag_unfollowed`, `interests_section_viewed`, `interests_business_tapped`, `interests_cta_tapped`, `interests_suggested_tapped`

**Digest (4):** `digest_section_viewed`, `digest_item_tapped`, `digest_cta_tapped`, `digest_frequency_changed`

**Offline (4):** `offline_action_queued`, `offline_sync_completed`, `offline_sync_failed`, `offline_action_discarded`

**Business (8):** `business_view` (ya incluido), `business_directions`, `rating_prompt_shown`, `rating_prompt_clicked`, `rating_prompt_dismissed`, `rating_prompt_converted`, `business_sheet_phase1_ms`, `business_sheet_phase2_ms`, `business_sheet_cache_hit`

**Social (7):** `follow`, `unfollow`, `feed_viewed`, `feed_item_clicked`, `recommendation_sent`, `recommendation_opened`, `recommendation_list_viewed`

**System (3):** `force_update_triggered`, `force_update_limit_reached`, `account_deleted`

**Navigation (3):** `tab_switched`, `sub_tab_switched`, `business_sheet_tab_changed`

**Existentes que se mantienen:** `surprise_me`, `list_created`, `list_item_added`, `business_search`, `business_share`, `menu_photo_upload`, `dark_mode_toggle`, `question_created`, `question_answered`, `list_icon_changed`

**A remover del array (no usados en UI):** `side_menu_section`, `business_filter_tag` (eventos legacy de SideMenu que ya no existe en v2)

## Componentes

### GA4FeatureCard.tsx (nuevo)

**Ruta:** `src/components/admin/features/GA4FeatureCard.tsx`
**Props:**

```typescript
interface GA4FeatureCardProps {
  feature: GA4FeatureDef;
  events: GA4EventCount[];
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Comportamiento:** Renderiza una card con border-left de color, icono, nombre, count de hoy (h4), trend icon (hoy vs ayer), texto "hoy (GA4) -- ultimos 30d total", y un Collapse con LineChartCard de 30 dias. Extrae el JSX actual de las lineas 239-275 de FeaturesPanel.

### GA4CategorySection.tsx (nuevo)

**Ruta:** `src/components/admin/features/GA4CategorySection.tsx`
**Props:**

```typescript
interface GA4CategorySectionProps {
  category: GA4FeatureCategory;
  events: GA4EventCount[];
  expandedFeature: string | null;
  onToggleFeature: (key: string) => void;
  defaultExpanded?: boolean | undefined;
}
```

**Comportamiento:** Renderiza un header con Typography h6 + IconButton expand/collapse. El contenido es un Grid container con GA4FeatureCard para cada feature del grupo. Cada seccion se expande/colapsa independientemente con estado local (useState). `defaultExpanded` permite que la primera seccion empiece abierta.

### ga4FeatureDefinitions.ts (nuevo)

**Ruta:** `src/components/admin/features/ga4FeatureDefinitions.ts`

Archivo de configuracion puro (sin JSX, solo datos). Exporta `GA4_FEATURE_CATEGORIES: GA4FeatureCategory[]` con las 10 categorias y ~40 features. Tambien re-exporta las interfaces `GA4FeatureDef` y `GA4FeatureCategory`.

Las 7 features GA4 existentes (surprise, lists, search, share, photos, darkMode, questions) se reubican en una categoria "Otras features" al final para mantener compatibilidad.

Iconos: el archivo importa iconos de MUI y los usa en JSX inline (`<IconName />`). Esto es necesario porque `ReactElement` no se puede serializar como dato puro. Es el mismo patron que ya usa el `FEATURES` array actual en FeaturesPanel.

### FeaturesPanel.tsx (modificacion)

**Ruta:** `src/components/admin/FeaturesPanel.tsx`

Se elimina:
- Interface `GA4FeatureDef` (movida a `ga4FeatureDefinitions.ts`)
- Array `GA4_FEATURES` (reemplazado por `GA4_FEATURE_CATEGORIES`)
- JSX de GA4 feature cards (lineas 227-276, reemplazado por iteracion de `GA4CategorySection`)

Se mantiene:
- `FEATURES` array de Firestore (no se mueve porque solo lo consume este archivo)
- `buildFeatureTrend` helper
- `buildGA4FeatureData` helper (se exporta para testing)
- `TrendIcon` componente (se mueve a `features/TrendIcon.tsx` para compartir)
- Firestore feature cards (no se extraen porque no son parte del scope)
- Seccion de Adoption

### TrendIcon.tsx (nuevo)

**Ruta:** `src/components/admin/features/TrendIcon.tsx`

Componente extraido de FeaturesPanel. Lo usan tanto las Firestore feature cards como las GA4FeatureCard.

```typescript
interface TrendIconProps {
  today: number;
  yesterday: number;
}
```

### Mutable prop audit

No aplica. Todos los componentes son read-only (visualizan datos, no los editan).

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "No se pudieron cargar las metricas de GA4. Los datos de colecciones estan disponibles." | Alert en FeaturesPanel | Ya existe, sin cambios |
| "Toca una card para ver el grafico de los ultimos 30 dias." | Typography en FeaturesPanel | Ya existe, sin cambios |

No se agregan textos nuevos visibles al usuario. Los labels de categorias son internos del admin panel.

## Hooks

No hay hooks nuevos. El feature reutiliza `useAsyncData` existente en FeaturesPanel.

## Servicios

No hay servicios nuevos. `fetchAnalyticsReport()` ya existe en `services/admin/content.ts`.

## Integracion

### FeaturesPanel.tsx

- Importa `GA4_FEATURE_CATEGORIES` de `./features/ga4FeatureDefinitions`
- Importa `GA4CategorySection` de `./features/GA4CategorySection`
- Importa `TrendIcon` de `./features/TrendIcon`
- Exporta `buildGA4FeatureData` (named export para testing)
- Elimina `GA4FeatureDef`, `GA4_FEATURES`, `TrendIcon` locales

### functions/src/admin/analyticsReport.ts

- Expande `GA4_EVENT_NAMES` array con ~35 eventos nuevos
- Remueve `side_menu_section` y `business_filter_tag` (legacy)

### Preventive checklist

- [x] **Service layer**: Ningun componente nuevo importa `firebase/firestore` para writes. GA4FeatureCard y GA4CategorySection reciben datos como props.
- [x] **Duplicated constants**: Los event names en `ga4FeatureDefinitions.ts` son strings que reflejan los que estan en `src/constants/analyticsEvents/`. No se importan las constantes porque las definiciones son para matching con datos de GA4 (string literals del server), no para llamar a `trackEvent`.
- [x] **Context-first data**: No aplica. Los datos vienen del fetcher de `useAsyncData`.
- [x] **Silent .catch**: No aplica. No se agregan llamadas async.
- [x] **Stale props**: No aplica. Todos los componentes son read-only.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/components/admin/features/__tests__/buildGA4FeatureData.test.ts` | Helper `buildGA4FeatureData`: aggregation por multiples eventNames, today/yesterday calc, trend ordering, empty data, date format conversion | Unit |
| `src/components/admin/features/__tests__/ga4FeatureDefinitions.test.ts` | Estructura valida del array: no hay keys duplicados, no hay eventNames duplicados entre features, todos los campos requeridos presentes, categories no vacias | Unit |

### Casos a cubrir

**buildGA4FeatureData:**
- Multiple event names aggregated correctly
- Today count from YYYYMMDD format
- Yesterday count calculation
- Total across all dates
- Trend sorted chronologically
- Empty events array returns zeros
- Events with dates not matching today/yesterday

**ga4FeatureDefinitions:**
- All feature keys unique across all categories
- No duplicate eventNames across features in different categories
- Every feature has at least one eventName
- Every category has at least one feature
- Category IDs unique

### Mock strategy

- `buildGA4FeatureData`: funcion pura, no necesita mocks. Solo fake timers para controlar `new Date()`.
- `ga4FeatureDefinitions`: validation pura sobre el array exportado, sin mocks.

## Analytics

No se agregan eventos nuevos. Solo se visualizan los existentes.

---

## Offline

No aplica para el admin panel. El admin panel requiere conexion para funcionar.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| GA4 analytics report | Server-side cache en `config/analyticsCache` | 1h | Firestore |
| Firestore counters | Persistent cache de Firestore | N/A | IndexedDB |
| Daily metrics | Persistent cache de Firestore | N/A | IndexedDB |

### Writes offline

N/A (feature read-only).

### Fallback UI

Alert warning cuando GA4 falla (ya implementado en FeaturesPanel).

---

## Decisiones tecnicas

### Event names como string literals (no importados de constants/)

**Decision:** Los event names en `ga4FeatureDefinitions.ts` se escriben como string literals en vez de importar las constantes de `src/constants/analyticsEvents/`.

**Razon:** Las constantes de analytics existen para que `trackEvent` use nombres consistentes. Las definiciones del admin son para matching contra datos que retorna la GA4 Data API (que usa los mismos strings). Importar las constantes crearia un acoplamiento entre la UI de admin y los archivos de analytics events sin beneficio real (los strings ya estan validados por la GA4 API). Ademas, algunos eventos como `business_view` y `business_directions` se trackean con string literals en los componentes, asi que no todos tienen constantes.

### Interfaces locales vs en types/admin.ts

**Decision:** `GA4FeatureDef` y `GA4FeatureCategory` son locales a `ga4FeatureDefinitions.ts`.

**Razon:** Solo las consume el admin panel (GA4FeatureCard, GA4CategorySection). No hay consumidores externos. Moverlas a `types/admin.ts` crearia acoplamiento innecesario.

### No extraer Firestore feature cards

**Decision:** Las Firestore feature cards se mantienen inline en FeaturesPanel.

**Razon:** El JSX es identico al de GA4 pero usa datos distintos (counters + dailyMetrics). Extraerlas requeriria una interfaz generica mas compleja. El scope del PRD se enfoca en GA4. FeaturesPanel queda en ~150 lineas post-refactor, bien dentro del limite.

---

## Hardening de seguridad

No hay superficies nuevas. El feature es puramente read-only de datos que ya llegan.

### Firestore rules requeridas

N/A.

### Rate limiting

El `analyticsReport` callable ya tiene rate limit callable 5/min + cache de 1h server-side. No se necesitan cambios.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Llamadas excesivas al callable | Rate limit 5/min + cache 1h (ya existente) | `functions/src/admin/analyticsReport.ts` |
| Acceso no admin | `assertAdmin` + App Check (ya existente) | `functions/src/admin/analyticsReport.ts` |

---

## Deuda tecnica: mitigacion incorporada

No hay issues abiertos de security ni tech debt que apliquen a este feature.

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| FeaturesPanel 313 lineas (near limit) | Reduccion a ~150 lineas via extraccion de componentes | Fase 1, pasos 1-4 |
| Legacy event names `side_menu_section`, `business_filter_tag` | Remover del array GA4_EVENT_NAMES en callable | Fase 2, paso 1 |
