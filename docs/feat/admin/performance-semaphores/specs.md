# Specs: Performance Semaphores — Fase 1

**Scope:** S1.1 (Web Vitals) + S1.2 (Firestore query timing) + S2.1 (perfMetrics collection)

---

## Arquitectura

```text
Browser (client)
  ├── PerformanceObserver → Web Vitals (LCP, INP, CLS, TTFB)
  ├── measureAsync() wrapper → Query latencies
  └── flushPerfMetrics() → Firestore write
        │
        ▼
  perfMetrics/{sessionId}   (1 doc por sesion)
```

La instrumentacion es **pasiva** y **one-shot**: se captura una vez por sesion, se acumula en memoria, y se envia a Firestore en un unico write antes de que el usuario cierre la tab (`visibilitychange`) o tras un timeout de 30s despues de la ultima metrica capturada.

---

## S1.1: Web Vitals — Detalle tecnico

### API: PerformanceObserver (nativa)

No usamos la libreria `web-vitals`. Usamos `PerformanceObserver` directamente para mantener bundle minimo.

| Vital | Observer type | Extraccion |
|-------|--------------|------------|
| LCP | `largest-contentful-paint` | Ultimo entry `.startTime` |
| INP | `event` (con `durationThreshold: 16`) | Mayor `.duration` entre interacciones |
| CLS | `layout-shift` (sin `hadRecentInput`) | Suma de `.value` en sliding window de 5s |
| TTFB | `navigation` | Entry `.responseStart` |

### Thresholds (de Google Web Vitals)

```typescript
export const PERF_THRESHOLDS = {
  lcp:  { green: 2500, red: 4000 },   // ms
  inp:  { green: 200,  red: 500 },    // ms
  cls:  { green: 0.1,  red: 0.25 },   // score
  ttfb: { green: 800,  red: 1800 },   // ms
} as const;
```

### Condiciones de captura

- Solo en produccion (`import.meta.env.PROD`)
- Solo si el usuario tiene `analyticsEnabled: true` (respetando consent)
- Una vez por sesion (flag `sessionCaptured` en memoria)
- No bloquea el hilo principal (observers son pasivos)

---

## S1.2: Firestore Query Timing — Detalle tecnico

### `measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T>`

Wrapper que mide latencia con `performance.now()` antes/despues del `await`. No modifica la logica del fetch, solo registra el tiempo.

```typescript
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const elapsed = performance.now() - start;
  recordQueryTiming(name, elapsed);
  return result;
}
```

### Queries a instrumentar

**IMPORTANTE**: El PRD menciona `useBusinesses` pero ese hook lee de JSON estatico (`businesses.json`), no de Firestore. Lo excluimos de la instrumentacion.

| Query | Archivo | Funcion a wrappear |
|-------|---------|-------------------|
| notifications | `src/services/notifications.ts` | `fetchUserNotifications()` |
| unreadCount | `src/services/notifications.ts` | `getUnreadCount()` |
| userSettings | `src/services/userSettings.ts` | `fetchUserSettings()` |
| paginatedQuery | `src/hooks/usePaginatedQuery.ts` | `getDocs()` dentro de `loadPage` |

### Acumulacion en memoria

```typescript
// Map<queryName, number[]> — array de tiempos en ms
const queryTimings = new Map<string, number[]>();
```

Al momento del flush, se calculan p50/p95/count por query.

---

## S2.1: Coleccion `perfMetrics` — Schema

### Documento

```typescript
interface PerfMetricsDoc {
  sessionId: string;          // crypto.randomUUID()
  userId: string | null;      // auth uid (para dedup, no se muestra)
  timestamp: Timestamp;       // serverTimestamp()
  vitals: {
    lcp: number | null;       // ms
    inp: number | null;       // ms
    cls: number | null;       // score (0-1+)
    ttfb: number | null;      // ms
  };
  queries: Record<string, {
    p50: number;              // ms
    p95: number;              // ms
    count: number;
  }>;
  device: {
    type: 'mobile' | 'desktop';
    connection: string;       // 'wifi' | '4g' | '3g' | 'unknown'
  };
  appVersion: string;         // from package.json version
}
```

