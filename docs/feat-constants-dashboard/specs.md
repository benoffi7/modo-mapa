# Specs Técnicas: Constants Dashboard

## 1. Refactoring — Centralización de constantes

### 1.1 Nueva estructura `src/constants/`

Crear directorio `src/constants/` con archivos organizados por dominio. Cada archivo exporta constantes con nombre y tipo explícito. El barrel `index.ts` re-exporta todo.

```text
src/constants/
├── index.ts              # Barrel: re-export de todos los módulos
├── validation.ts         # Límites de caracteres y valores permitidos
├── cache.ts              # TTLs, intervalos de polling
├── storage.ts            # Keys de localStorage
├── map.ts                # Coordenadas, colores de categoría
├── business.ts           # Price levels, categorías, labels
├── tags.ts               # Tags predefinidos, IDs válidos
├── rankings.ts           # Scoring, medallas, labels de acciones, períodos
├── feedback.ts           # Categorías válidas
├── ui.ts                 # Secciones, URLs, opciones de score, colores de charts
├── admin.ts              # Email admin, free tier, page size, status labels/colors
└── timing.ts             # Duraciones (SIX_MONTHS_MS, AUTO_DISMISS_MS)
```

### 1.2 Detalle por archivo

#### `validation.ts`

```typescript
// Character limits
export const MAX_COMMENT_LENGTH = 500;
export const MAX_DISPLAY_NAME_LENGTH = 30;
export const MAX_CUSTOM_TAG_LENGTH = 30;
export const MAX_FEEDBACK_LENGTH = 1000;

// Display truncation
export const TRUNCATE_COMMENT_PREVIEW = 50;
export const TRUNCATE_DETAIL_PREVIEW = 80;
export const TRUNCATE_USER_ID = 8;

// Quantity limits
export const MAX_CUSTOM_TAGS_PER_BUSINESS = 10;
export const MAX_COMMENTS_PER_DAY = 20;
export const MAX_VISIT_HISTORY = 50;

// Rating
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;
```

**Archivos afectados (re-export o reemplazo de magic numbers):**

| Constante | Archivo original | Línea aprox | Cambio |
|-----------|-----------------|-------------|--------|
| `MAX_COMMENT_LENGTH` (500) | `services/comments.ts` | 25, 45 | Importar desde constants |
| `MAX_COMMENT_LENGTH` (500) | `components/business/BusinessComments.tsx` | 231-232 | Importar desde constants |
| `MAX_DISPLAY_NAME_LENGTH` (30) | `services/comments.ts` | 28 | Importar desde constants |
| `MAX_DISPLAY_NAME_LENGTH` (30) | `context/AuthContext.tsx` | 73 | Importar desde constants |
| `MAX_DISPLAY_NAME_LENGTH` (30) | `components/layout/SideMenu.tsx` | 307 | Importar desde constants |
| `MAX_CUSTOM_TAG_LENGTH` (30) | `services/tags.ts` | 58, 73 | Importar desde constants |
| `MAX_CUSTOM_TAG_LENGTH` (30) | `components/business/BusinessTags.tsx` | 111 | Importar desde constants |
| `MAX_FEEDBACK_LENGTH` (1000) | `services/feedback.ts` | 18 | Importar desde constants |
| `TRUNCATE_COMMENT_PREVIEW` (50) | `components/admin/ActivityFeed.tsx` | 72 | Importar desde constants |
| `TRUNCATE_DETAIL_PREVIEW` (80) | `components/admin/AbuseAlerts.tsx` | 45 | Importar desde constants |
| `TRUNCATE_USER_ID` (8) | Múltiples admin components | Varios | Importar desde constants |
| `MAX_CUSTOM_TAGS_PER_BUSINESS` (10) | `components/business/BusinessTags.tsx` | 34 | Renombrar + re-export |
| `MAX_COMMENTS_PER_DAY` (20) | `components/business/BusinessComments.tsx` | 66 | Importar desde constants |
| `MAX_VISIT_HISTORY` (50) | `hooks/useVisitHistory.ts` | 12 | Renombrar + re-export |
| `SCORE_OPTIONS` | `components/menu/ListFilters.tsx` | 29 | Mover + re-export |

