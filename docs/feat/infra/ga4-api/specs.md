# Specs: GA4 Data API + writesByCollection

**PRD:** [GA4 Data API](./prd.md)
**Issue:** #161
**Estado:** Borrador

---

## S1: Cloud Function `getAnalyticsReport`

### Firma

```typescript
// functions/src/admin/analyticsReport.ts
import { onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';

interface GA4EventCount {
  eventName: string;
  date: string;       // "YYYYMMDD"
  eventCount: number;
}

interface AnalyticsReportResponse {
  events: GA4EventCount[];
  cachedAt: string;    // ISO timestamp
  fromCache: boolean;
}

export const getAnalyticsReport = onCall(
  { enforceAppCheck: !IS_EMULATOR, secrets: ['GA4_PROPERTY_ID'] },
  async (request: CallableRequest): Promise<AnalyticsReportResponse> => { ... }
);
```

### Logica interna

1. `assertAdmin(request.auth)` -- igual que `getAuthStats`
2. Leer `config/analyticsCache` de Firestore
3. Si `cachedAt` existe y `Date.now() - cachedAt < 3600000` (1 hora), devolver cache con `fromCache: true`
4. Si no hay cache o expirado:
   a. Instanciar `BetaAnalyticsDataClient` de `@google-analytics/data`
   b. Llamar `runReport` con:
      - `property`: `properties/${GA4_PROPERTY_ID}`
      - `dateRanges`: `[{ startDate: '30daysAgo', endDate: 'today' }]`
      - `dimensions`: `[{ name: 'eventName' }, { name: 'date' }]`
      - `metrics`: `[{ name: 'eventCount' }]`
      - `dimensionFilter`: filtrar solo los 10 eventos del PRD (ver tabla abajo)
   c. Parsear `response.rows` a `GA4EventCount[]`
   d. Escribir a `config/analyticsCache`: `{ events, cachedAt: new Date().toISOString() }`
   e. Devolver con `fromCache: false`

### Eventos a filtrar

```typescript
const GA4_EVENT_NAMES = [
  'surprise_me',
  'list_created',
  'list_item_added',
  'business_search',
  'business_share',
  'menu_photo_upload',
  'dark_mode_toggle',
  'side_menu_section',
  'business_view',
  'business_filter_tag',
] as const;
```

Se usa `dimensionFilter` con `inListFilter` en la dimension `eventName` para enviar una sola request a la API.

### Manejo de errores

- Si la API de GA4 falla, loggear con `logger.error` + `captureException` (Sentry) y lanzar `HttpsError('unavailable', ...)`.
- Si el secret `GA4_PROPERTY_ID` no esta configurado, lanzar `HttpsError('failed-precondition', 'GA4_PROPERTY_ID not configured')`.

---

## S2: Cache en `config/analyticsCache`

### Estructura del documento

```typescript
// Firestore: config/analyticsCache
interface AnalyticsCacheDoc {
  events: GA4EventCount[];     // Array de {eventName, date, eventCount}
  cachedAt: string;            // ISO 8601 timestamp
}
```

### Estrategia

| Aspecto | Detalle |
|---------|---------|
| Ubicacion | `config/analyticsCache` (mismo patron que `config/counters`, `config/aggregates`) |
| TTL | 1 hora (3600000 ms) |
| Invalidacion | Solo por TTL; no hay invalidacion manual |
| Escritura | Solo desde `getAnalyticsReport` Cloud Function |
| Lectura | Solo desde `getAnalyticsReport` Cloud Function (el frontend NO lee directo) |
| Tamano estimado | ~300 entries (10 eventos x 30 dias) -> < 50 KB |

El frontend no accede al cache directamente. Siempre pasa por la callable, que decide si devolver cache o refrescar.

---

## S3: writesByCollection -- clarificacion

**Descubrimiento durante analisis:** `writesByCollection` ya se computa en tiempo real via `trackWrite()` en `functions/src/utils/counters.ts`. Cada trigger (comments, ratings, favorites, feedback, customTags, userTags, commentLikes, menuPhotos, priceLevels, users) llama `trackWrite(db, '<collectionName>')`, que incrementa `dailyMetrics/{today}.writesByCollection.<collectionName>`.

**Problema real:** El `dailyMetrics` scheduled function (que corre a las 03:00 ART) no necesita computar `writesByCollection` porque ya esta en el doc. Sin embargo, hay que verificar que el `.set({ ... }, { merge: true })` del scheduled no sobrescriba el campo. Actualmente NO incluye `writesByCollection` en el set, y usa `merge: true`, asi que los datos de triggers se preservan.

**Accion requerida:** Ninguna en `dailyMetrics.ts`. El campo ya funciona. Lo que faltaba era la integracion en FeaturesPanel, que ya lo lee (linea 69-70 de `FeaturesPanel.tsx`):
```typescript
value: m.writesByCollection?.[collectionKey] ?? 0,
```

