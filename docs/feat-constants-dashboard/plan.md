# Plan de implementación: Constants Dashboard

## Fase 1 — Crear `src/constants/` (12 archivos nuevos)

Crear los 12 archivos de constantes en orden de menor a mayor dependencia.

### Paso 1.1: Archivos sin dependencias de tipos

Crear en paralelo (no importan nada del proyecto):

1. `src/constants/validation.ts`
2. `src/constants/cache.ts`
3. `src/constants/storage.ts`
4. `src/constants/timing.ts`
5. `src/constants/feedback.ts`
6. `src/constants/ui.ts`
7. `src/constants/admin.ts`
8. `src/constants/rankings.ts`

### Paso 1.2: Archivos con dependencias de tipos

Crear después (importan `type` desde `src/types`):

9. `src/constants/map.ts` — sin dependencias
10. `src/constants/tags.ts` — sin dependencias
11. `src/constants/business.ts` — importa `type { BusinessCategory }` y `type { PriceLevel }` de types

### Paso 1.3: Barrel

12. `src/constants/index.ts` — re-exporta todos los módulos + `COLLECTIONS` desde config

---

## Fase 2 — Migrar imports (32 archivos)

Migrar por capas, de adentro hacia afuera. Después de cada grupo, correr `tsc --noEmit` para verificar.

### Paso 2.1: `src/types/index.ts`

Caso especial: mover `PREDEFINED_TAGS`, `PRICE_LEVEL_LABELS`, `CATEGORY_LABELS` a constants y reemplazar con imports + re-exports.

**Antes:**

```typescript
export const PREDEFINED_TAGS = [...] as const;
export type PredefinedTagId = (typeof PREDEFINED_TAGS)[number]['id'];
export const PRICE_LEVEL_LABELS: Record<number, string> = { ... };
export const CATEGORY_LABELS: Record<BusinessCategory, string> = { ... };
```

**Después:**

```typescript
import { PREDEFINED_TAGS } from '../constants/tags';
import { PRICE_LEVEL_LABELS, CATEGORY_LABELS } from '../constants/business';

export { PREDEFINED_TAGS, PRICE_LEVEL_LABELS, CATEGORY_LABELS };
export type PredefinedTagId = (typeof PREDEFINED_TAGS)[number]['id'];
```

**Verificar:** `tsc --noEmit` — confirmar que `PredefinedTagId` sigue resolviéndose correctamente.

### Paso 2.2: Services (5 archivos)

| Archivo | Cambios |
|---------|---------|
| `services/comments.ts` | Reemplazar magic numbers `500`, `30` → importar `MAX_COMMENT_LENGTH`, `MAX_DISPLAY_NAME_LENGTH` |
| `services/tags.ts` | Mover `VALID_TAG_IDS` → importar. Reemplazar magic `30` → `MAX_CUSTOM_TAG_LENGTH` |
| `services/feedback.ts` | Mover `VALID_CATEGORIES` → importar. Reemplazar magic `1000` → `MAX_FEEDBACK_LENGTH` |
| `services/rankings.ts` | Mover `SCORING` → importar |
| `services/priceLevels.ts` | Verificar si tiene magic numbers (review rápido) |

### Paso 2.3: Context (2 archivos)

| Archivo | Cambios |
|---------|---------|
| `context/AuthContext.tsx` | Reemplazar magic `30` → `MAX_DISPLAY_NAME_LENGTH` |
| `context/ColorModeContext.tsx` | Mover `STORAGE_KEY` → importar `STORAGE_KEY_COLOR_MODE` |

### Paso 2.4: Hooks (5 archivos)

| Archivo | Cambios |
|---------|---------|
| `hooks/useBusinessDataCache.ts` | Mover `CACHE_TTL` → importar `BUSINESS_CACHE_TTL_MS` |
| `hooks/usePaginatedQuery.ts` | Mover `CACHE_TTL` → importar `QUERY_CACHE_TTL_MS` |
| `hooks/useProfileVisibility.ts` | Mover `CACHE_TTL_MS` → importar `PROFILE_CACHE_TTL_MS` |
| `hooks/useNotifications.ts` | Mover `POLL_INTERVAL_MS` → importar desde constants |
| `hooks/useVisitHistory.ts` | Mover `STORAGE_KEY`, `MAX_ENTRIES` → importar `STORAGE_KEY_VISITS`, `MAX_VISIT_HISTORY` |

### Paso 2.5: Utils (1 archivo)

| Archivo | Cambios |
|---------|---------|
| `utils/analytics.ts` | Mover `LS_KEY` → importar `STORAGE_KEY_ANALYTICS_CONSENT` |

### Paso 2.6: Componentes — Map (2 archivos)

| Archivo | Cambios |
|---------|---------|
| `components/map/MapView.tsx` | Mover `BUENOS_AIRES_CENTER` → importar |
| `components/map/BusinessMarker.tsx` | Mover `CATEGORY_COLORS` → importar |

### Paso 2.7: Componentes — Business (4 archivos)

| Archivo | Cambios |
|---------|---------|
| `components/business/BusinessPriceLevel.tsx` | Mover `LEVELS`, `LEVEL_SYMBOLS` → importar |
| `components/business/BusinessTags.tsx` | Mover `MAX_CUSTOM_TAGS` → importar `MAX_CUSTOM_TAGS_PER_BUSINESS`. Reemplazar magic `30` → `MAX_CUSTOM_TAG_LENGTH` |
| `components/business/BusinessComments.tsx` | Reemplazar magic `500` → `MAX_COMMENT_LENGTH`, magic `20` → `MAX_COMMENTS_PER_DAY` |
| `components/business/MenuPhotoSection.tsx` | Mover `SIX_MONTHS_MS` → importar |

### Paso 2.8: Componentes — Search (1 archivo)