#### `cache.ts`

```typescript
/** Business data cache TTL (useBusinessDataCache) */
export const BUSINESS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/** Paginated query first-page cache TTL (usePaginatedQuery) */
export const QUERY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

/** Profile visibility cache TTL (useProfileVisibility) */
export const PROFILE_CACHE_TTL_MS = 60_000; // 60s
```

**Archivos afectados:**

| Constante | Archivo original | Nombre actual | Cambio |
|-----------|-----------------|---------------|--------|
| `BUSINESS_CACHE_TTL_MS` | `hooks/useBusinessDataCache.ts:15` | `CACHE_TTL` | Renombrar + importar |
| `QUERY_CACHE_TTL_MS` | `hooks/usePaginatedQuery.ts:26` | `CACHE_TTL` | Renombrar + importar |
| `PROFILE_CACHE_TTL_MS` | `hooks/useProfileVisibility.ts:12` | `CACHE_TTL_MS` | Renombrar + importar |

#### `storage.ts`

```typescript
export const STORAGE_KEY_COLOR_MODE = 'modo-mapa-color-mode';
export const STORAGE_KEY_VISITS = 'modo-mapa-visits';
export const STORAGE_KEY_ANALYTICS_CONSENT = 'analytics-consent';
```

**Archivos afectados:**

| Constante | Archivo original | Nombre actual | Cambio |
|-----------|-----------------|---------------|--------|
| `STORAGE_KEY_COLOR_MODE` | `context/ColorModeContext.tsx:20` | `STORAGE_KEY` | Renombrar + importar |
| `STORAGE_KEY_VISITS` | `hooks/useVisitHistory.ts:11` | `STORAGE_KEY` | Renombrar + importar |
| `STORAGE_KEY_ANALYTICS_CONSENT` | `utils/analytics.ts:8` | `LS_KEY` | Renombrar + importar |

#### `map.ts`

```typescript
export const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };

export const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ea4335',
  cafe: '#fbbc04',
  bar: '#4285f4',
  bakery: '#34a853',
  ice_cream: '#ff6d01',
  pizza: '#ab47bc',
  fast_food: '#00897b',
};
```

**Archivos afectados:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `BUENOS_AIRES_CENTER` | `components/map/MapView.tsx:9` | Mover + importar |
| `CATEGORY_COLORS` | `components/map/BusinessMarker.tsx:5-13` | Mover + importar |

#### `business.ts`

```typescript
import type { PriceLevel } from '../types';

export const LEVELS = [1, 2, 3] as const;

export const LEVEL_SYMBOLS: Record<PriceLevel, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
};

export const PRICE_CHIPS = [
  { level: 1 as PriceLevel, label: '$' },
  { level: 2 as PriceLevel, label: '$$' },
  { level: 3 as PriceLevel, label: '$$$' },
];
```

```typescript
export const PRICE_LEVEL_LABELS: Record<number, string> = {
  1: 'Económico',
  2: 'Moderado',
  3: 'Caro',
};
```

> `CATEGORY_LABELS` usa `BusinessCategory` como key type. Se importa como `import type` desde types (sin dependencia circular):

```typescript
import type { BusinessCategory } from '../types';

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  restaurant: 'Restaurante',
  cafe: 'Café',
  bakery: 'Panadería',
  bar: 'Bar',
  fastfood: 'Comida rápida',
  icecream: 'Heladería',
  pizza: 'Pizzería',
};
```

> `types/index.ts` importa y re-exporta `PRICE_LEVEL_LABELS` y `CATEGORY_LABELS` desde constants para backwards compatibility.

**Archivos afectados adicionales:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `PRICE_LEVEL_LABELS` | `types/index.ts:136-140` | Mover a constants/business.ts. types re-exporta |
| `CATEGORY_LABELS` | `types/index.ts:142-150` | Mover a constants/business.ts. types re-exporta |

