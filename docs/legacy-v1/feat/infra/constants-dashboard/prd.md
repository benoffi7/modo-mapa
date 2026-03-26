# PRD: Constants Dashboard (Dev Tool)

## Problema

El proyecto tiene **30+ archivos** con constantes dispersas por todo el codebase: config, types, services, components y hooks. Esto genera:

- **Descubrimiento difícil**: Para saber qué constantes existen hay que buscar archivo por archivo.
- **Duplicación potencial**: Valores similares definidos en distintos lugares (ej. múltiples `CACHE_TTL`, `PAGE_SIZE`, `STORAGE_KEY`).
- **Mantenimiento costoso**: Cambiar un valor requiere saber en qué archivo vive.
- **Sin visibilidad centralizada**: No hay forma rápida de ver todas las constantes y sus valores actuales.

## Solución

### 1. Refactoring: Centralizar constantes

Agrupar todas las constantes exportadas en `src/constants/` organizado por dominio, manteniendo re-exports desde los archivos originales para no romper imports existentes.

**Estructura propuesta:**

```text
src/constants/
├── index.ts              # Re-export central
├── map.ts                # BUENOS_AIRES_CENTER, CATEGORY_COLORS
├── business.ts           # PRICE_LEVEL_LABELS, CATEGORY_LABELS, LEVEL_SYMBOLS, MAX_CUSTOM_TAGS
├── tags.ts               # PREDEFINED_TAGS, VALID_TAG_IDS
├── rankings.ts           # SCORING, MEDALS, ACTION_LABELS, PERIOD_OPTIONS
├── feedback.ts           # VALID_CATEGORIES
├── ui.ts                 # SECTION_TITLES, ADD_BUSINESS_URL, SCORE_OPTIONS, COLORS (chart)
├── admin.ts              # ADMIN_EMAIL, FREE_TIER_READS/WRITES, PAGE_SIZE, AUTO_DISMISS_MS, TYPE_COLORS, TYPE_LABELS, STATUS_CHIP
├── cache.ts              # CACHE_TTL (hooks), POLL_INTERVAL_MS, CACHE_TTL_MS
├── storage.ts            # STORAGE_KEY (visits), STORAGE_KEY (color-mode), LS_KEY (analytics)
├── theme.ts              # Colores del tema, SIX_MONTHS_MS
└── firebase.ts           # COLLECTIONS (re-export desde config/)
```

### 2. Constants Dashboard (dev-only)

Un dashboard accesible solo en desarrollo (`/dev/constants`) desde el menú lateral, siguiendo el mismo patrón que el Theme Playground:

- **Ruta**: `/dev/constants` (solo `import.meta.env.DEV`)
- **Acceso**: Link en el footer del SideMenu junto al link "Theme" existente
- **Sin autenticación**: Accesible directamente en dev

#### Funcionalidades

| Feature | Descripción |
|---------|-------------|
| **Vista general** | Tabla/lista de todas las constantes agrupadas por módulo con nombre, valor actual y archivo fuente |
| **Búsqueda** | Filtro por nombre de constante o valor |
| **Edición inline** | Modificar valores en runtime (solo afecta la sesión actual, no persiste en código) |
| **Agregar constante** | Formulario para crear nueva constante → genera código copiable para pegar en el archivo correspondiente |
| **Eliminar** | Marcar constante como "para eliminar" → genera instrucciones de qué líneas borrar |
| **Exportar** | Copiar al clipboard el bloque de código actualizado listo para pegar en el archivo fuente |
| **Detección de duplicados** | Highlight automático de constantes con valores idénticos o nombres similares |

#### Consideraciones

- **No modifica archivos directamente**: Es una herramienta de visualización y generación de código. Los cambios reales se hacen en el código.
- **Runtime overrides**: Los valores editados inline se aplican via Context/Provider para testing rápido sin rebuild.
- **Tree-shaking safe**: El dashboard y su registry se eliminan completamente del build de producción.

## Inventario actual de constantes

### Config (`src/config/`)

| Constante | Archivo | Tipo |
|-----------|---------|------|
| `COLLECTIONS` | collections.ts | Record (16 colecciones) |
| `requiredEnvVars` | firebase.ts | string[] |
| `firebaseConfig` | firebase.ts | Object |

### Types/Domain (`src/types/`)

| Constante | Archivo | Tipo |
|-----------|---------|------|
| `PREDEFINED_TAGS` | index.ts | Array (6 tags con iconos) |
| `PRICE_LEVEL_LABELS` | index.ts | Record (3 niveles) |
| `CATEGORY_LABELS` | index.ts | Record (7 categorías) |

### Services (`src/services/`)

| Constante | Archivo | Tipo |
|-----------|---------|------|
| `DEFAULT_SETTINGS` | userSettings.ts | Object |
| `SCORING` | rankings.ts | Object (6 keys) |
| `VALID_CATEGORIES` | feedback.ts | string[] |
| `VALID_TAG_IDS` | tags.ts | string[] |

### Components (10+ archivos)

