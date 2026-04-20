# Specs: Performance — bundle splits + Firestore waterfalls

**Feature:** 302-performance-bundle-waterfalls
**Issue:** #302
**PRD:** [prd.md](./prd.md)

---

## Contexto tecnico

Optimizaciones de performance identificadas en `/health-check` 2026-04-18. Afecta 6 areas: bundle splits (recharts + admin lazy), Firestore waterfalls, y 4 micro-optimizations de re-render. Se abordan todas en una misma PR porque comparten archivos y tests.

---

## Archivos afectados

### Modificados (frontend)

| Archivo | Cambio |
|---------|--------|
| `src/components/stats/index.ts` | Split export: `TopList` eager, `PieChartCard` solo via lazy |
| `src/components/profile/StatsView.tsx` | `PieChartCard` pasa a `React.lazy` con Suspense |
| `src/services/businessData.ts` | `fetchBusinessData` paraleliza commentLikes via query directa; `fetchUserLikes` deprecado (solo se mantiene para migracion) |
| `src/services/comments.ts` | `likeComment` acepta `businessId` y lo escribe al doc |
| `src/hooks/useCommentListBase.ts` | Pasa `businessId` a `likeComment` |
| `src/services/syncEngine.ts` | Payload offline de `comment_like` incluye `businessId` |
| `src/types/offline.ts` | `CommentLikeOfflinePayload` agrega `businessId: string` |
| `src/components/admin/AdminLayout.tsx` | `TrendsPanel`, `FirebaseUsage`, `PerformancePanel`, `FeaturesPanel` → `React.lazy` con Suspense |
| `src/components/search/SearchListView.tsx` | `BusinessRow` wrappeado en `React.memo`; sort con distance precomputada |
| `src/components/home/SpecialsSection.tsx` | Cache modulo-level para `getBusinessesForSpecial` |
| `src/utils/businessHelpers.ts` | `getBusinessName` usa `getBusinessMap()` |
| `src/components/user/UserProfileContent.tsx` | `allBusinesses.find` → `getBusinessMap().get` |
| `src/components/admin/FeedbackList.tsx` | Idem |
| `src/components/admin/PhotoReviewCard.tsx` | Idem |
| `src/components/admin/FeaturedListsPanel.tsx` | Idem |
| `src/components/home/TrendingList.tsx` | Usar `getBusinessMap()` en vez de Map local |
| `src/components/home/TrendingNearYouSection.tsx` | Idem |

### Modificados (backend)

| Archivo | Cambio |
|---------|--------|
| `functions/src/triggers/commentLikes.ts` | `onCommentLikeCreated` valida `businessId` presente (defensa en profundidad) |
| `firestore.rules` | `commentLikes` create rule agrega `businessId` al `hasOnly()` + validaciones tipo/size |
| `firestore.indexes.json` | Indice compuesto `commentLikes(userId, businessId)` |

### Nuevos

| Archivo | Proposito |
|---------|-----------|
| `src/utils/businessMap.ts` | Singleton `getBusinessMap()` memoizado |
| `src/utils/businessMap.test.ts` | Tests del singleton |
| `src/components/ui/AdminPanelLoader.tsx` | Fallback spinner para Suspense de admin |

### Docs

| Archivo | Cambio |
|---------|--------|
| `docs/reference/firestore.md` | `commentLikes` — agregar campo `businessId` |
| `docs/reference/patterns.md` | Nuevo patron "Singleton businessMap" |
| `docs/reference/features.md` | (sin cambios, solo perf) |

---

## Modelo de datos

### `commentLikes` — nuevo campo

```typescript
interface CommentLike {
  userId: string;
  commentId: string;
  businessId: string;  // NUEVO — para query directa sin waterfall
  createdAt: Date;
}
```

Doc ID sigue siendo `{userId}__{commentId}`.

**Backfill**: los docs existentes no tienen `businessId`. Opciones:

1. **Cloud Function one-shot** (`backfillCommentLikes`, admin callable) que lee todos los `commentLikes`, agrupa por `commentId`, obtiene `businessId` de `comments/{commentId}`, y actualiza en batch (max 500 por batch).
2. **Fallback defensivo**: si `fetchBusinessData` con la query nueva devuelve 0 likes para comments que el usuario podria haber likeado, caer a `fetchUserLikes` legacy. Esto agrega complejidad temporal.