**Archivos afectados:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `LEVELS` | `components/business/BusinessPriceLevel.tsx:15` | Mover + importar |
| `LEVEL_SYMBOLS` | `components/business/BusinessPriceLevel.tsx:16` | Mover + importar |
| `PRICE_CHIPS` | `components/search/FilterChips.tsx:6-10` | Mover + importar |

#### `tags.ts`

```typescript
export const PREDEFINED_TAGS = [
  { id: 'barato', label: 'Barato', icon: 'AttachMoney' },
  { id: 'apto_celiacos', label: 'Apto celíacos', icon: 'NoFood' },
  { id: 'apto_veganos', label: 'Apto veganos', icon: 'Eco' },
  { id: 'rapido', label: 'Rápido', icon: 'Speed' },
  { id: 'delivery', label: 'Delivery', icon: 'DeliveryDining' },
  { id: 'buena_atencion', label: 'Buena atención', icon: 'ThumbUp' },
] as const;

export const VALID_TAG_IDS = [
  'barato', 'apto_celiacos', 'apto_veganos',
  'rapido', 'delivery', 'buena_atencion',
] as const;
```

> `PredefinedTagId` se mantiene en `src/types/index.ts` pero derivado importando `PREDEFINED_TAGS` desde constants:
> `import { PREDEFINED_TAGS } from '../constants/tags'; export type PredefinedTagId = (typeof PREDEFINED_TAGS)[number]['id'];`
> No hay dependencia circular: `constants/tags.ts` no importa nada de types.

**Archivos afectados:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `PREDEFINED_TAGS` | `types/index.ts:84-91` | Mover a constants/tags.ts. types/index.ts importa y re-exporta |
| `VALID_TAG_IDS` | `services/tags.ts:18` | Mover + importar |

#### `rankings.ts`

```typescript
export const SCORING = {
  comments: 3,
  ratings: 2,
  likes: 1,
  tags: 1,
  favorites: 1,
  photos: 5,
} as const;

export const MEDALS = ['', '🥇', '🥈', '🥉'] as const;

export const ACTION_LABELS: Record<string, string> = {
  comments: 'Comentarios',
  ratings: 'Calificaciones',
  likes: 'Likes',
  tags: 'Tags',
  favorites: 'Favoritos',
  photos: 'Fotos',
};

export const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Esta semana' },
  { value: 'monthly', label: 'Este mes' },
  { value: 'yearly', label: 'Este año' },
] as const;
```

**Archivos afectados:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `SCORING` | `services/rankings.ts:7-14` | Mover + importar |
| `MEDALS` | `components/menu/RankingItem.tsx:6` | Mover + importar |
| `ACTION_LABELS` | `components/menu/UserScoreCard.tsx:7-14` | Mover + importar |
| `PERIOD_OPTIONS` | `components/menu/RankingsView.tsx:13-17` | Mover + importar |

#### `feedback.ts`

```typescript
export const VALID_CATEGORIES = [
  'bug', 'sugerencia', 'datos_usuario', 'datos_comercio', 'otro',
] as const;
```

**Archivos afectados:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `VALID_CATEGORIES` | `services/feedback.ts:10` | Mover + importar |

#### `ui.ts`

```typescript
export const CHART_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#d32f2f',
  '#7b1fa2', '#0097a7', '#455a65', '#c2185b',
];

export const ADD_BUSINESS_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdCclz8fH1OQj-McD_xEsXAwP6umIcNVsudS3ZiYBXqBqoaRg/viewform';
```

> `SECTION_TITLES` se mantiene en `SideMenu.tsx` (es privada al componente, no exportada). No se centraliza.

**Archivos afectados:**

| Constante | Archivo original | Nombre actual | Cambio |
|-----------|-----------------|---------------|--------|
| `CHART_COLORS` | `components/stats/PieChartCard.tsx:6` | `COLORS` | Renombrar + mover |
| `ADD_BUSINESS_URL` | `components/layout/SideMenu.tsx:51-52` | `ADD_BUSINESS_URL` | Mover + importar |

#### `admin.ts`