Si los graficos muestran 0, el problema es que las colecciones trackeadas no coinciden con los `collectionKey` de `FEATURES`. Hay que verificar que los keys coinciden:

| Feature | `collectionKey` en FEATURES | `trackWrite` key | Match? |
|---------|----------------------------|-------------------|--------|
| Calificaciones | `ratings` | `ratings` | Si |
| Comentarios | `comments` | `comments` | Si |
| Likes | `commentLikes` | `commentLikes` | Si |
| Favoritos | `favorites` | `favorites` | Si |
| Tags | `customTags` | `customTags` | Si (parcial: no incluye userTags) |
| Feedback | `feedback` | `feedback` | Si |

**Nota:** El feature "Tags" usa `collectionKey: 'customTags'` pero el total combina `c.customTags + c.userTags`. Para el grafico de tendencia solo muestra writes de `customTags`. Si se quiere incluir `userTags`, habria que sumar ambos en `buildFeatureTrend`. Esto es un nice-to-have, no bloqueante.

---

## S4: Tipos nuevos

### En `src/types/admin.ts`

```typescript
// Respuesta de la callable getAnalyticsReport
export interface GA4EventCount {
  eventName: string;
  date: string;
  eventCount: number;
}

export interface AnalyticsReportResponse {
  events: GA4EventCount[];
  cachedAt: string;
  fromCache: boolean;
}
```

### En `functions/src/admin/analyticsReport.ts` (locales)

```typescript
// Duplicar GA4EventCount y AnalyticsReportResponse localmente
// (las functions no importan de src/types)
```

No se modifican tipos existentes (`DailyMetrics`, `AdminCounters`, etc.).

---

## S5: Integracion en FeaturesPanel

### Cambios en fetcher

```typescript
// Agregar al fetcher existente:
const fetcher = useCallback(async () => {
  const [counters, dailyMetrics, analyticsReport] = await Promise.all([
    fetchCounters(),
    fetchDailyMetrics('desc', 30),
    fetchAnalyticsReport(),  // nueva funcion en services/admin.ts
  ]);
  return { counters, dailyMetrics, analyticsReport };
}, []);
```

### Nueva funcion en `src/services/admin.ts`

```typescript
export async function fetchAnalyticsReport(): Promise<AnalyticsReportResponse> {
  const fn = httpsCallable<void, AnalyticsReportResponse>(functions, 'getAnalyticsReport');
  const result = await fn();
  return result.data;
}
```

Sigue el mismo patron que `fetchAuthStats()` y `fetchStorageStats()`.

### Cambios en GA4_FEATURES

Transformar `GA4_FEATURES` de array estatico a un formato que soporte datos reales:

```typescript
interface GA4FeatureDef {
  key: string;
  name: string;
  icon: ReactElement;
  eventNames: string[];   // eventos GA4 a sumar para esta feature
  color: string;
}

const GA4_FEATURES: GA4FeatureDef[] = [
  { key: 'surprise', name: 'Sorprendeme', icon: <CasinoIcon />, eventNames: ['surprise_me'], color: '#FF5722' },
  { key: 'lists', name: 'Listas', icon: <BookmarkBorderIcon />, eventNames: ['list_created', 'list_item_added'], color: '#795548' },
  { key: 'search', name: 'Busqueda', icon: <SearchIcon />, eventNames: ['business_search'], color: '#607D8B' },
  { key: 'share', name: 'Compartir', icon: <ShareIcon />, eventNames: ['business_share'], color: '#00BCD4' },
  { key: 'photos', name: 'Fotos', icon: <CameraAltOutlinedIcon />, eventNames: ['menu_photo_upload'], color: '#8BC34A' },
  { key: 'darkMode', name: 'Dark Mode', icon: <DarkModeOutlinedIcon />, eventNames: ['dark_mode_toggle'], color: '#424242' },
];
```

### Helpers nuevos (dentro de FeaturesPanel.tsx)

```typescript
function buildGA4FeatureData(
  events: GA4EventCount[],
  eventNames: string[],
): { today: number; total: number; trend: { date: string; value: number }[] } {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const yesterday = /* today - 1 day, formatted YYYYMMDD */;

  const relevant = events.filter(e => eventNames.includes(e.eventName));

  // Agrupar por fecha
  const byDate = new Map<string, number>();
  let total = 0;
  for (const e of relevant) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.eventCount);
    total += e.eventCount;
  }

  const todayCount = byDate.get(today) ?? 0;
  const yesterdayCount = byDate.get(yesterday) ?? 0;

  // Trend data: ordenar por fecha asc
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      value,
    }));

  return { today: todayCount, yesterday: yesterdayCount, total, trend };
}
```

### Renderizado unificado