**Se opta por Opcion 1**: callable `backfillCommentLikes` admin-only, ejecutar 1 vez post-deploy, documentar en plan.md. `fetchUserLikes` legacy se borra en la misma PR.

### Firestore rule change

```javascript
match /commentLikes/{docId} {
  allow read: if (request.auth != null && resource.data.userId == request.auth.uid)
              || isAdmin();
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['userId', 'commentId', 'businessId', 'createdAt'])
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.commentId is string
    && request.resource.data.commentId.size() > 0
    && request.resource.data.commentId.size() <= 128
    && request.resource.data.businessId is string
    && request.resource.data.businessId.size() > 0
    && request.resource.data.businessId.size() <= 50
    && request.resource.data.createdAt == request.time;
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

### Firestore index

```json
{
  "collectionGroup": "commentLikes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "businessId", "order": "ASCENDING" }
  ]
}
```

---

## Cambios de codigo

### S1 — Split recharts

**`src/components/stats/index.ts`** (actual):

```typescript
export { default as PieChartCard } from './PieChartCard';
export { default as TopList } from './TopList';
```

**Nuevo**:

```typescript
// Eager: TopList (MUI puro, ~1KB)
export { default as TopList } from './TopList';
// PieChartCard NO se exporta aqui — usar React.lazy desde consumer
// export type solo para tipos (no arrastra recharts):
export type { PieChartCardProps } from './PieChartCard';
```

**`src/components/profile/StatsView.tsx`**: cambiar import a lazy.

```typescript
import { lazy, Suspense } from 'react';
import { TopList } from '../stats';
const PieChartCard = lazy(() => import('../stats/PieChartCard'));

// ... en render:
<Suspense fallback={<Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box>}>
  <PieChartCard title="Distribución de Ratings" data={ratingPieData} />
  <PieChartCard title="Tags más usados" data={tagsPieData} />
</Suspense>
```

**Verificar consumers adicionales de `PieChartCard`**:

```bash
grep -rn "from '.*stats'" src/ | grep PieChartCard
```

Si hay otros (ej: admin panels), aplicar mismo patron.

### S2 — Paralelizar fetchUserLikes

**Antes** (`services/businessData.ts:106-156`):

```typescript
const [fav, ratings, comments, ...] = await Promise.all([...]);
// Waterfall:
const userCommentLikes = await fetchUserLikes(uid, commentsResult.map((c) => c.id));
```

**Despues**:

```typescript
const [favSnap, ratingsSnap, commentsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap, userLikesSnap] = await Promise.all([
  // ... los 7 existentes ...
  // NUEVA query directa, en paralelo:
  getDocs(query(
    collection(db, COLLECTIONS.COMMENT_LIKES),
    where('userId', '==', uid),
    where('businessId', '==', bId),
  )),
]);

const userCommentLikes = new Set<string>(
  userLikesSnap.docs.map((d) => (d.data() as { commentId: string }).commentId)
);
```

**Nota**: `fetchSingleCollection` tambien tiene el patron de `fetchUserLikes` en el case `comments` — aplicar misma optimizacion.

**`fetchUserLikes` legacy**: se borra en la misma PR (tras backfill). Sus tests se eliminan.

### S2b — `likeComment` firma

**`src/services/comments.ts`**:

```typescript
export async function likeComment(userId: string, commentId: string, businessId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await setDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId), {
    userId,
    commentId,
    businessId,  // NUEVO
    createdAt: serverTimestamp(),
  });
  trackEvent('comment_like', { comment_id: commentId });
}
```

**Consumers a actualizar**:

- `src/hooks/useCommentListBase.ts:112` — pasar `businessId` (disponible via prop del hook)
- `src/services/syncEngine.ts:79-86` — payload `comment_like` offline incluye `businessId`

**`src/types/offline.ts`**:

```typescript
interface CommentLikeOfflinePayload {
  userId: string;
  commentId: string;
  businessId: string;  // NUEVO
  action: 'like' | 'unlike';
}
```

### S3 — Admin lazy

**`src/components/admin/AdminLayout.tsx`**:

```typescript
import { lazy, Suspense } from 'react';
// Eager (no recharts):
import DashboardOverview from './DashboardOverview';
import ActivityFeed from './ActivityFeed';
import FeedbackList from './FeedbackList';
import UsersPanel from './UsersPanel';
import AbuseAlerts from './AbuseAlerts';
import BackupsPanel from './BackupsPanel';
import PhotoReviewPanel from './PhotoReviewPanel';
import FeaturedListsPanel from './FeaturedListsPanel';
import NotificationsPanel from './NotificationsPanel';
import SocialPanel from './SocialPanel';
import SpecialsPanel from './SpecialsPanel';
import AchievementsPanel from './AchievementsPanel';
import ConfigPanel from './ConfigPanel';
import DeletionAuditPanel from './audit/DeletionAuditPanel';