```typescript
export const ADMIN_EMAIL = 'benoffi11@gmail.com';

export const FREE_TIER_READS = 50_000;
export const FREE_TIER_WRITES = 20_000;

export const ADMIN_PAGE_SIZE = 20;

export const STATUS_CHIP: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'Pendiente', color: 'warning' },
  approved: { label: 'Aprobada', color: 'success' },
  rejected: { label: 'Rechazada', color: 'error' },
};

export const STATUS_LABELS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
] as const;

export const ABUSE_TYPE_LABELS: Record<string, string> = {
  rate_limit: 'Rate limit',
  flagged: 'Contenido flaggeado',
  top_writers: 'Top writers',
};

export const ABUSE_TYPE_COLORS: Record<string, 'warning' | 'error' | 'info'> = {
  rate_limit: 'warning',
  flagged: 'error',
  top_writers: 'info',
};
```

**Archivos afectados:**

| Constante | Archivo original | Nombre actual | Cambio |
|-----------|-----------------|---------------|--------|
| `ADMIN_EMAIL` | `components/admin/AdminGuard.tsx:10` | `ADMIN_EMAIL` | Mover + importar |
| `FREE_TIER_READS` | `components/admin/FirebaseUsage.tsx:14` | `FREE_TIER_READS` | Mover + importar |
| `FREE_TIER_WRITES` | `components/admin/FirebaseUsage.tsx:15` | `FREE_TIER_WRITES` | Mover + importar |
| `ADMIN_PAGE_SIZE` | `components/admin/ActivityFeed.tsx:20` | `PAGE_SIZE` | Renombrar + mover |
| `ADMIN_PAGE_SIZE` | `components/admin/BackupsPanel.tsx:58` | `PAGE_SIZE` | Renombrar + mover |
| `STATUS_CHIP` | `components/admin/PhotoReviewCard.tsx:11-15` | `STATUS_CHIP` | Mover + importar |
| `STATUS_LABELS` | `components/admin/PhotoReviewPanel.tsx:15-20` | `STATUS_LABELS` | Mover + importar |
| `ABUSE_TYPE_LABELS` | `components/admin/AbuseAlerts.tsx:16-20` | `TYPE_LABELS` | Renombrar + mover |
| `ABUSE_TYPE_COLORS` | `components/admin/AbuseAlerts.tsx:10-14` | `TYPE_COLORS` | Renombrar + mover |

#### `timing.ts`

```typescript
/** Notification polling interval */
export const POLL_INTERVAL_MS = 60_000; // 60s

/** Auto-dismiss duration for snackbar messages */
export const AUTO_DISMISS_MS = 5_000; // 5s

/** Threshold for "stale" menu photos */
export const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
```

**Archivos afectados:**

| Constante | Archivo original | Cambio |
|-----------|-----------------|--------|
| `POLL_INTERVAL_MS` | `hooks/useNotifications.ts:11` | Mover + importar |
| `AUTO_DISMISS_MS` | `components/admin/BackupsPanel.tsx:57` | Mover + importar |
| `SIX_MONTHS_MS` | `components/business/MenuPhotoSection.tsx:20` | Mover + importar |

#### `index.ts` (barrel)

```typescript
export * from './validation';
export * from './cache';
export * from './storage';
export * from './map';
export * from './business';
export * from './tags';
export * from './rankings';
export * from './feedback';
export * from './ui';
export * from './admin';
export * from './timing';

// Re-export from existing location (already centralized)
export { COLLECTIONS } from '../config/collections';
```

### 1.3 Estrategia de migración