### Collection path

`perfMetrics/{sessionId}`

### Firestore Rules

```javascript
match /perfMetrics/{docId} {
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly([
      'sessionId', 'userId', 'timestamp', 'vitals', 'queries', 'device', 'appVersion'
    ])
    && request.resource.data.sessionId is string
    && request.resource.data.timestamp == request.time;
  allow read: if isAdmin();
  allow update, delete: if false;
}
```

- Solo usuarios autenticados pueden escribir (1 vez)
- Solo admin puede leer
- No se permite update ni delete desde client

### Volumen estimado

- ~50-200 docs/dia (1 por sesion activa)
- Retencion: 30 dias (cleanup en Fase 3 con Cloud Function)
- Costo Firestore: despreciable

---

## Archivos a crear/modificar

### Nuevos

| Archivo | Descripcion |
|---------|-------------|
| `src/utils/perfMetrics.ts` | Modulo principal: observers, measureAsync, flush |
| `src/types/perfMetrics.ts` | Tipos TypeScript para PerfMetricsDoc |
| `src/constants/performance.ts` | Thresholds y config de performance |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/services/notifications.ts` | Wrappear `fetchUserNotifications` y `getUnreadCount` con `measureAsync` |
| `src/services/userSettings.ts` | Wrappear `fetchUserSettings` con `measureAsync` |
| `src/hooks/usePaginatedQuery.ts` | Wrappear `getDocs` en `loadPage` con `measureAsync` |
| `src/config/collections.ts` | Agregar `PERF_METRICS: 'perfMetrics'` |
| `src/App.tsx` (o entry point) | Inicializar `initPerfMetrics()` en produccion |
| `firestore.rules` | Agregar reglas para `perfMetrics` |

### NO modificados (clarificacion)

| Archivo | Razon |
|---------|-------|
| `src/hooks/useBusinesses.ts` | Lee JSON estatico, no Firestore |
| `functions/src/**` | Fase 1 es client-side only |
| `src/components/admin/**` | UI es Fase 2 |

---

## Device detection

```typescript
function getDeviceInfo(): { type: 'mobile' | 'desktop'; connection: string } {
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  const connection = nav.connection?.effectiveType ?? 'unknown';
  return { type: mobile ? 'mobile' : 'desktop', connection };
}
```

---

## Flush strategy

1. **`visibilitychange` → hidden**: flush inmediato con `navigator.sendBeacon` fallback a Firestore `addDoc`
2. **Timeout 30s** despues de la ultima vital capturada: flush preventivo
3. **Una sola vez**: flag `flushed` previene duplicados
4. **Minimo de datos**: solo flush si al menos 1 vital fue capturada

El flush usa `addDoc` (no `setDoc`) para evitar conflictos. El `sessionId` se genera con `crypto.randomUUID()`.

---

## Analytics events

| Evento | Cuando | Propiedades |
|--------|--------|-------------|
| `perf_vitals_captured` | Al flush exitoso | `lcp, inp, cls, ttfb, device_type` |

Se envia via el analytics existente (`trackEvent`), respetando el consent del usuario.

---

## Testing

- **Unit tests** para `measureAsync`: verificar que retorna el resultado y registra timing
- **Unit tests** para calculo de p50/p95
- **Unit tests** para `getDeviceInfo` con user agent mocks
- **No integration tests** en Fase 1 (las metricas se validan con el emulador en `/test-local`)

---

## Consideraciones

1. **Bundle impact**: ~2KB gzipped (solo PerformanceObserver + addDoc)
2. **Runtime impact**: < 0.01ms por medicion (performance.now es nanosecond-precision)
3. **No hot path**: los observers son event-driven, no polling
4. **Graceful degradation**: si PerformanceObserver no esta disponible, no se captura nada (no error)
5. **Consent**: respeta `analyticsEnabled` del user settings. Si es false, no se instrumenta
