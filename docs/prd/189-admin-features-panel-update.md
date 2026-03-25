# PRD #189 — Admin: Agregar features faltantes a FeaturesPanel

## Contexto

El FeaturesPanel trackea 6 features Firestore y 6 GA4. Varias features implementadas posteriormente (check-ins, follows, recommendations, price levels, Q&A) no fueron agregadas al panel.

## Requisitos

### Nuevas cards Firestore

Agregar al array `FEATURES[]`:

| Feature | Icon | Counter key | Collection key | Color |
|---------|------|-------------|----------------|-------|
| Check-ins | `PlaceOutlined` | `checkins` (nuevo) | `checkins` | #009688 (teal) |
| Follows | `PeopleOutlined` | `follows` (nuevo) | `follows` | #3F51B5 (indigo) |
| Recomendaciones | `RecommendOutlined` | `recommendations` (nuevo) | `recommendations` | #FF9800 (orange) |
| Nivel de gasto | `AttachMoneyOutlined` | `priceLevels` (nuevo) | `priceLevels` | #4CAF50 (green) |

### Nuevas cards GA4

Agregar al array `GA4_FEATURES[]`:

| Feature | Icon | Event names | Color |
|---------|------|-------------|-------|
| Preguntas | `HelpOutlineIcon` | `question_created`, `question_answered` | #00BCD4 (cyan) |
| Recomendaciones | `RecommendOutlined` | `recommendation_sent`, `recommendation_opened` | #FF9800 |
| Check-in | `PlaceOutlined` | `checkin_created` | #009688 |

Nota: verificar que estos event names existan en el codigo antes de agregar. Si no se trackean via GA4, omitir la card GA4 y solo usar Firestore.

### Actualizar AdminCounters

Agregar a `AdminCounters`:
- `checkins: number`
- `follows: number`
- `recommendations: number`
- `priceLevels: number`

Actualizar `fetchCounters()` para contar estas colecciones.

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/types/admin.ts` | Agregar nuevos campos a `AdminCounters` |
| `src/services/admin.ts` | Actualizar `fetchCounters()` para contar las 4 colecciones nuevas |
| `src/components/admin/FeaturesPanel.tsx` | Agregar cards a `FEATURES[]` y `GA4_FEATURES[]` |
| `functions/src/` | Verificar que `trackDailyMetrics` registra writes de checkins, follows, recommendations |

## Patron a seguir

- Cards: identicas a las existentes en `FEATURES[]` — misma estructura `FeatureDef`
- Counters: agregar `getDocs(collection(db, COLLECTIONS.X))` al `Promise.all` de `fetchCounters`
- Alternativa eficiente: si las colecciones son grandes, usar `countFromServer()` en vez de `getDocs` + `.size`

## Tests

- `AdminCounters` incluye los 4 nuevos campos
- `fetchCounters` retorna valores para las nuevas colecciones
- FeaturesPanel renderiza las cards nuevas
- Cada card muestra valor de hoy y total correctos

## Seguridad

- Solo lectura (AdminGuard)
- `countFromServer` es mas eficiente que traer todos los docs

## Fuera de scope

- Reorganizar el layout de FeaturesPanel (solo agregar cards)
- Agregar cards para colecciones internas (config, dailyMetrics, perfMetrics)

## Dependencias

- #184 (Check-ins counter) y #185 (Social counters) agregan los mismos counters — si se implementan primero, este issue solo agrega las cards al FeaturesPanel
- Sin esos issues, este issue debe agregar tanto counters como cards