// Lazy (contienen recharts):
const TrendsPanel = lazy(() => import('./TrendsPanel'));
const FirebaseUsage = lazy(() => import('./FirebaseUsage'));
const PerformancePanel = lazy(() => import('./PerformancePanel'));
const FeaturesPanel = lazy(() => import('./FeaturesPanel'));

// ... en render del Box de contenido:
<Suspense fallback={<AdminPanelLoader />}>
  {tab === 3 && <TrendsPanel />}
  {tab === 6 && <FirebaseUsage />}
  {tab === 11 && <PerformancePanel />}
  {tab === 12 && <FeaturesPanel />}
</Suspense>
// resto de tabs sin Suspense wrapping
```

### S4 — `getBusinessMap` singleton

**`src/utils/businessMap.ts`** (nuevo):

```typescript
import { allBusinesses } from '../hooks/useBusinesses';
import type { Business } from '../types';

let cachedMap: Map<string, Business> | null = null;

export function getBusinessMap(): Map<string, Business> {
  if (cachedMap === null) {
    cachedMap = new Map(allBusinesses.map((b) => [b.id, b]));
  }
  return cachedMap;
}

export function getBusinessById(id: string): Business | undefined {
  return getBusinessMap().get(id);
}

// Para tests — no usar en codigo de produccion
export function __resetBusinessMap(): void {
  cachedMap = null;
}
```

**Refactor de consumers** (6 componentes + 1 hook):

Patron:

```typescript
// ANTES:
const business = allBusinesses.find((b) => b.id === businessId);

// DESPUES:
import { getBusinessById } from '../../utils/businessMap';
const business = getBusinessById(businessId);
```

**Nota**: en `TrendingList` y `TrendingNearYouSection`, reemplazar:

```typescript
const businessMap = useMemo(() => new Map(allBusinesses.map((b) => [b.id, b])), []);
// ... businessMap.get(id)
```

por:

```typescript
import { getBusinessMap } from '../../utils/businessMap';
// ... getBusinessMap().get(id)
```

### S5 — SearchListView memoizacion

**`src/components/search/SearchListView.tsx`**:

```typescript
import { memo, useMemo } from 'react';

const BusinessRow = memo(function BusinessRow({ business, distance, onSelect }: BusinessRowProps) {
  // ... igual que antes
});

// En SearchListView:
const sorted = useMemo(() => {
  const withDistance = businesses.map((b) => ({
    business: b,
    distanceKm: distanceKm(sortLocation.lat, sortLocation.lng, b.lat, b.lng),
  }));
  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  return withDistance.map(({ business, distanceKm: d }) => ({
    business,
    distance: formatDistance(d),
  }));
}, [businesses, sortLocation.lat, sortLocation.lng]);

// Render:
{sorted.map(({ business, distance }) => (
  <BusinessRow key={business.id} business={business} distance={distance} onSelect={setSelectedBusiness} />
))}
```

### S6 — SpecialsSection cache

**`src/components/home/SpecialsSection.tsx`**:

```typescript
// Antes del componente:
const specialBusinessesCache = new Map<string, Business[]>();

