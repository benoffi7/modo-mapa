# Specs: Métricas por funcionalidad + Panel orquestador

**Feature:** metricas-panel
**Issue:** #159
**Fecha:** 2026-03-16

---

## 1. PerformancePanel decomposition

Extraer de `src/components/admin/PerformancePanel.tsx` (508 líneas):

| Subcomponente | Líneas aprox | Descripción |
|---------------|-------------|-------------|
| `VitalsSemaphore.tsx` | ~80 | 4 cards con semáforo verde/amarillo/rojo |
| `VitalsTrend.tsx` | ~60 | Gráficos de tendencia p75 vitals |
| `QueryLatencyTable.tsx` | ~50 | Tabla p50/p95 de queries |
| `FunctionTimingTable.tsx` | ~50 | Tabla p50/p95 de Cloud Functions |
| `StorageCard.tsx` | ~40 | Card de uso de Storage |
| `PerfFilters.tsx` | ~40 | Filtros período/dispositivo/conexión |

PerformancePanel queda como orquestador (~100 líneas) que importa los subcomponentes.

**Directorio nuevo:** `src/components/admin/perf/`

---

## 2. Nuevo tab "Features" en admin

**Componente:** `src/components/admin/FeaturesPanel.tsx`

Muestra métricas agrupadas por feature usando datos de `dailyMetrics.featureMetrics`.

### Cards por feature

Cada feature tiene una card con:
- Nombre y ícono
- Uso del día (count) con tendencia vs ayer
- Uso últimos 7 días (sparkline)

### Features a mostrar (basado en trackEvent existentes)

| Feature | Evento(s) fuente | Métrica principal |
|---------|-----------------|-------------------|
| Búsqueda | `business_search` | Búsquedas/día |
| Filtros | `business_filter_tag`, `business_filter_price` | Filtros aplicados/día |
| Ratings | `rating_submit`, `criteria_rating_submit` | Calificaciones/día |
| Comentarios | `comment_submit` | Comentarios/día |
| Likes | `comment_like` | Likes/día |
| Favoritos | `favorite_toggle` (action=add) | Favoritos agregados/día |
| Sorpréndeme | `surprise_me` | Clicks/día |
| Listas | `list_created`, `list_item_added` | Listas creadas + items/día |
| Fotos | `menu_photo_upload` | Fotos subidas/día |
| Feedback | `feedback_submit` | Feedback enviado/día |
| Compartir | `business_share` | Compartidos/día |
| Dark mode | `dark_mode_toggle` | Toggles/día |
| Menú lateral | `side_menu_section` | Aperturas por sección/día |

### Sección "Adopción"

- Funnel: anónimos → registrados → verificados (de `authStats`)
- Onboarding: % de usuarios que completaron las 5 tareas (calculado de userProfile stats)

---

## 3. Agregación en dailyMetrics Cloud Function

Agregar al scheduled `dailyMetrics` (3 AM):

### featureMetrics

```typescript
featureMetrics: {
  [featureName: string]: {
    count: number;        // eventos del día
    uniqueUsers: number;  // usuarios únicos
  }
}
```

Calculado contando documentos por tipo de acción en las últimas 24h:
- `comments` creados hoy → feature "comments"
- `ratings` creados hoy → feature "ratings"
- `favorites` creados hoy → feature "favorites"
- `sharedLists` creados hoy → feature "lists"
- `listItems` creados hoy → feature "list_items"
- `customTags` creados hoy → feature "tags"
- `menuPhotos` creados hoy → feature "photos"
- `feedback` creados hoy → feature "feedback"

### writesByCollection

Ya está en el tipo DailyMetrics pero nunca se calcula. Usar los counters existentes:

```typescript
writesByCollection: {
  comments: dailyWrites from comments counter,
  ratings: dailyWrites from ratings counter,
  favorites: ...,
  // etc
}
```

Fuente: `config/counters` ya tiene contadores por colección.

---

## 4. Archivos

### Nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/components/admin/perf/VitalsSemaphore.tsx` | Cards semáforo |
| `src/components/admin/perf/VitalsTrend.tsx` | Gráficos tendencia |
| `src/components/admin/perf/QueryLatencyTable.tsx` | Tabla queries |
| `src/components/admin/perf/FunctionTimingTable.tsx` | Tabla functions |
| `src/components/admin/perf/StorageCard.tsx` | Card storage |
| `src/components/admin/perf/PerfFilters.tsx` | Filtros |
| `src/components/admin/FeaturesPanel.tsx` | Tab Features |

### Modificados

| Archivo | Cambios |
|---------|---------|
| `src/components/admin/PerformancePanel.tsx` | Refactor a orquestador |
| `src/components/admin/AdminLayout.tsx` | Agregar tab Features |
| `functions/src/scheduled/dailyMetrics.ts` | Agregar featureMetrics + writesByCollection |
| `src/types/admin.ts` | Agregar FeatureMetrics type |
| `src/services/admin.ts` | Función fetchFeatureMetrics |

---

## Decisiones

1. **Agregación diaria, no realtime** — evita queries costosas, consistente con dailyMetrics existente
2. **Contar desde colecciones, no desde analytics** — los eventos de analytics van a GA4, no a Firestore. Las métricas se calculan desde las colecciones directamente
3. **writesByCollection desde counters** — reutilizar la infraestructura de counters server-side existente
4. **No agregar nuevos trackEvent** — los 27 existentes cubren todas las features. Solo falta la agregación