1. **Crear** `src/constants/` con todos los archivos nuevos.
2. **Actualizar imports** en cada archivo original para importar desde `src/constants/`.
3. **Eliminar** la definición local de la constante en el archivo original.
4. **NO** re-exportar desde archivos originales — se actualiza el import directamente. Esto es más limpio que mantener cadenas de re-exports.
5. **`PREDEFINED_TAGS`** se mueve a `constants/tags.ts`. `types/index.ts` importa desde constants y re-exporta (para backwards compat). `PredefinedTagId` se deriva ahí. Sin dependencia circular.
6. **`PRICE_LEVEL_LABELS`** y **`CATEGORY_LABELS`** se mueven a `constants/business.ts`. `CATEGORY_LABELS` importa `BusinessCategory` como `import type` desde types (sin circular). `types/index.ts` re-exporta ambas.
7. **Excepción**: `COLLECTIONS` se mantiene en `src/config/collections.ts` (ya centralizado). Se re-exporta desde el barrel.
8. **Excepción**: `SECTION_TITLES` se mantiene en `SideMenu.tsx` (privada, no exportada, acoplada al tipo `Section` local).
9. **Excepción**: `DEFAULT_SETTINGS` se mantiene en `services/userSettings.ts` (acoplado al tipo `UserSettings`).
10. **Excepción**: `EMPTY_LIKES`, `EMPTY_NOTIFICATIONS` se mantienen donde están (sentinels de inicialización, no configurables).

---

## 2. Constants Dashboard — Componente

### 2.1 Registry de constantes

Para que el dashboard pueda listar todas las constantes en runtime, se necesita un registry. Se define como un archivo dev-only que importa todos los módulos de `src/constants/` y los expone con metadata.

#### `src/pages/constantsRegistry.ts`

```typescript
import type { ReactNode } from 'react';

export interface ConstantEntry {
  name: string;
  value: unknown;
  type: string;        // 'string' | 'number' | 'object' | 'array'
  module: string;      // Nombre del archivo en src/constants/
  description?: string;
}

export interface ConstantModule {
  name: string;
  description: string;
  icon: ReactNode;     // MUI icon para tab/sección
  entries: ConstantEntry[];
}
```

El registry se construye estáticamente importando cada módulo de constants y mapeando sus exports a `ConstantEntry[]`. Ejemplo:

```typescript
import * as validation from '../constants/validation';
import * as cache from '../constants/cache';
// ...

function buildEntries(mod: Record<string, unknown>, moduleName: string): ConstantEntry[] {
  return Object.entries(mod).map(([name, value]) => ({
    name,
    value,
    type: Array.isArray(value) ? 'array' : typeof value,
    module: moduleName,
  }));
}

export const CONSTANT_MODULES: ConstantModule[] = [
  {
    name: 'validation',
    description: 'Límites de caracteres y valores permitidos',
    icon: /* RuleIcon */,
    entries: buildEntries(validation, 'validation'),
  },
  // ... demás módulos
];
```

**Importante**: Este archivo solo se importa desde `ConstantsDashboard.tsx`, que solo se carga en DEV via lazy + `import.meta.env.DEV`. Tree-shaking lo elimina del bundle de producción.

### 2.2 Ruta y lazy loading

#### Cambios en `App.tsx`

```tsx
// Agregar junto al lazy de ThemePlayground (línea 14)
const ConstantsDashboard = lazy(() => import('./pages/ConstantsDashboard'));

// Agregar dentro del bloque import.meta.env.DEV (línea 34-43)
{import.meta.env.DEV && (
  <>
    <Route path="/dev/theme" element={<Suspense fallback={<AdminFallback />}><ThemePlayground /></Suspense>} />
    <Route path="/dev/constants" element={<Suspense fallback={<AdminFallback />}><ConstantsDashboard /></Suspense>} />
  </>
)}
```

### 2.3 Link en SideMenu

Agregar link "Constants" junto al link "Theme" existente en el footer (línea 245-257 de `SideMenu.tsx`):

```tsx
{import.meta.env.DEV && (
  <>
    {' · '}
    <Typography component="a" href="/dev/theme" variant="caption"
      sx={{ color: 'text.disabled', textDecoration: 'underline', cursor: 'pointer' }}>
      Theme
    </Typography>
    {' · '}
    <Typography component="a" href="/dev/constants" variant="caption"
      sx={{ color: 'text.disabled', textDecoration: 'underline', cursor: 'pointer' }}>
      Constants
    </Typography>
  </>
)}
```

### 2.4 UI del dashboard

#### Layout

Layout single-column, mobile-friendly (mismo patrón que el proyecto):