| Archivo | Cambios |
|---------|---------|
| `components/search/FilterChips.tsx` | Mover `PRICE_CHIPS` → importar |

### Paso 2.9: Componentes — Menu (4 archivos)

| Archivo | Cambios |
|---------|---------|
| `components/menu/ListFilters.tsx` | Mover `SCORE_OPTIONS` → importar |
| `components/menu/RankingItem.tsx` | Mover `MEDALS` → importar |
| `components/menu/UserScoreCard.tsx` | Mover `ACTION_LABELS` → importar |
| `components/menu/RankingsView.tsx` | Mover `PERIOD_OPTIONS` → importar |

### Paso 2.10: Componentes — Stats (1 archivo)

| Archivo | Cambios |
|---------|---------|
| `components/stats/PieChartCard.tsx` | Mover `COLORS` → importar `CHART_COLORS` |

### Paso 2.11: Componentes — Admin (7 archivos)

| Archivo | Cambios |
|---------|---------|
| `components/admin/AdminGuard.tsx` | Mover `ADMIN_EMAIL` → importar |
| `components/admin/FirebaseUsage.tsx` | Mover `FREE_TIER_READS`, `FREE_TIER_WRITES` → importar |
| `components/admin/ActivityFeed.tsx` | Mover `PAGE_SIZE` → importar `ADMIN_PAGE_SIZE`. Reemplazar magic `50` → `TRUNCATE_COMMENT_PREVIEW` |
| `components/admin/BackupsPanel.tsx` | Mover `PAGE_SIZE` → `ADMIN_PAGE_SIZE`, `AUTO_DISMISS_MS` → importar |
| `components/admin/AbuseAlerts.tsx` | Mover `TYPE_LABELS` → `ABUSE_TYPE_LABELS`, `TYPE_COLORS` → `ABUSE_TYPE_COLORS`. Reemplazar magic `80` → `TRUNCATE_DETAIL_PREVIEW` |
| `components/admin/PhotoReviewCard.tsx` | Mover `STATUS_CHIP` → importar |
| `components/admin/PhotoReviewPanel.tsx` | Mover `STATUS_LABELS` → importar |

### Paso 2.12: Componentes — Layout (1 archivo)

| Archivo | Cambios |
|---------|---------|
| `components/layout/SideMenu.tsx` | Mover `ADD_BUSINESS_URL` → importar. Reemplazar magic `30` en `maxLength` → `MAX_DISPLAY_NAME_LENGTH` |

### Paso 2.13: Verificación completa

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Los tres deben pasar sin errores antes de continuar.

---

## Fase 3 — Constants Dashboard (2 archivos nuevos)

### Paso 3.1: Registry

Crear `src/pages/constantsRegistry.ts`:

- Importar `* as moduleName` desde cada archivo de `src/constants/`
- Función `buildEntries()` que mapea exports a `ConstantEntry[]`
- Array `CONSTANT_MODULES` con metadata de cada módulo (nombre, descripción, icono)

### Paso 3.2: Dashboard

Crear `src/pages/ConstantsDashboard.tsx`:

- Self-contained (todo en un archivo, patrón ThemePlayground)
- Componentes internos: `Header`, `SearchBar`, `ModuleChips`, `ConstantCard`, `DuplicatesBanner`, `StatsFooter`
- MUI components: `AppBar`, `TextField`, `Chip`, `Accordion`, `Typography`, `Paper`, `Alert`, `Snackbar`, `IconButton`
- Estado: `searchQuery`, `activeModules` (Set), `expandedModules` (Set), `snackbar`
- Lógica de filtrado: por query (nombre o valor) + por módulo activo
- Detección de duplicados: al montar, comparar values entre modules
- Dark mode compatible

### Paso 3.3: Routing + SideMenu

Modificar `src/App.tsx`:

- Agregar `const ConstantsDashboard = lazy(() => import('./pages/ConstantsDashboard'));`
- Agregar `<Route path="/dev/constants">` dentro del bloque `import.meta.env.DEV`

Modificar `src/components/layout/SideMenu.tsx`:

- Agregar link "Constants" en el footer dev junto a "Theme"

### Paso 3.4: Verificación

```bash
npx tsc --noEmit
npm run build
npm run dev  # verificar manualmente /dev/constants
```

---

## Fase 4 — Documentación (6 archivos)

### Paso 4.1: Actualizar docs

En paralelo:

1. `docs/reference/files.md` — Agregar `src/constants/` + `ConstantsDashboard.tsx`
2. `docs/reference/architecture.md` — Agregar capa constants en diagrama + ruta `/dev/constants` en árbol
3. `docs/reference/data-layer.md` — Agregar sección "Constantes centralizadas"
4. `docs/reference/features.md` — Agregar sección "Dev Tools"
5. `docs/reference/patterns.md` — Agregar patrón "Constantes centralizadas"
6. `docs/PROJECT_REFERENCE.md` — Bump versión a 2.4.0 + mención en patrones clave

---

## Fase 5 — Test local + PR

### Paso 5.1: Test local completo

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
npm run dev  # test manual: navegar a /dev/constants, verificar UI
```

### Paso 5.2: Commit + PR

- Branch: `feat/constants-dashboard`
- Commit único o dividido por fase si los cambios son muy grandes
- PR contra `main`

---

## Resumen de fases

| Fase | Descripción | Archivos | Dependencias |
|------|-------------|----------|-------------|
| 1 | Crear `src/constants/` | 12 nuevos | Ninguna |
| 2 | Migrar imports | ~32 modificados | Fase 1 |
| 3 | Dashboard + routing | 2 nuevos + 2 mod | Fase 2 |
| 4 | Documentación | 6 modificados | Fase 3 |
| 5 | Test + PR | — | Fase 4 |