function getBusinessesForSpecial(specialId: string): Business[] {
  const cached = specialBusinessesCache.get(specialId);
  if (cached) return cached;

  const seed = specialId.charCodeAt(0) + (specialId.charCodeAt(1) || 0);
  const shuffled = [...allBusinesses].sort((a, b) => {
    const ha = (a.id.charCodeAt(0) * 31 + seed) % 100;
    const hb = (b.id.charCodeAt(0) * 31 + seed) % 100;
    return ha - hb;
  });
  const result = shuffled.slice(0, 10);
  specialBusinessesCache.set(specialId, result);
  return result;
}
```

---

## Integraciones

### Analytics

- Ningun evento nuevo. Los existentes (`comment_like`, `business_view`) siguen igual.

### Error handling

- `fetchBusinessData`: si la query nueva de commentLikes falla (ej: indice aun no construido), el Promise.all falla. Catch en `useBusinessData.load` ya maneja esto y devuelve `error: true`.
- Backfill callable: errores por doc van al log pero no bloquean el batch (idempotente).

### Offline

- `commentLikes` write offline: payload incluye `businessId`. SyncEngine lo aplica al reconectar. Sin cambios en UX.
- Reads: 3-tier cache no cambia (se cachea el resultado ya procesado, no la forma de query).

---

## Tests

### Nuevos

| Archivo | Tests |
|---------|-------|
| `src/utils/businessMap.test.ts` | 4 tests: devuelve Map, misma referencia en llamadas sucesivas, lookup correcto, miss devuelve undefined |
| `functions/src/__tests__/callable/backfillCommentLikes.test.ts` | 3 tests: skip docs con businessId ya seteado, batch update ok, docs con commentId invalido se skippean |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/services/businessData.test.ts` | (no existe actualmente — crear) Tests: `fetchBusinessData` con commentLikes paralelos, sin waterfall |
| `src/services/comments.test.ts` | `likeComment('u1', 'c1', 'biz_001')` incluye businessId en el doc |
| `src/services/syncEngine.test.ts` | payload comment_like incluye businessId |
| `functions/src/__tests__/triggers/commentLikes.test.ts` | Valida businessId presente en create |
| `src/components/search/SearchListView.test.tsx` | (si no existe — no critico) Render count de BusinessRow |

### Mock strategy

- Firestore: mock `getDocs`, `setDoc`, `query`, `where`, `collection`
- `allBusinesses`: mock en `useBusinesses.ts` para tests de businessMap
- `__resetBusinessMap()` en `beforeEach` para tests deterministicos

### Criterio de aceptacion

- Cobertura >= 80% del codigo modificado
- `fetchBusinessData` test verifica que **no hay `await` secuencial** (mockear con delays y assert tiempo total)
- `getBusinessMap` devuelve mismo objeto en llamadas sucesivas

---

## Migracion

### Pasos post-deploy

1. Deploy de firestore.rules + firestore.indexes.json (espera ~5 min para que indice se construya).
2. Deploy de Cloud Functions (incluye `backfillCommentLikes` callable).
3. Deploy de Hosting (frontend con nueva query).
4. Admin ejecuta `backfillCommentLikes` via panel admin o consola (script `scripts/run-backfill.mjs`).
5. Verificar conteo en panel: `commentLikes` con `businessId == null` debe ser 0.
6. Proxima release (v2.36.0): eliminar callable `backfillCommentLikes` (one-shot).

### Rollback

- Si la query nueva falla en prod: revertir frontend (rule queda compatible, acepta con y sin `businessId` si no hacemos strict).
- Rule strict: esta PR **requiere** `businessId` en create. Rollback del frontend sin rollback de rules rompe `likeComment`.
- **Mitigacion**: deploy frontend antes que rules (aprovechar hosting = instant, rules = eventual). Plan preciso en plan.md.

---

## Performance targets

| Metrica | Baseline | Target |
|---------|----------|--------|
| Profile path bundle | ~450KB gross | <=150KB gross (sin recharts) |
| Admin first-paint JS | baseline TBD | -60KB |
| BusinessSheet open (3G mock) | ~1200ms | <=900ms |
| SearchListView re-render (40 items, sortLocation change) | ~40 renders | 1 render + memo hits |

Mediciones via `npm run build` + rollup-plugin-visualizer (si disponible) o manual con Chrome DevTools.

---

## Referencias

- PRD: [prd.md](./prd.md)
- Issue: <https://github.com/benoffi7/modo-mapa/issues/302>
- Patterns: `docs/reference/patterns.md` seccion "Queries y cache"
- Firestore: `docs/reference/firestore.md` — `commentLikes`