```text
┌─────────────────────────────────┐
│  ← Back   Constants Dashboard   │  AppBar con link a home
├─────────────────────────────────┤
│  🔍 Search constants...         │  TextField de búsqueda
├─────────────────────────────────┤
│  [validation] [cache] [storage] │  Chips de filtro por módulo
│  [map] [business] [tags] ...    │
├─────────────────────────────────┤
│  ┌─ validation ───────────────┐ │
│  │ MAX_COMMENT_LENGTH    500  │ │  Cada módulo = Paper colapsable
│  │ MAX_DISPLAY_NAME...    30  │ │  Nombre | Valor | Tipo | Actions
│  │ MAX_CUSTOM_TAG_LEN..  30  │ │
│  └────────────────────────────┘ │
│  ┌─ cache ────────────────────┐ │
│  │ BUSINESS_CACHE_TTL  300000 │ │
│  │ QUERY_CACHE_TTL    120000  │ │
│  └────────────────────────────┘ │
│  ...                            │
├─────────────────────────────────┤
│  Total: 52 constantes           │  Footer con stats
│  ⚠ 2 posibles duplicados       │
└─────────────────────────────────┘
```

#### Componentes internos (todos dentro de `ConstantsDashboard.tsx`)

No se crean archivos separados. Todo el dashboard es un único archivo self-contained (igual que ThemePlayground):

1. **Header**: `AppBar` con título + `IconButton` home link
2. **SearchBar**: `TextField` con `onChange` filtro por nombre o valor (debounced)
3. **ModuleChips**: Fila de `Chip` toggle para filtrar por módulo (multi-select)
4. **ConstantCard**: `Paper` colapsable por módulo con `Accordion`
   - Cada fila: nombre (monospace), valor (formateado), tipo badge, botón copiar
   - Objects/arrays: `JSON.stringify(value, null, 2)` en `<pre>` colapsable
5. **DuplicatesBanner**: `Alert` warning si hay valores idénticos entre constantes de diferentes módulos
6. **StatsFooter**: Total de constantes, módulos, duplicados encontrados

#### Funcionalidades detalladas

| Feature | Implementación |
|---------|---------------|
| **Búsqueda** | `useState` + filter sobre `CONSTANT_MODULES[].entries[]` por `name.toLowerCase().includes(query)` o `String(value).includes(query)` |
| **Filtro por módulo** | Set de módulos activos en state. Chip toggle. Default: todos activos |
| **Copiar valor** | `navigator.clipboard.writeText()` del valor + `Snackbar` de confirmación |
| **Copiar import** | Botón que copia `import { NAME } from '../constants/MODULE';` |
| **Detección de duplicados** | Al montar, scan de `entries` buscando `value` idénticos (deep equal para objects) entre diferentes módulos. Mostrar en banner |
| **Valor formateado** | Primitivos inline, objects/arrays en `<pre>` colapsable con syntax highlighting básico (solo colores para keys/strings/numbers via sx) |

#### Runtime overrides (opcional, fase 2)

> **Descartado de la v1**. La edición inline y runtime overrides agregan complejidad significativa (Context provider, HMR state, etc.) sin beneficio claro dado que las constantes se cambian en código. Se puede agregar en el futuro si se demuestra necesidad.

### 2.5 Estilos

Seguir el patrón de ThemePlayground:

- `Box` con `height: '100dvh'`, `overflow: 'auto'`, padding responsivo
- `Paper` con `elevation={0}`, `variant="outlined"` para secciones
- Colores del tema existente (primary `#1a73e8`)
- Typography monospace (`fontFamily: 'monospace'`) para nombres y valores de constantes
- Dark mode compatible (usar `theme.palette` no colores hardcoded)

---

## 3. Refactoring de documentación

### 3.1 `docs/reference/files.md`

Agregar bloque después de `src/config/`:

