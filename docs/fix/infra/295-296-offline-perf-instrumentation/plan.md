# Plan: #295–#296 Offline Guards + Perf Instrumentation

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-01

---

## Fases de implementacion

### Fase 1: Constantes y utilidades

**Branch:** `fix/295-296-offline-perf-instrumentation`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/feedback.ts` | Agregar `sendError: 'No se pudo enviar el feedback. Intentá de nuevo.'` al objeto `MSG_FEEDBACK` |

---

### Fase 2: #295 — Offline guards frontend

| Paso | Archivo | Cambio |
|------|---------|--------|
| 2 | `src/components/profile/FeedbackForm.tsx` | En `handleSubmit`: mover el guard `if (isOffline) return;` al tope (después de `if (!user || !message.trim()) return`). En el `catch`: reemplazar `if (import.meta.env.DEV) logger.error(...)` por `logger.error(...)` + `toast.error(MSG_FEEDBACK.sendError)`. En el botón "Enviar": cambiar `disabled` de `isSubmitting \|\| !message.trim() \|\| (isOffline && !!mediaFile)` a `isSubmitting \|\| !message.trim() \|\| isOffline`. Agregar import de `MSG_FEEDBACK` si no está ya presente en el scope de `FeedbackSender`. |
| 3 | `src/context/NotificationsContext.tsx` | Agregar `import { useConnectivity } from './ConnectivityContext'`. Dentro de `NotificationsProvider`, agregar `const { isOffline } = useConnectivity()`. En `markRead`: agregar `if (isOffline) return;` como primera línea. En `markAllRead`: agregar `if (isOffline) return;` como primera línea (antes del guard `if (!uid)`). Agregar `isOffline` al array de deps de ambos `useCallback`. |
| 4 | `src/utils/perfMetrics.ts` | En `flushPerfMetrics`: agregar `if (!navigator.onLine) return;` después de `if (!sessionId) return;` (línea 161). |

---

### Fase 3: #296 — measureAsync en servicios frontend

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `src/services/businessData.ts` | Agregar `import { measureAsync } from '../utils/perfMetrics'`. En `fetchUserLikes`: envolver el `Promise.all(batches.map(...))` con `measureAsync('businessData.userLikes', () => Promise.all(...))`. En `fetchSingleCollection`: envolver el cuerpo de cada case con `measureAsync('businessData.{case}', () => ...)` (cases: favorites, ratings, comments, userTags, customTags, priceLevels, menuPhotos). En `fetchBusinessData`: envolver el `Promise.all([...])` con `measureAsync('businessData.fetchAll', () => Promise.all([...]))`. |
| 6 | `src/services/ratings.ts` | Agregar `import { measureAsync } from '../utils/perfMetrics'`. En `upsertRating`: envolver `getDoc(ratingRef)` con `measureAsync('ratings.getExisting', () => getDoc(ratingRef))`. En `fetchUserRatings` (si existe): envolver `getDocs(...)` con `measureAsync('ratings.fetchUser', () => getDocs(...))`. En `fetchRatingsByBusinessIds` (si existe): envolver la query con `measureAsync('ratings.fetchByBusinessIds', () => ...)`. En `fetchBusinessRatingStats` (si existe): envolver `getCountOfflineSafe(...)` con `measureAsync('ratings.count', () => getCountOfflineSafe(...))`. |

---

### Fase 4: #296 — trackFunctionTiming en Cloud Function triggers

El patrón para cada trigger es:

```typescript
import { trackFunctionTiming } from '../utils/perfTracker';