Eliminar la seccion separada "Features solo en GA4" (lineas 155-177 de `FeaturesPanel.tsx`). Renderizar las GA4 features en el mismo Grid que las Firestore features, con el mismo formato de card + grafico expandible.

La card de cada GA4 feature muestra:
- Icono + nombre (igual que Firestore features)
- `TrendIcon` comparando hoy vs ayer
- Numero grande = conteo de hoy
- Caption: "hoy (GA4) . {total} ultimos 30d"
- Collapse con `LineChartCard` mostrando tendencia 30 dias

### Manejo de error GA4

Si `fetchAnalyticsReport()` falla, no bloquear el panel. Mostrar las Firestore features normalmente y un `Alert severity="warning"` en lugar de las GA4 cards:

```
No se pudieron cargar las metricas de GA4. Los datos de colecciones estan disponibles.
```

Para esto, el fetcher debe usar `Promise.allSettled` o un try/catch individual para la callable GA4.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `functions/src/admin/analyticsReport.ts` | **Nuevo.** Cloud Function callable `getAnalyticsReport` |
| `functions/src/index.ts` | Agregar export de `getAnalyticsReport` |
| `functions/package.json` | Agregar dependencia `@google-analytics/data` |
| `src/types/admin.ts` | Agregar `GA4EventCount` y `AnalyticsReportResponse` |
| `src/services/admin.ts` | Agregar `fetchAnalyticsReport()` |
| `src/components/admin/FeaturesPanel.tsx` | Integrar GA4 data, unificar cards, eliminar seccion separada |

**Archivos que NO se modifican:**
- `functions/src/scheduled/dailyMetrics.ts` -- `writesByCollection` ya funciona via triggers
- `functions/src/utils/counters.ts` -- sin cambios
- `src/config/adminConverters.ts` -- sin cambios (no necesita converter para analytics cache)

---

## Firestore rules

El documento `config/analyticsCache` es leido y escrito exclusivamente por Cloud Functions (server-side con Admin SDK), que bypasea las Firestore security rules. No se necesitan cambios en las rules.

Si el proyecto tuviera reglas explicitamente denegando acceso a docs dentro de `config/`, verificar que no hay una regla de deny-all. Pero dado que el patron existente (`config/counters`, `config/aggregates`, `config/perfCounters`) funciona sin rules especificas para el Admin SDK, no se requiere accion.

---

## Seguridad

### Service account

- La Cloud Function usa `BetaAnalyticsDataClient` que se autentica automaticamente con las Application Default Credentials del service account del proyecto Firebase.
- **Requisito de setup:** agregar el rol `roles/analyticsViewer` (o `roles/analytics.viewer`) al service account `{project-id}@appspot.gserviceaccount.com` en la propiedad GA4.
- Esto se hace desde Google Analytics Admin > Property Access Management > agregar el email del service account con rol Viewer.

### GA4_PROPERTY_ID

- Se almacena como secret en Firebase Functions: `firebase functions:secrets:set GA4_PROPERTY_ID`
- Se referencia en la Cloud Function via `secrets: ['GA4_PROPERTY_ID']` en el config de `onCall`.
- **No se expone al frontend.** El frontend solo invoca la callable; el property ID queda en el backend.

### Acceso a la callable

- Requiere autenticacion + custom claim `admin === true` (via `assertAdmin`).
- Requiere App Check en produccion (`enforceAppCheck: !IS_EMULATOR`).
- Usuarios no-admin reciben `HttpsError('permission-denied')`.

### Datos sensibles

- Los eventos de GA4 consultados son conteos agregados, no datos de usuarios individuales.
- No se exponen user IDs, IPs ni datos PII del analytics.

---

## Dependencias nuevas

| Paquete | Ubicacion | Version |
|---------|-----------|---------|
| `@google-analytics/data` | `functions/package.json` | `^4.x` (ultima estable) |

No se agregan dependencias al frontend (`package.json` root).

---

## Tests

No se agregan tests nuevos en esta iteracion. La callable se puede testear manualmente via emulator:

```bash
firebase emulators:start
# Llamar getAnalyticsReport desde el panel admin con usuario admin
```

Para testing de la API de GA4 en local, se necesita un service account key (solo desarrollo, nunca commitear).

---

## Impacto en performance

| Aspecto | Impacto |
|---------|---------|
| FeaturesPanel load | +1 callable round-trip (~200ms cached, ~2s first call) |
| GA4 API quota | Max 1 request/hora (por cache TTL). Quota de GA4 Data API: 50 requests/day gratis |
| Firestore reads | +1 read para cache check; +1 write si cache miss. Negligible |
| Bundle size frontend | Sin impacto (no se agrega lib al frontend) |
| Cold start functions | `@google-analytics/data` agrega ~2MB al bundle de functions. Impacto en cold start: ~200-400ms |