```markdown
├── constants/
│   ├── index.ts              # Barrel: re-export de todos los módulos
│   ├── validation.ts         # Límites de caracteres, cantidades, rating range
│   ├── cache.ts              # TTLs de cache (business, query, profile)
│   ├── storage.ts            # Keys de localStorage
│   ├── map.ts                # Coordenadas BA, colores de categoría en mapa
│   ├── business.ts           # Price levels, símbolos, chips
│   ├── tags.ts               # IDs válidos de tags predefinidos
│   ├── rankings.ts           # Scoring weights, medallas, labels, períodos
│   ├── feedback.ts           # Categorías válidas de feedback
│   ├── ui.ts                 # Colores de charts, URL agregar comercio
│   ├── admin.ts              # Email admin, free tier, page size, status labels
│   └── timing.ts             # Polling, auto-dismiss, staleness threshold
```

Agregar en `src/pages/`:

```markdown
│   └── ConstantsDashboard.tsx  # Dev-only constants explorer
```

### 3.2 `docs/reference/architecture.md`

Agregar `Constants` en diagrama de capas y `[/dev/constants]` en árbol de componentes.

### 3.3 `docs/reference/data-layer.md`

Agregar sección:

```markdown
## Constantes centralizadas (`src/constants/`)

Todas las constantes configurables del proyecto están centralizadas en `src/constants/`,
organizadas por dominio. Los services y hooks importan desde ahí en vez de definir localmente.
```

### 3.4 `docs/reference/features.md`

Agregar sección "Dev Tools":

```markdown
## Dev Tools (solo desarrollo)

| Tool | Ruta | Descripción |
|------|------|-------------|
| Theme Playground | `/dev/theme` | Color pickers, palette generator, component preview |
| Constants Dashboard | `/dev/constants` | Explorer de constantes: búsqueda, filtros, duplicados |

Acceso: Links en footer del menú lateral (visibles solo con `import.meta.env.DEV`).
```

### 3.5 `docs/reference/patterns.md`

Agregar patrón:

```markdown
| **Constantes centralizadas** | Todas en `src/constants/` por dominio.
Los archivos originales importan desde constants, no definen localmente.
Excepciones: types acoplados a tipos TS, sentinels de inicialización. |
```

### 3.6 `docs/PROJECT_REFERENCE.md`

- Bump versión a 2.4.0
- Agregar `constants.md` si se crea doc de referencia separada, o mencionar en resumen rápido bajo "Patrones clave"

---

## 4. Archivos nuevos vs modificados

### Archivos nuevos (14)

| Archivo | Descripción |
|---------|-------------|
| `src/constants/index.ts` | Barrel export |
| `src/constants/validation.ts` | Límites y valores permitidos |
| `src/constants/cache.ts` | TTLs de cache |
| `src/constants/storage.ts` | Keys localStorage |
| `src/constants/map.ts` | Coordenadas y colores mapa |
| `src/constants/business.ts` | Price levels y chips |
| `src/constants/tags.ts` | Tag IDs válidos |
| `src/constants/rankings.ts` | Scoring, medallas, labels |
| `src/constants/feedback.ts` | Categorías válidas |
| `src/constants/ui.ts` | Chart colors, URLs |
| `src/constants/admin.ts` | Admin config y labels |
| `src/constants/timing.ts` | Intervalos y duraciones |
| `src/pages/ConstantsDashboard.tsx` | Dashboard dev-only |
| `src/pages/constantsRegistry.ts` | Registry para el dashboard |

