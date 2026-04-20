# Guard: Performance patterns (#302)

**Issue:** [#302](https://github.com/benoffi7/modo-mapa/issues/302)
**PRD:** [../../feat/infra/302-performance-bundle-waterfalls/prd.md](../../feat/infra/302-performance-bundle-waterfalls/prd.md)
**Specs:** [../../feat/infra/302-performance-bundle-waterfalls/specs.md](../../feat/infra/302-performance-bundle-waterfalls/specs.md)
**Status:** Active — aplica desde v2.36.0

---

## Proposito

Este guard previene regresiones de performance identificadas en el `/health-check` 2026-04-18 y resueltas en #302. Los patrones prohibidos abajo reintroducen costos de bundle o waterfalls que ya pagamos antes.

Si necesitas violar una de estas reglas, justificalo en el PR description y actualiza este documento.

---

## Reglas

### 1. Stats barrel no debe arrastrar recharts

**Archivo:** `src/components/stats/index.ts`

El barrel **NO** debe re-exportar componentes que consumen `recharts`. Solo `TopList` (MUI puro) puede salir por el barrel.

- `TopList` → export desde barrel (eager OK, ~1KB)
- `PieChartCard` → importar directo desde consumer via `React.lazy`, nunca desde `../stats`
- Solo se permite `export type { PieChartCardProps }` (los tipos no arrastran el runtime)

**Por que:** `StatsView` (tab Perfil) arrastraba ~374KB de recharts al bundle de usuarios regulares aunque no vieran pie charts.

**Correcto:**

```typescript
// src/components/profile/StatsView.tsx
import { TopList } from '../stats';
const PieChartCard = lazy(() => import('../stats/PieChartCard'));
```

**Incorrecto:**

```typescript
// NO — arrastra recharts al grafo eager
import { PieChartCard, TopList } from '../stats';
```

### 2. Paneles pesados deben ser lazy en el boundary del panel

Paneles con dependencias pesadas (recharts, google-maps, markdown editors, etc.) en admin y profile **MUST** ser `React.lazy`-wrappeados en el boundary del panel, no solo a nivel de ruta.

Aplica a:

- `src/components/admin/AdminLayout.tsx` — `TrendsPanel`, `FirebaseUsage`, `PerformancePanel`, `FeaturesPanel`
- Cualquier panel futuro que importe `recharts`, `@react-google-maps/api`, o libreria >= 20KB

**Por que:** aunque `/admin` ya es una ruta lazy, al entrar el tab default no es Tendencias. Pagamos 60-80KB extra sin necesidad.

**Correcto:**

```typescript
const TrendsPanel = lazy(() => import('./TrendsPanel'));
// ...
<Suspense fallback={<AdminPanelLoader />}>
  {tab === 3 && <TrendsPanel />}
</Suspense>
```

### 3. `fetchUserLikes` debe ser query directa por `businessId`

**Archivo:** `src/services/businessData.ts`

La lectura de `commentLikes` en `fetchBusinessData` **MUST** ser una query directa filtrada por `(userId, businessId)` ejecutada dentro del `Promise.all` principal. Prohibido hacer fan-out por `commentId` post-facto.

Requisitos asociados:

- Campo `businessId` presente en doc `commentLikes` (validado por rule en `firestore.rules`)
- Indice compuesto `commentLikes(userId, businessId)` en `firestore.indexes.json`
- `likeComment(userId, commentId, businessId)` firma con `businessId` obligatorio

**Por que:** el patron viejo `fetchUserLikes(uid, commentIds)` se ejecutaba despues del `Promise.all`, agregando 150-300ms por RTT en 3G.

**Correcto:**

```typescript
const [favSnap, /* ... */, userLikesSnap] = await Promise.all([
  // ... otras queries ...
  getDocs(query(
    collection(db, COLLECTIONS.COMMENT_LIKES),
    where('userId', '==', uid),
    where('businessId', '==', bId),
  )),
]);
```

**Incorrecto:**

```typescript
const [/* ... */, commentsSnap] = await Promise.all([/* ... */]);
// Waterfall — PROHIBIDO
const userCommentLikes = await fetchUserLikes(uid, commentsSnap.docs.map((d) => d.id));
```

### 4. Lookup por businessId usa `getBusinessMap()`

**Archivo util:** `src/utils/businessMap.ts`

Cualquier componente que necesite resolver "business por id" sobre una lista de N businesses **MUST** usar `getBusinessMap().get(id)` (o el helper `getBusinessById(id)`) — nunca `allBusinesses.find((b) => b.id === id)`.

Aplica especialmente a listados: feedback admin, photo review, featured lists, user profile, trending, specials.

**Por que:** `allBusinesses.find()` es O(n) por lookup. En una lista de 40 items renderizando con find() por fila = O(n*m). El Map singleton es O(1) amortizado y compartido entre componentes.

**Correcto:**

```typescript
import { getBusinessById } from '../../utils/businessMap';
const business = getBusinessById(businessId);
```

**Incorrecto:**

```typescript
const business = allBusinesses.find((b) => b.id === businessId);
// o peor: dentro de un .map() sobre una lista
```

**Nota:** si necesitas el Map crudo (ej: para iterar), usa `getBusinessMap()`. No construyas tu propio `new Map(allBusinesses.map(...))` en cada componente — consolidate en el singleton.

### 5. Tabs no-iniciales en `TabShell` deben ser `React.lazy`

**Archivo:** `src/components/shell/TabShell.tsx`

Solo la tab inicial (por defecto Home/Map) puede importarse eager. Las demas tabs (Perfil, Buscar, Comunidad, etc.) **MUST** ir por `React.lazy`.

**Por que:** `TabShell` ya cumple esta regla al momento de #302. Documentamos para que no se regresione al agregar una tab nueva o al "simplificar" importando eager.

**Correcto:**

```typescript
const ProfileScreen = lazy(() => import('../profile/ProfileScreen'));
const SearchScreen = lazy(() => import('../search/SearchScreen'));
```

---

## Patrones de deteccion

Ejecutar como parte del pre-merge review (ver `.claude/agents/performance.md` seccion "Regression checks (#302)").

### Check 1 — Stats barrel

```bash
# El barrel no debe re-exportar PieChartCard como runtime
grep -n "PieChartCard" src/components/stats/index.ts
# Solo deberia aparecer en `export type { PieChartCardProps }`, nunca como `export { default }`

# Verificar que consumers no importen PieChartCard desde el barrel
grep -rn "from '../stats'" src/ | grep -i "PieChartCard"
grep -rn "from '../../components/stats'" src/ | grep -i "PieChartCard"
# Resultado esperado: 0 matches (todos los consumers usan React.lazy directo)
```

### Check 2 — `allBusinesses.find` en src/

```bash
grep -rn "allBusinesses\.find" src/
# Resultado esperado: 0 matches. Toda resolucion debe ser via getBusinessById/getBusinessMap.
```

### Check 3 — Admin panels eager

```bash
grep -n "^import.*Panel.*from.*'\./" src/components/admin/AdminLayout.tsx
# Los panels de recharts (TrendsPanel, FirebaseUsage, PerformancePanel, FeaturesPanel)
# deben aparecer como `const X = lazy(() => import('./X'))`, NO como `import X from './X'`.
```

### Check 4 — fetchUserLikes waterfall

```bash
# La funcion legacy no debe existir mas
grep -rn "fetchUserLikes" src/
# Resultado esperado: 0 matches post-#302.

# Verificar que commentLikes se lee con where('businessId', ...)
grep -rn "COMMENT_LIKES" src/services/businessData.ts
# Debe estar dentro de Promise.all, con where userId + where businessId.
```

### Check 5 — Construccion manual de businessMap

```bash
grep -rn "new Map(allBusinesses" src/
# Resultado esperado: 0 matches en componentes. Solo permitido en src/utils/businessMap.ts.
```

### Check 6 — TabShell tabs eager

```bash
grep -n "^import.*Screen.*from" src/components/shell/TabShell.tsx
# Todas las screens deben estar como `const X = lazy(() => import(...))`.
```

---

## Relacionados

- PRD: [../../feat/infra/302-performance-bundle-waterfalls/prd.md](../../feat/infra/302-performance-bundle-waterfalls/prd.md)
- Specs: [../../feat/infra/302-performance-bundle-waterfalls/specs.md](../../feat/infra/302-performance-bundle-waterfalls/specs.md)
- Plan: [../../feat/infra/302-performance-bundle-waterfalls/plan.md](../../feat/infra/302-performance-bundle-waterfalls/plan.md)
- Patrones: [../patterns.md](../patterns.md) — seccion "Singleton businessMap"
- Agente performance: [../../../.claude/agents/performance.md](../../../.claude/agents/performance.md)
- Issue relacionado #303 perf-instrumentation (complementa con `measureAsync`)