export const onXxxCreated = onDocumentCreated('...', async (event) => {
  const startMs = performance.now();
  const db = getDb();
  // ... lógica existente sin cambios ...
  await trackFunctionTiming('onXxxCreated', startMs);
});
```

La llamada a `trackFunctionTiming` va al **final del bloque try principal**, antes de cualquier `return` temprano por rate-limit ya existente. Nunca en el bloque de rate-limit (ese path no representa latencia normal del trigger).

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `functions/src/triggers/checkins.ts` | Agregar import `trackFunctionTiming`. Al final de `onCheckInCreated` (después de `trackWrite`): `await trackFunctionTiming('onCheckInCreated', startMs)`. Al final de `onCheckInDeleted`: `await trackFunctionTiming('onCheckInDeleted', startMs)`. Agregar `const startMs = performance.now()` al inicio de cada handler. |
| 8 | `functions/src/triggers/commentLikes.ts` | Mismo patrón para cada handler exportado. Nombres: `'onCommentLikeCreated'`, `'onCommentLikeDeleted'`. |
| 9 | `functions/src/triggers/customTags.ts` | Nombres: `'onCustomTagCreated'`, `'onCustomTagDeleted'`. |
| 10 | `functions/src/triggers/favorites.ts` | Nombres: `'onFavoriteCreated'`, `'onFavoriteDeleted'`. |
| 11 | `functions/src/triggers/feedback.ts` | Nombre: `'onFeedbackCreated'`. |
| 12 | `functions/src/triggers/follows.ts` | Nombres: `'onFollowCreated'`, `'onFollowDeleted'`. |
| 13 | `functions/src/triggers/listItems.ts` | Nombres: `'onListItemCreated'`, `'onListItemDeleted'`. |
| 14 | `functions/src/triggers/menuPhotos.ts` | Nombres: `'onMenuPhotoCreated'`, `'onMenuPhotoUpdated'`. |
| 15 | `functions/src/triggers/priceLevels.ts` | Nombre: `'onPriceLevelWritten'`. |
| 16 | `functions/src/triggers/recommendations.ts` | Nombres: `'onRecommendationCreated'`, `'onRecommendationDeleted'`. |
| 17 | `functions/src/triggers/userSettings.ts` | Nombre: `'onUserSettingsWritten'`. |
| 18 | `functions/src/triggers/users.ts` | Nombre: `'onUserCreated'`. |
| 19 | `functions/src/triggers/userTags.ts` | Nombres: `'onUserTagCreated'`, `'onUserTagDeleted'`. |

---

### Fase 5: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 20 | `src/services/feedback.test.ts` | Agregar test: `sendFeedback` propaga el error de `addDoc` para que el catch del componente lo reciba (verificar que el error no se traga en el service). |
| 21 | `src/services/businessData.test.ts` (nuevo) | Mock `measureAsync` con `vi.mock('../utils/perfMetrics', () => ({ measureAsync: vi.fn((_: string, fn: () => unknown) => fn()) }))`. Verificar que `fetchBusinessData` llama `measureAsync` con `'businessData.fetchAll'`. Verificar que `fetchSingleCollection` llama `measureAsync` con el nombre correcto para cada case. |
| 22 | `src/services/ratings.test.ts` (nuevo o extender) | Mock `measureAsync`. Verificar que `upsertRating` llama `measureAsync('ratings.getExisting', ...)`. Verificar que las funciones de lectura llaman measureAsync con sus nombres correctos. |
| 23 | `src/utils/perfMetrics.test.ts` (extender existente o nuevo) | Verificar que cuando `navigator.onLine = false` (mock), `flushPerfMetrics` no llama a `httpsCallable`. Mock: `Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })`. |
| 24 | `functions/src/triggers/checkins.test.ts` (nuevo) | Mock `trackFunctionTiming` de `../utils/perfTracker`. Verificar que `onCheckInCreated` llama `trackFunctionTiming('onCheckInCreated', expect.any(Number))`. Este test sirve como patrón de referencia; los demás triggers siguen el mismo patrón. |

---

### Fase 6: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 25 | `docs/reference/patterns.md` | Agregar nota en la tabla de "Queries y cache": `measureAsync` ahora cubre `businessData.ts` y `ratings.ts` además de `userSettings` y `notifications`. Agregar nota en sección de Cloud Functions si existe, o en una nueva fila de la tabla de patrones: `trackFunctionTiming` cubre los 15/15 triggers. |
| 26 | `docs/reference/features.md` | No aplica — no hay cambio de funcionalidad visible al usuario. |
| 27 | `docs/reference/firestore.md` | No aplica — sin cambios de esquema. |
| 28 | `docs/reference/security.md` | No aplica — sin cambios de rules ni auth. |

---

## Orden de implementacion

1. Fase 1 (constantes) — base para las fases de UI.
2. Fase 2 (offline guards) — las tres superficies son independientes entre sí.
3. Fase 3 (measureAsync servicios) — independiente de Fase 2.
4. Fase 4 (triggers CF) — todos los triggers son independientes entre sí; se pueden editar en paralelo.
5. Fase 5 (tests) — después de implementar cada cambio.
6. Fase 6 (docs) — al final, una vez que los tests pasen.

---

## Riesgos

1. **`isOffline` en NotificationsContext deps array**: Si `isOffline` cambia con alta frecuencia (por ejemplo, en conexiones inestables), los `useCallback` de `markRead` y `markAllRead` se recrean. El impacto es mínimo porque ya ocurre con `toast` en el array. El contexto ya está memoizado con `useMemo`. Mitigacion: verificar que el `value` del contexto no cause re-renders en cascada en pruebas manuales.

2. **Posicion de `trackFunctionTiming` en triggers con rate-limit early return**: Si el `startMs` se define después del check de rate-limit en algún trigger, el timing no se registrará en ese path (correcto). Verificar que `const startMs = performance.now()` quede como **primera línea** del handler en cada trigger, antes de cualquier lógica condicional.

3. **measureAsync en fetchSingleCollection con switch/case**: Los cases retornan directamente. El wrapping con `measureAsync` requiere que cada case pase la función como callback, no await el resultado directamente. Verificar que TypeScript infiera correctamente el tipo de retorno de cada case (uniones de tipos parciales).

---

## Guardrails de modularidad

- [x] Ningún componente nuevo importa `firebase/firestore` directamente
- [x] No se crean archivos nuevos de componentes — todos los cambios son en archivos existentes
- [x] Lógica de guard offline en context/hook/utils, no inline en componente (excepción justificada: el disabled del button en FeedbackForm es presentacional, la lógica real está en el guard del handler)
- [x] Sin deuda técnica nueva — el fix de FeedbackForm elimina el silent catch existente
- [x] Ningún archivo resultante supera 400 líneas (ver tabla en specs)

---

## Guardrails de seguridad

- [x] Sin colecciones nuevas → no aplican checks de hasOnly/rate-limit
- [x] `trackFunctionTiming` es best-effort (try/catch interno) — no puede romper un trigger
- [x] `measureAsync` no hace writes, solo acumula métricas en memoria
- [x] Guard `navigator.onLine` no expone datos ni bypasea auth
- [x] `getCountOfflineSafe` — ya se usa en el código existente; no se introduce `getCountFromServer` raw

---

## Guardrails de accesibilidad y UI

- [x] El botón "Enviar" ya es `fullWidth variant="contained"` — touch target correcto
- [x] No se introducen IconButtons nuevos
- [x] El estado `disabled` de MUI ya aplica estilos visuales apropiados
- [x] No hay `<Typography onClick>` nuevo

---

## Guardrails de copy

- [x] "No se pudo enviar el feedback. Intentá de nuevo." — voseo correcto ("Intentá")
- [x] Sin tildes faltantes en el texto nuevo
- [x] No se modifican otros textos visible al usuario

---

## Criterios de done

- [ ] `FeedbackForm`: botón "Enviar" deshabilitado cuando `isOffline` (sin adjunto)
- [ ] `FeedbackForm`: `catch` en `handleSubmit` muestra `toast.error` incondicionalmente
- [ ] `NotificationsContext.markRead`: guard `isOffline` evita optimistic update y toast ruidoso
- [ ] `NotificationsContext.markAllRead`: guard `isOffline` evita optimistic update y toast ruidoso
- [ ] `perfMetrics.flushPerfMetrics`: guard `navigator.onLine` evita llamada httpsCallable offline
- [ ] Los 13 triggers tienen `trackFunctionTiming` al final de su handler principal
- [ ] `businessData.ts`: `fetchBusinessData`, `fetchSingleCollection`, `fetchUserLikes` instrumentadas con `measureAsync`
- [ ] `ratings.ts`: funciones de lectura instrumentadas con `measureAsync`
- [ ] Tests pasan con >= 80% coverage en código nuevo
- [ ] No hay lint errors (`npm run lint`)
- [ ] Build succeeds (`npm run build` + `cd functions && npm run build`)
- [ ] Docs actualizados (patterns.md)
- [ ] Commit con mensaje descriptivo que menciona #295 y #296