### Archivos modificados (~25)

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar lazy import + ruta `/dev/constants` |
| `src/components/layout/SideMenu.tsx` | Agregar link "Constants" en footer + importar `ADD_BUSINESS_URL` desde constants |
| `src/services/comments.ts` | Importar `MAX_COMMENT_LENGTH`, `MAX_DISPLAY_NAME_LENGTH` |
| `src/services/tags.ts` | Importar `MAX_CUSTOM_TAG_LENGTH`, `VALID_TAG_IDS` |
| `src/services/feedback.ts` | Importar `MAX_FEEDBACK_LENGTH`, `VALID_CATEGORIES` |
| `src/services/rankings.ts` | Importar `SCORING` |
| `src/context/AuthContext.tsx` | Importar `MAX_DISPLAY_NAME_LENGTH` |
| `src/context/ColorModeContext.tsx` | Importar `STORAGE_KEY_COLOR_MODE` |
| `src/hooks/useBusinessDataCache.ts` | Importar `BUSINESS_CACHE_TTL_MS` |
| `src/hooks/usePaginatedQuery.ts` | Importar `QUERY_CACHE_TTL_MS` |
| `src/hooks/useProfileVisibility.ts` | Importar `PROFILE_CACHE_TTL_MS` |
| `src/hooks/useNotifications.ts` | Importar `POLL_INTERVAL_MS` |
| `src/hooks/useVisitHistory.ts` | Importar `STORAGE_KEY_VISITS`, `MAX_VISIT_HISTORY` |
| `src/utils/analytics.ts` | Importar `STORAGE_KEY_ANALYTICS_CONSENT` |
| `src/components/map/MapView.tsx` | Importar `BUENOS_AIRES_CENTER` |
| `src/components/map/BusinessMarker.tsx` | Importar `CATEGORY_COLORS` |
| `src/components/business/BusinessPriceLevel.tsx` | Importar `LEVELS`, `LEVEL_SYMBOLS` |
| `src/components/business/BusinessTags.tsx` | Importar `MAX_CUSTOM_TAGS_PER_BUSINESS`, `MAX_CUSTOM_TAG_LENGTH` |
| `src/components/business/BusinessComments.tsx` | Importar `MAX_COMMENT_LENGTH`, `MAX_COMMENTS_PER_DAY` |
| `src/components/business/MenuPhotoSection.tsx` | Importar `SIX_MONTHS_MS` |
| `src/components/search/FilterChips.tsx` | Importar `PRICE_CHIPS` |
| `src/components/menu/ListFilters.tsx` | Importar `SCORE_OPTIONS` |
| `src/components/menu/RankingItem.tsx` | Importar `MEDALS` |
| `src/components/menu/UserScoreCard.tsx` | Importar `ACTION_LABELS` |
| `src/components/menu/RankingsView.tsx` | Importar `PERIOD_OPTIONS` |
| `src/components/stats/PieChartCard.tsx` | Importar `CHART_COLORS` |
| `src/components/admin/AdminGuard.tsx` | Importar `ADMIN_EMAIL` |
| `src/components/admin/FirebaseUsage.tsx` | Importar `FREE_TIER_READS`, `FREE_TIER_WRITES` |
| `src/components/admin/ActivityFeed.tsx` | Importar `ADMIN_PAGE_SIZE`, `TRUNCATE_COMMENT_PREVIEW` |
| `src/components/admin/BackupsPanel.tsx` | Importar `ADMIN_PAGE_SIZE`, `AUTO_DISMISS_MS` |
| `src/components/admin/AbuseAlerts.tsx` | Importar `ABUSE_TYPE_LABELS`, `ABUSE_TYPE_COLORS`, `TRUNCATE_DETAIL_PREVIEW` |
| `src/components/admin/PhotoReviewCard.tsx` | Importar `STATUS_CHIP` |
| `src/components/admin/PhotoReviewPanel.tsx` | Importar `STATUS_LABELS` |

### Documentación modificada (6)

| Archivo | Cambio |
|---------|--------|
| `docs/reference/files.md` | Agregar `src/constants/` y `ConstantsDashboard.tsx` |
| `docs/reference/architecture.md` | Agregar capa constants + ruta dev |
| `docs/reference/data-layer.md` | Sección constantes centralizadas |
| `docs/reference/features.md` | Sección Dev Tools |
| `docs/reference/patterns.md` | Patrón constantes centralizadas |
| `docs/PROJECT_REFERENCE.md` | Bump versión |

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Imports rotos al mover constantes | TypeScript compiler catchea todos. Correr `tsc --noEmit` antes de commit |
| Bundle size increase por barrel imports | Vite tree-shakes named exports. El dashboard solo se carga en DEV |
| Constantes con el mismo nombre en módulos distintos (ej. `PAGE_SIZE`) | Renombrar a nombres únicos (`ADMIN_PAGE_SIZE`) antes de centralizar |
| Registry desactualizado al agregar constantes | El registry importa `* from module`, detecta exports automáticamente |