| Constante | Archivo | Tipo |
|-----------|---------|------|
| `BUENOS_AIRES_CENTER` | MapView.tsx | { lat, lng } |
| `CATEGORY_COLORS` | BusinessMarker.tsx | Record |
| `SECTION_TITLES` | SideMenu.tsx | Record |
| `ADD_BUSINESS_URL` | SideMenu.tsx | string |
| `ADMIN_EMAIL` | AdminGuard.tsx | string |
| `FREE_TIER_READS/WRITES` | FirebaseUsage.tsx | number |
| `PAGE_SIZE` | BackupsPanel.tsx, ActivityFeed.tsx | number |
| `AUTO_DISMISS_MS` | BackupsPanel.tsx | number |
| `TYPE_COLORS/LABELS` | AbuseAlerts.tsx | Record |
| `STATUS_CHIP` | PhotoReviewCard.tsx | Record |
| `LEVELS/LEVEL_SYMBOLS` | BusinessPriceLevel.tsx | Array/Record |
| `MAX_CUSTOM_TAGS` | BusinessTags.tsx | number |
| `SIX_MONTHS_MS` | MenuPhotoSection.tsx | number |
| `SCORE_OPTIONS` | ListFilters.tsx | number[] |
| `MEDALS` | RankingItem.tsx | string[] |
| `ACTION_LABELS` | UserScoreCard.tsx | Record |
| `PERIOD_OPTIONS` | RankingsView.tsx | Array |
| `COLORS` (chart) | PieChartCard.tsx | string[] |

### Hooks (5 archivos)

| Constante | Archivo | Tipo |
|-----------|---------|------|
| `STORAGE_KEY` | useVisitHistory.ts | string |
| `MAX_ENTRIES` | useVisitHistory.ts | number |
| `CACHE_TTL` | useBusinessDataCache.ts | number (5 min) |
| `POLL_INTERVAL_MS` | useNotifications.ts | number (60s) |
| `CACHE_TTL_MS` | useProfileVisibility.ts | number (60s) |
| `CACHE_TTL` | usePaginatedQuery.ts | number (2 min) |

### Utils/Context

| Constante | Archivo | Tipo |
|-----------|---------|------|
| `STORAGE_KEY` | ColorModeContext.tsx | string |
| `LS_KEY` | analytics.ts | string |

### 3. Refactoring de documentación

Al centralizar constantes en `src/constants/` y agregar el dashboard, la documentación del proyecto queda desactualizada. Se deben actualizar los siguientes archivos:

#### `docs/reference/files.md`

- Agregar sección `src/constants/` con todos los archivos nuevos y sus descripciones
- Agregar `src/pages/ConstantsDashboard.tsx` junto al ThemePlayground existente
- Actualizar comentarios en archivos que ya no definen constantes localmente (cuando corresponda)

#### `docs/reference/architecture.md`

- Agregar `src/constants/` como capa en el diagrama de capas:

```text
Components ──► Services ──► Firestore SDK ──► Cloud Firestore
     │              │
     │              └─ config/ (firebase.ts, collections.ts, converters)
     │
     ├─ Constants (src/constants/) ◄── centralizado
     ├─ Hooks (useAsyncData, useBusinessData, usePaginatedQuery, etc.)
     ├─ Context (AuthContext, MapContext)
     └─ Utils (formatDate, businessHelpers)
```

- Agregar `[/dev/constants] ConstantsDashboard (lazy, DEV only)` en el árbol de componentes (junto al ThemePlayground)
- Actualizar footer del SideMenu para reflejar los dos links dev

#### `docs/reference/data-layer.md`

- Actualizar tabla de services para referenciar que las constantes de validación (`VALID_CATEGORIES`, `VALID_TAG_IDS`, `SCORING`, etc.) ahora viven en `src/constants/` y se re-exportan desde services
- Actualizar sección de hooks para indicar que `CACHE_TTL`, `POLL_INTERVAL_MS`, `STORAGE_KEY`, etc. se centralizaron en `src/constants/cache.ts` y `src/constants/storage.ts`

#### `docs/reference/features.md`

- Agregar sección "Dev Tools" que documente tanto el Theme Playground como el nuevo Constants Dashboard:
  - Ruta, acceso, funcionalidades principales

#### `docs/reference/patterns.md`

- Agregar patrón "Constantes centralizadas":
  - Todas las constantes exportadas viven en `src/constants/` organizado por dominio
  - Los archivos originales re-exportan desde constants para backwards compatibility
  - El dashboard dev permite visualizar y buscar constantes en runtime

#### `docs/PROJECT_REFERENCE.md`

- Agregar `src/constants/` en la tabla de documentación detallada si corresponde
- Bump de versión

## Fuera de alcance

- Modificación directa de archivos desde el dashboard (es generador de código, no editor)
- Constantes de Firebase config/Sentry (son de infraestructura, no editables)
- Constantes en `functions/` (Cloud Functions tienen su propio scope)

## Métricas de éxito

- Todas las constantes del proyecto accesibles desde un único punto
- Tiempo de descubrimiento de una constante: < 5 segundos
- Zero impacto en bundle de producción
- Documentación del proyecto refleja la nueva estructura sin inconsistencias
