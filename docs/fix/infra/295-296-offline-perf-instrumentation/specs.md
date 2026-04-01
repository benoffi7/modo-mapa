# Specs: #295–#296 Offline Guards + Perf Instrumentation

**Issues:** [#295](https://github.com/...) · [#296](https://github.com/...)
**Fecha:** 2026-04-01

---

## Alcance

Dos issues de infra agrupados por branch compartida `fix/295-296-offline-perf-instrumentation`:

- **#295** — Tres superficies sin guard offline: `FeedbackForm` (falla silenciosa), `NotificationsContext.markRead/markAllRead` (optimistic revert con toast ruidoso), `perfMetrics.flushPerfMetrics` (llamada a httpsCallable sin `navigator.onLine`).
- **#296** — 13 de 15 triggers de Cloud Functions sin `trackFunctionTiming`. `businessData.ts` y `ratings.ts` (servicios de mayor tráfico) sin `measureAsync`.

---

## Modelo de datos

No se introducen colecciones nuevas ni se modifican esquemas de Firestore. Todos los cambios son de comportamiento de código existente.

---

## Firestore Rules

No se requieren cambios en `firestore.rules`.

### Rules impact analysis

No hay queries nuevas en esta implementación.

| Query (service file) | Collection | Auth context | Rule que la permite | Cambio necesario? |
|---------------------|------------|-------------|-------------------|----------------|
| (ninguna nueva) | — | — | — | No |

### Field whitelist check

No se agregan campos a ninguna colección.

| Collection | Campo nuevo/modificado | En create `hasOnly()`? | En update `affectedKeys().hasOnly()`? | Cambio necesario? |
|-----------|----------------------|----------------------|--------------------------------------|-------------------|
| (ninguno) | — | — | — | No |

---

## Cloud Functions

### #296 — `trackFunctionTiming` en triggers

Los triggers siguientes carecen actualmente del wrap de instrumentación. El patrón ya establecido en `comments.ts` y `ratings.ts` es:

```typescript
const startMs = performance.now();
// ... lógica existente del trigger ...
await trackFunctionTiming('onXxxYyy', startMs);
```

La llamada a `trackFunctionTiming` va en el bloque `finally` (o al final del `try`, antes del `return`) para garantizar que registra incluso si el trigger termina por rate-limit.

**Triggers a instrumentar** (13 en total):

| Archivo trigger | Función exportada(s) | Nombre para trackFunctionTiming |
|-----------------|---------------------|-------------------------------|
| `checkins.ts` | `onCheckInCreated`, `onCheckInDeleted` | `onCheckInCreated`, `onCheckInDeleted` |
| `commentLikes.ts` | exportadas | `onCommentLikeCreated`, `onCommentLikeDeleted` |
| `customTags.ts` | exportadas | `onCustomTagCreated`, `onCustomTagDeleted` |
| `favorites.ts` | exportadas | `onFavoriteCreated`, `onFavoriteDeleted` |
| `feedback.ts` | exportadas | `onFeedbackCreated` |
| `follows.ts` | exportadas | `onFollowCreated`, `onFollowDeleted` |
| `listItems.ts` | exportadas | `onListItemCreated`, `onListItemDeleted` |
| `menuPhotos.ts` | exportadas | `onMenuPhotoCreated`, `onMenuPhotoUpdated` |
| `priceLevels.ts` | exportadas | `onPriceLevelWritten` |
| `recommendations.ts` | exportadas | `onRecommendationCreated`, `onRecommendationDeleted` |
| `userSettings.ts` | exportadas | `onUserSettingsWritten` |
| `users.ts` | exportadas | `onUserCreated` |
| `userTags.ts` | exportadas | `onUserTagCreated`, `onUserTagDeleted` |

El trigger `authBlocking.ts` es de tipo `beforeUserCreated`/`beforeSignIn` y no sigue el mismo patrón de counters; queda fuera del alcance.

---

## Componentes

### #295 — FeedbackForm: guard offline + toast en catch

**Archivo:** `src/components/profile/FeedbackForm.tsx`

**Problema actual:** El botón "Enviar" solo desactiva el submit si `isOffline && !!mediaFile` (línea 240). Si el usuario está offline sin adjunto, el formulario intenta enviar, `addDoc` falla silenciosamente (el `catch` en línea 89 solo loguea en DEV) y el usuario no recibe ningún feedback.

**Cambios:**

1. Expandir el `disabled` del botón a `isSubmitting || !message.trim() || isOffline`:
   - Esto bloquea el intento de envío en todos los casos offline, no solo cuando hay adjunto.

2. Agregar `toast.error(MSG_FEEDBACK.sendError)` en el bloque `catch` de `handleSubmit` (incondicional, no solo en DEV).

3. Agregar `MSG_FEEDBACK.sendError` a `src/constants/messages/feedback.ts`.

**Props interface:** Sin cambios. `FeedbackSender` ya consume `useConnectivity` correctamente.

### Mutable prop audit

| Componente | Prop | Campos editables | Local state necesario? | Parent callback |
|-----------|------|-----------------|----------------------|-----------------|
| FeedbackSender | (sin props de datos mutables) | message, category, mediaFile | Ya usa useState | No aplica |

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "No se pudo enviar el feedback. Intentá de nuevo." | toast.error en FeedbackSender handleSubmit | voseo en "Intentá" |
| (textos de NotificationsContext sin cambio visible — revert silencioso cuando offline) | — | los toasts existentes MSG_COMMON.markReadError y MSG_COMMON.markAllReadError ya son correctos |

---

## Hooks

### #295 — NotificationsContext: guard isOffline en markRead / markAllRead

**Archivo:** `src/context/NotificationsContext.tsx`

`NotificationsContext` actualmente no importa `useConnectivity`. Las funciones `markRead` y `markAllRead` hacen actualización optimista y luego llaman a Firestore. Offline, la actualización optimista aplica, Firestore falla, y el revert dispara un `toast.error` que confunde al usuario (la acción simplemente no es posible offline).

**Cambios:**

1. Importar `useConnectivity` de `../../context/ConnectivityContext` (o la ruta relativa correcta desde `context/`).
2. Extraer `isOffline` del hook.
3. En `markRead`: agregar guard `if (isOffline) return;` antes de la actualización optimista.
4. En `markAllRead`: agregar guard `if (isOffline) return;` antes de la actualización optimista.

El guard `if (!uid) return;` ya existe en `markAllRead`; en `markRead` no existe pero tampoco hace falta (si no hay uid no habrá notificaciones). El guard offline va primero en ambos.

**Dependencias del useCallback:** Agregar `isOffline` al array de deps de `markRead` y `markAllRead`.

### #295 — perfMetrics: guard navigator.onLine en flushPerfMetrics

**Archivo:** `src/utils/perfMetrics.ts`

**Problema:** `flushPerfMetrics` (línea 158) llama a `httpsCallable(functions, 'writePerfMetrics')` sin verificar conectividad. Offline esto lanza un error que queda atrapado en el `catch` vacío, pero resetea `flushed = false` (línea 191), provocando que al recuperar la conexión el flush se intente de nuevo correctamente. El riesgo real es que en dispositivos con conexiones intermitentes se generan llamadas httpsCallable innecesarias.

**Cambio:**

```typescript
async function flushPerfMetrics(): Promise<void> {
  if (flushed) return;
  if (!sessionId) return;
  if (!navigator.onLine) return;   // <-- agregar esta línea
  // ... resto sin cambios
}
```

La ubicación es entre el guard `if (!sessionId)` y el guard `if (!hasVitals)`.

---

## Servicios

### #296 — measureAsync en businessData.ts

**Archivo:** `src/services/businessData.ts`

`fetchBusinessData` ejecuta 7 queries en `Promise.all`. Se instrumenta el bloque completo como una unidad (latencia total percibida por el usuario) y además cada colección individual dentro de `fetchSingleCollection`.

**Cambios:**

1. Importar `measureAsync` de `../utils/perfMetrics`.
2. En `fetchBusinessData`: envolver el `Promise.all` completo con `measureAsync('businessData.fetchAll', () => Promise.all([...]))`.
3. En `fetchSingleCollection`: envolver cada caso del `switch` con `measureAsync('businessData.{col}', () => ...)` donde `{col}` es el nombre del case.
4. En `fetchUserLikes`: envolver el `Promise.all` con `measureAsync('businessData.userLikes', () => ...)`.

### #296 — measureAsync en ratings.ts

**Archivo:** `src/services/ratings.ts`

Las funciones con lecturas Firestore (`upsertRating` hace un `getDoc` interno, `fetchUserRatings`, `fetchRatingsByBusinessIds`, `fetchBusinessRatingStats`) se instrumentan individualmente.

**Cambios:**

1. Importar `measureAsync` de `../utils/perfMetrics`.
2. En `upsertRating`: envolver el `getDoc` inicial con `measureAsync('ratings.getExisting', () => getDoc(ratingRef))`.
3. En funciones de lectura (`fetchUserRatings`, `fetchRatingsByBusinessIds`, `fetchBusinessRatingStats`): envolver el `getDocs`/`getCountOfflineSafe` con `measureAsync('ratings.{fnName}', () => ...)`.

---

## Integracion

### #295 — FeedbackForm

`FeedbackSender` ya importa `useConnectivity` y ya tiene `isOffline` disponible (línea 36). Solo se modifica el `disabled` prop del botón y el `catch`.

### #295 — NotificationsContext

El proveedor ya tiene acceso a `useToast`. Se agrega `useConnectivity` como nuevo import y hook call dentro de `NotificationsProvider`.

### #295 — perfMetrics

Módulo standalone sin React. Solo se agrega una línea de guard.

### #296 — triggers CF

Cada trigger recibe un import de `trackFunctionTiming` y una llamada al final de su handler principal. Los triggers que exportan múltiples funciones (ej. created + deleted) instrumentan cada función por separado.

### #296 — businessData.ts / ratings.ts

Agregar import de `measureAsync` (ya disponible en el mismo módulo que usa `userSettings.ts` y `notifications.ts`). Sin cambios de interfaz pública.

### Preventive checklist

- [x] **Service layer**: Ningún componente nuevo importa `firebase/firestore` directamente — los cambios son todos en servicios/hooks/utils existentes.
- [x] **Duplicated constants**: `MSG_FEEDBACK.sendError` es una constante nueva, no duplicada.
- [x] **Context-first data**: No aplica — no se introducen queries nuevas.
- [x] **Silent .catch**: El fix de #295 en `FeedbackForm` elimina precisamente el silent catch.
- [x] **Stale props**: No aplica — no hay componentes nuevos con props mutables.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/feedback.test.ts` | Verificar que `sendFeedback` propaga errores (para que el catch del componente los reciba) | Unitario |
| `src/services/businessData.test.ts` | Verificar que `fetchBusinessData` llama `measureAsync` para cada query; mock `measureAsync` y confirmar que se llama con los nombres correctos | Unitario |
| `src/services/ratings.test.ts` | Verificar que las funciones de lectura llaman `measureAsync` | Unitario |
| `src/utils/perfMetrics.test.ts` (nuevo o extender existente) | Verificar que `flushPerfMetrics` no llama a `writePerfMetrics` cuando `navigator.onLine = false` | Unitario |
| `functions/src/triggers/checkins.test.ts` (nuevo) | Verificar que `onCheckInCreated` llama `trackFunctionTiming` con `'onCheckInCreated'`; patrón de referencia para los otros triggers | Unitario CF |

El mock de `measureAsync` en servicios ya tiene precedente en `src/services/userSettings.test.ts`:
```typescript
vi.mock('../utils/perfMetrics', () => ({ measureAsync: (_: string, fn: () => unknown) => fn() }));
```

---

## Analytics

No se agregan eventos nuevos. `trackFunctionTiming` escribe en `config/perfCounters` (ya existente). `measureAsync` registra en `queryTimings` del módulo `perfMetrics` (ya existente, se lee en `flushPerfMetrics`).

---

## Offline

### #295 — Estrategia explícita

| Superficie | Comportamiento anterior | Comportamiento nuevo |
|-----------|------------------------|---------------------|
| FeedbackForm submit | Intenta envío, falla silenciosamente | Botón deshabilitado offline; catch muestra toast |
| markRead / markAllRead | Optimistic update → Firestore falla → revert → toast ruidoso | Guard offline early return, sin optimistic, sin toast |
| perfMetrics flush | Llama httpsCallable offline | Guard `navigator.onLine` previene la llamada |

### Cache strategy

No aplica — no se introducen datos cacheables nuevos.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| sendFeedback | Bloqueada (disabled button) | No aplica |
| markRead/markAllRead | No-op silencioso | No aplica |
| writePerfMetrics | Guard navigator.onLine | Las métricas se retienen en módulo state; flush se reintenta al siguiente visibilitychange |

### Fallback UI

`FeedbackSender`: el botón ya muestra estado `disabled` visualmente (MUI). No se agrega texto adicional de estado offline en este fix (fuera de scope del issue).

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| FeedbackSender (Enviar button) | Button fullWidth | Heredado del texto del botón | Cumple (fullWidth) | toast.error en catch |

No se introducen IconButtons nuevos. Sin cambios de layout.

---

## Decisiones tecnicas

### #295 — Deshabilitar submit vs. queuing offline

Se optó por deshabilitar el botón (consistent con el comportamiento existente para `mediaFile` offline) en lugar de encolar el feedback en la offline queue. Razones:
- El feedback ya tiene un bloque de texto largo que el usuario escribió con intención de enviar en ese momento.
- La offline queue (`offlineQueue.ts`) está diseñada para operaciones cortas idempotentes (toggles, likes). El feedback con adjunto no es idempotente.
- Agregar feedback a la queue requeriría serializar `File` (no soportado en IndexedDB trivialmente).

### #295 — Guard en markRead antes vs. después de optimistic update

Se coloca el guard `if (isOffline) return` **antes** de la actualización optimista para evitar una actualización de UI que inmediatamente se revierte. El revert actual produce un flicker perceptible en listas de notificaciones.

### #296 — measureAsync en fetchBusinessData: granularidad

Se mide tanto el `Promise.all` completo como cada colección individual porque:
- El total (p50/p95 del Promise.all) responde "¿cuánto tarda abrir un comercio?".
- Los individuales permiten identificar qué colección es el cuello de botella cuando la latencia total sube.

### #296 — trackFunctionTiming: posición finally vs. end-of-try

Se usa end-of-try (antes del `return`) en lugar de `finally` porque:
- Los triggers que llaman `snap.ref.delete()` por rate limit y hacen `return` temprano no deben registrar el timing de esa rama (sería engañoso incluirla en los percentiles de latencia normal).
- Esto sigue el patrón ya establecido en `comments.ts`.

---

## Hardening de seguridad

No se introducen superficies nuevas. Sin cambios en rules ni en vectores de ataque existentes.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Spam de httpsCallable writePerfMetrics desde clientes offline con reconexión rápida | Guard navigator.onLine previene llamadas innecesarias | `src/utils/perfMetrics.ts` |

---

## Deuda tecnica: mitigacion incorporada

```bash
gh issue list --label security --state open --json number,title
# => []
gh issue list --label "tech debt" --state open --json number,title
# => []
```

Sin issues de deuda técnica abiertos que apliquen a los archivos tocados.

---

## Estimacion de tamaño de archivos resultantes

| Archivo | Lineas actuales | Delta estimado | Lineas resultantes |
|---------|----------------|---------------|-------------------|
| `src/components/profile/FeedbackForm.tsx` | 268 | +3 | ~271 |
| `src/context/NotificationsContext.tsx` | 154 | +7 | ~161 |
| `src/utils/perfMetrics.ts` | 193 | +1 | ~194 |
| `src/constants/messages/feedback.ts` | 4 | +1 | ~5 |
| `src/services/businessData.ts` | 156 | +12 | ~168 |
| `src/services/ratings.ts` | 140 | +8 | ~148 |
| `functions/src/triggers/checkins.ts` | 76 | +5 | ~81 |
| `functions/src/triggers/commentLikes.ts` | 89 | +5 | ~94 |
| `functions/src/triggers/customTags.ts` | 82 | +5 | ~87 |
| `functions/src/triggers/favorites.ts` | 60 | +4 | ~64 |
| `functions/src/triggers/feedback.ts` | 55 | +4 | ~59 |
| `functions/src/triggers/follows.ts` | 140 | +5 | ~145 |
| `functions/src/triggers/listItems.ts` | 42 | +4 | ~46 |
| `functions/src/triggers/menuPhotos.ts` | 92 | +5 | ~97 |
| `functions/src/triggers/priceLevels.ts` | 35 | +4 | ~39 |
| `functions/src/triggers/recommendations.ts` | 77 | +5 | ~82 |
| `functions/src/triggers/userSettings.ts` | 24 | +4 | ~28 |
| `functions/src/triggers/users.ts` | 22 | +4 | ~26 |
| `functions/src/triggers/userTags.ts` | 47 | +5 | ~52 |

Ningún archivo supera 400 líneas.
