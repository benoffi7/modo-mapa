# Specs: Service Layer Refactor (#279)

**Issue:** [#279](https://github.com/benoffi7/modo-mapa/issues/279)
**Fecha:** 2026-03-31

---

## Contexto

Seis hooks importan `firebase/firestore` directamente, violando la boundary del service layer definida en `docs/reference/patterns.md`. Dos archivos superan el límite de 400 líneas. Dos componentes admin crean callables inline.

Este documento especifica las firmas exactas de las funciones nuevas/modificadas y la estructura de los sub-componentes resultantes.

---

## Fase 1: Hooks que migran a servicios existentes

Los cuatro hooks de esta fase delegan a servicios que ya existen. Solo se agregan funciones a los servicios y se reescriben los hooks para usarlas.

### 1a. `useProfileStats` → `ratings.ts`, `favorites.ts`, `follows.ts`

**Problema:** El hook construye `query(collection(db, ...), where(...))` y llama `getCountOfflineSafe` directamente.

**Función nueva en `src/services/ratings.ts`:**

```typescript
/**
 * Returns the count of ratings written by userId.
 * Uses getCountOfflineSafe to handle offline gracefully.
 */
export async function fetchUserRatingsCount(userId: string): Promise<number>
```

**Función nueva en `src/services/favorites.ts`:**

```typescript
/**
 * Returns the count of favorites for userId.
 */
export async function fetchUserFavoritesCount(userId: string): Promise<number>
```

**Función nueva en `src/services/follows.ts`:**

```typescript
/**
 * Returns the count of followers (users following userId).
 */
export async function fetchFollowersCount(userId: string): Promise<number>
```

**Hook refactorizado (`src/hooks/useProfileStats.ts`):**

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyCheckIns } from './useMyCheckIns';
import { fetchUserRatingsCount } from '../services/ratings';
import { fetchUserFavoritesCount } from '../services/favorites';
import { fetchFollowersCount } from '../services/follows';

export function useProfileStats(): ProfileStats {
  const { user } = useAuth();
  const { stats: checkInStats } = useMyCheckIns();
  const [counts, setCounts] = useState({ reviews: 0, followers: 0, favorites: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const uid = user.uid;
    Promise.all([
      fetchUserRatingsCount(uid),
      fetchUserFavoritesCount(uid),
      fetchFollowersCount(uid),
    ]).then(([reviews, favorites, followers]) => {
      if (!cancelled) setCounts({ reviews, favorites, followers });
    });
    return () => { cancelled = true; };
  }, [user]);

  return { places: checkInStats.uniqueBusinesses, ...counts };
}
```

Cero imports de `firebase/firestore` en el hook.

---

### 1b. `useRatingPrompt` → `ratings.ts`

**Problema:** El hook hace `getDoc(doc(db, COLLECTIONS.RATINGS, ratingDocId))` en dos lugares (evaluate loop y event handler). Esto es una lectura puntual por composite doc ID.

**Función nueva en `src/services/ratings.ts`:**

```typescript
/**
 * Returns true if a rating exists for the given user/business pair.
 * Uses the composite doc ID pattern: {userId}__{businessId}.
 */
export async function hasUserRatedBusiness(
  userId: string,
  businessId: string,
): Promise<boolean>
```

**Hook refactorizado (`src/hooks/useRatingPrompt.ts`):**

- Eliminar imports: `doc`, `getDoc` de `firebase/firestore`, `db` de `../config/firebase`, `COLLECTIONS`.
- Agregar import: `hasUserRatedBusiness` de `../services/ratings`.
- Reemplazar ambas llamadas `getDoc(doc(db, ...))` por `await hasUserRatedBusiness(user.uid, checkIn.businessId)`.
- Los bloques `try/catch` existentes se mantienen sin cambios.

La lógica de sessionStorage, analytics y timing no cambia.

---

### 1c. `usePriceLevelFilter` → `priceLevels.ts`

**Problema:** El hook construye la query Firestore directamente dentro de `fetchAllPriceLevels()`.

**Función nueva en `src/services/priceLevels.ts`:**

```typescript
/**
 * Fetches all price level docs and returns a map of businessId -> averaged level.
 * Safety bound: fetches at most MAX_PRICE_LEVELS docs.
 */
export async function fetchPriceLevelMap(
  maxDocs?: number,
): Promise<Map<string, number>>
```

La función encapsula la lógica actualmente en `fetchAllPriceLevels()` del hook, incluyendo el groupBy y el average. El hook ya tiene un buen sistema de cache module-level con TTL y deduplicación de promise — ese mecanismo se mantiene intacto, solo la función interna de fetch se delega.

**Hook refactorizado (`src/hooks/usePriceLevelFilter.ts`):**

- Eliminar imports: `collection`, `getDocs`, `query`, `limit` de `firebase/firestore`, `db`, `priceLevelConverter`.
- Agregar import: `fetchPriceLevelMap` de `../services/priceLevels`.
- Reemplazar cuerpo de `fetchAllPriceLevels()` por `return fetchPriceLevelMap(MAX_PRICE_LEVELS)`.
- `MAX_PRICE_LEVELS` se mueve al servicio (o se pasa como parámetro para que el hook lo controle).

---

### 1d. `useProfileVisibility` → `users.ts`

**Problema:** El hook hace batched `getDocs` con `where(documentId(), 'in', batch)` directamente.

**Función nueva en `src/services/users.ts`:**

```typescript
/**
 * Fetches the profilePublic field for a list of user IDs in batches of 30.
 * Returns a map of userId -> profilePublic (false if doc not found).
 */
export async function fetchProfileVisibility(
  userIds: string[],
): Promise<Map<string, boolean>>
```

La función encapsula los batches de 30, el `getDocs` con `where(documentId(), 'in', batch)`, el manejo de IDs no encontrados (default false), y el manejo de errores (default false on error).

**Hook refactorizado (`src/hooks/useProfileVisibility.ts`):**

- Eliminar imports: `collection`, `getDocs`, `query`, `where`, `documentId` de `firebase/firestore`, `db`.
- Agregar import: `fetchProfileVisibility` de `../services/users`.
- Reemplazar el cuerpo de `fetchVisibility(userIds)` por una llamada a `fetchProfileVisibility(toFetch)` y poblar `visibilityCache` con el resultado.
- El sistema `useSyncExternalStore` + `pendingFetches` + TTL cache se mantiene sin cambios.

---

## Fase 2: Hooks que requieren servicios nuevos

### 2a. `useForceUpdate` → nuevo `services/config.ts`

**Problema:** `checkVersion()` hace `getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'))` directamente.

**Nuevo archivo `src/services/config.ts`:**

```typescript
/**
 * Firestore service for the `config` collection.
 * Reads global app configuration documents.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

export interface AppVersionConfig {
  minVersion: string | undefined;
}

/**
 * Fetches the appVersion config document.
 * Returns { minVersion: undefined } if the document does not exist.
 */
export async function fetchAppVersionConfig(): Promise<AppVersionConfig>
```

**Hook refactorizado (`src/hooks/useForceUpdate.ts`):**

- Eliminar imports: `doc`, `getDoc` de `firebase/firestore`, `db`, `COLLECTIONS`.
- Agregar import: `fetchAppVersionConfig` de `../services/config`.
- Reemplazar el bloque `getDoc(doc(db, ...))` + desestructuración de `snap.data()` por:

```typescript
const { minVersion } = await fetchAppVersionConfig();
if (!minVersion) return 'up-to-date';
```

- Las funciones `_checkVersion`, `_getReloadCount`, `_isReloadLimitReached` siguen exportadas para los tests.
- El DEV guard, sessionStorage, cooldown, analytics y `performHardRefresh` no cambian.

---

### 2b. `usePublicMetrics` → nuevo `services/metrics.ts`

**Problema:** El hook hace `getDoc(doc(db, COLLECTIONS.DAILY_METRICS, today).withConverter(publicMetricsConverter))` directamente.

**Nuevo archivo `src/services/metrics.ts`:**

```typescript
/**
 * Firestore service for the `dailyMetrics` collection.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { publicMetricsConverter } from '../config/metricsConverter';
import type { PublicMetrics } from '../types/metrics';

/**
 * Fetches the daily metrics document for a given date string (YYYY-MM-DD).
 * Returns null if the document does not exist.
 */
export async function fetchDailyMetrics(date: string): Promise<PublicMetrics | null>
```

**Hook refactorizado (`src/hooks/usePublicMetrics.ts`):**

- Eliminar imports: `doc`, `getDoc` de `firebase/firestore`, `db`, `COLLECTIONS`, `publicMetricsConverter`.
- Agregar import: `fetchDailyMetrics` de `../services/metrics`.
- Reemplazar `getDoc(doc(db, ...).withConverter(...))` + `.then(snap => ...)` por:

```typescript
const metrics = await fetchDailyMetrics(today);
if (!ignore) {
  setMetrics(metrics);
  setLoading(false);
}
```

- El manejo de `error` y el patrón `ignore` se mantienen.

---

## Fase 3: Descomposición de archivos > 400 líneas

### 3a. `ConstantsDashboard.tsx` (563 líneas)

**Estado actual:** Un solo archivo con lógica de validación, sub-componentes y el componente principal.

**Estructura propuesta en `src/pages/`:**

```
src/pages/
  ConstantsDashboard.tsx          — orquestador (~120 líneas)
  constantsRegistry.ts            — sin cambios (ya existe)
  constants-dashboard/
    ConstantRow.tsx               — componente de fila (~120 líneas)
    ColorSwatch.tsx               — swatch de color (~25 líneas)
    TypeBadge.tsx                 — badge de tipo (~20 líneas)
    validateConstant.ts           — función validate() + tipos ValidationResult (~60 líneas)
    formatters.ts                 — formatValue(), formatMs(), detectSubtype() (~35 líneas)
    findDuplicates.ts             — findDuplicates() (~25 líneas)
    types.ts                      — OverrideKey, Overrides (~10 líneas)
```

**`ConstantsDashboard.tsx` resultante** importa `ConstantRow`, `findDuplicates`, `CONSTANT_MODULES`, `OverrideKey`, `Overrides` y contiene solo el estado del componente (`searchQuery`, `activeModules`, `overrides`, `snackbar`), los handlers, y el JSX del layout.

**Estimacion de líneas resultantes:**

| Archivo | Líneas estimadas |
|---------|----------------|
| `ConstantsDashboard.tsx` | ~120 |
| `constants-dashboard/ConstantRow.tsx` | ~120 |
| `constants-dashboard/ColorSwatch.tsx` | ~25 |
| `constants-dashboard/TypeBadge.tsx` | ~20 |
| `constants-dashboard/validateConstant.ts` | ~60 |
| `constants-dashboard/formatters.ts` | ~35 |
| `constants-dashboard/findDuplicates.ts` | ~25 |
| `constants-dashboard/types.ts` | ~10 |

Ningún archivo supera 400 líneas.

---

### 3b. `ThemePlayground.tsx` (418 líneas)

**Estado actual:** Utilidades de color, sub-componentes y el componente principal en un solo archivo.

**Estructura propuesta en `src/pages/`:**

```
src/pages/
  ThemePlayground.tsx             — orquestador (~100 líneas)
  theme-playground/
    colorUtils.ts                 — hexToHsl(), hslToHex(), generatePalette() (~55 líneas)
    ColorSwatch.tsx               — swatch clickable con copy (~25 líneas)
    ColorInput.tsx                — input + color picker (~25 líneas)
    ComponentPreview.tsx          — preview de componentes light/dark (~100 líneas)
    outputTemplate.ts             — función que genera el string fullOutput (~40 líneas)
```

**`ThemePlayground.tsx` resultante** contiene solo el estado de colores, `handleCopy`, el layout de dos paneles, y el Snackbar. Todo sin lógica de generación de paleta o preview de componentes.

**Estimacion de líneas resultantes:**

| Archivo | Líneas estimadas |
|---------|----------------|
| `ThemePlayground.tsx` | ~100 |
| `theme-playground/colorUtils.ts` | ~55 |
| `theme-playground/ColorSwatch.tsx` | ~25 |
| `theme-playground/ColorInput.tsx` | ~25 |
| `theme-playground/ComponentPreview.tsx` | ~100 |
| `theme-playground/outputTemplate.ts` | ~40 |

Ningún archivo supera 400 líneas.

---

## Fase 4: Admin callables — centralización en servicios

### 4a. `FeaturedListsPanel.tsx` → `services/adminFeatured.ts`

**Problema:** `toggleFeatured` y `getPublicListsFn` son callables creados con `httpsCallable` inline en el componente. `fetchPublicLists()` mezcla la llamada al callable con transformación de datos.

**Nuevo archivo `src/services/adminFeatured.ts`:**

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { SharedList } from '../types';

const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;

const toggleFeaturedFn = httpsCallable<
  { listId: string; featured: boolean; databaseId?: string },
  { success: boolean }
>(functions, 'toggleFeaturedList');

const getPublicListsFn = httpsCallable<
  { databaseId?: string },
  { lists: SharedList[] }
>(functions, 'getPublicLists');

export async function fetchPublicLists(): Promise<SharedList[]>

export async function toggleFeaturedList(
  listId: string,
  featured: boolean,
): Promise<void>
```

El componente `FeaturedListsPanel.tsx` elimina todos los imports de `firebase/functions` y los reemplaza por imports de `services/adminFeatured.ts`.

---

### 4b. `PhotoReviewCard.tsx` → `services/adminPhotos.ts`

**Problema:** Tres callables (`approveMenuPhoto`, `rejectMenuPhoto`, `deleteMenuPhoto`) son creados con `httpsCallable` inline en cada handler del componente.

**Nuevo archivo `src/services/adminPhotos.ts`:**

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export async function approveMenuPhoto(photoId: string): Promise<void>

export async function rejectMenuPhoto(photoId: string, reason: string): Promise<void>

export async function deleteMenuPhoto(photoId: string): Promise<void>
```

El componente `PhotoReviewCard.tsx` elimina el import de `httpsCallable` / `functions` y usa las tres funciones del servicio. El import de `firebase/storage` + `getDownloadURL` se mantiene porque es una lectura de Storage — esto está fuera del scope de este refactor (Storage sigue siendo accesible desde componentes según las reglas actuales del proyecto).

**Nota:** La regla del service layer aplica a `firebase/firestore` y `firebase/functions`. `firebase/storage` en este componente es un import legítimo para obtener download URLs dentro de un componente de la capa admin — no crea datos en Firestore.

---

## Modelo de datos

No hay cambios en colecciones ni documentos de Firestore. Este refactor es puramente estructural: mueve código entre capas sin cambiar qué datos se leen o escriben.

## Firestore Rules

Sin cambios. Las mismas queries se ejecutan — solo el código que las construye cambia de capa.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Regla que la permite | Cambio necesario? |
|---------------------|------------|-------------|---------------------|------------------|
| `fetchUserRatingsCount` | ratings | Authenticated | `allow read: if auth != null` | No |
| `fetchUserFavoritesCount` | favorites | Authenticated | `allow read: if auth != null` | No |
| `fetchFollowersCount` | follows | Authenticated | `allow read: if auth != null` | No |
| `hasUserRatedBusiness` | ratings | Authenticated | `allow read: if auth != null` | No |
| `fetchPriceLevelMap` | priceLevels | Authenticated | `allow read: if auth != null` | No |
| `fetchProfileVisibility` | users | Any authenticated (cross-user) | `allow read: if auth != null` | No (ya existente) |
| `fetchAppVersionConfig` | config | Unauthenticated ok | `allow read: if true` (config es pública) | No |
| `fetchDailyMetrics` | dailyMetrics | Unauthenticated ok | `allow read: if true` | No |

### Field whitelist check

No se agregan ni modifican campos en ningún documento de Firestore. No aplica.

---

## Cloud Functions

Sin cambios en Cloud Functions. `toggleFeaturedList`, `getPublicLists`, `approveMenuPhoto`, `rejectMenuPhoto`, `deleteMenuPhoto` ya existen y no se modifican.

---

## Seed Data

No aplica. No se modifican colecciones ni esquemas.

---

## Componentes

Solo se modifican en Fase 3 (`ConstantsDashboard.tsx`, `ThemePlayground.tsx`) para extraer sub-componentes, y en Fase 4 para eliminar imports de firebase inline. No hay componentes nuevos visibles al usuario.

### Mutable prop audit

No aplica. Los componentes modificados no reciben datos editables como props.

---

## Hooks

### Hooks modificados

| Hook | Firebase imports eliminados | Servicio nuevo/existente |
|------|---------------------------|------------------------|
| `useProfileStats` | `collection`, `query`, `where`, `getCountOfflineSafe`, `db`, `COLLECTIONS` | 3 funciones count en existing services |
| `useRatingPrompt` | `doc`, `getDoc`, `db`, `COLLECTIONS` | `hasUserRatedBusiness` en `ratings.ts` |
| `usePriceLevelFilter` | `collection`, `getDocs`, `query`, `limit`, `db`, `priceLevelConverter` | `fetchPriceLevelMap` en `priceLevels.ts` |
| `useProfileVisibility` | `collection`, `getDocs`, `query`, `where`, `documentId`, `db` | `fetchProfileVisibility` en `users.ts` |
| `useForceUpdate` | `doc`, `getDoc`, `db`, `COLLECTIONS` | `fetchAppVersionConfig` en nuevo `services/config.ts` |
| `usePublicMetrics` | `doc`, `getDoc`, `db`, `COLLECTIONS`, `publicMetricsConverter` | `fetchDailyMetrics` en nuevo `services/metrics.ts` |

---

## Servicios

### Funciones nuevas en servicios existentes

**`src/services/ratings.ts`:**

| Función | Params | Return | Operacion Firestore |
|---------|--------|--------|-------------------|
| `fetchUserRatingsCount` | `userId: string` | `Promise<number>` | `getCountFromServer` vía `getCountOfflineSafe` en ratings con `where('userId', '==', uid)` |
| `hasUserRatedBusiness` | `userId: string, businessId: string` | `Promise<boolean>` | `getDoc` por composite ID `{userId}__{businessId}` |

**`src/services/favorites.ts`:**

| Función | Params | Return | Operacion Firestore |
|---------|--------|--------|-------------------|
| `fetchUserFavoritesCount` | `userId: string` | `Promise<number>` | `getCountOfflineSafe` en favorites con `where('userId', '==', uid)` |

**`src/services/follows.ts`:**

| Función | Params | Return | Operacion Firestore |
|---------|--------|--------|-------------------|
| `fetchFollowersCount` | `userId: string` | `Promise<number>` | `getCountOfflineSafe` en follows con `where('followedId', '==', uid)` |

**`src/services/priceLevels.ts`:**

| Función | Params | Return | Operacion Firestore |
|---------|--------|--------|-------------------|
| `fetchPriceLevelMap` | `maxDocs?: number` | `Promise<Map<string, number>>` | `getDocs` con `limit(maxDocs)` en priceLevels, computa promedio por businessId |

**`src/services/users.ts`:**

| Función | Params | Return | Operacion Firestore |
|---------|--------|--------|-------------------|
| `fetchProfileVisibility` | `userIds: string[]` | `Promise<Map<string, boolean>>` | batched `getDocs` con `where(documentId(), 'in', batch)` de 30 |

### Servicios nuevos

**`src/services/config.ts`** — Reads de la colección `config`. Solo `fetchAppVersionConfig` inicialmente.

**`src/services/metrics.ts`** — Reads de `dailyMetrics`. Solo `fetchDailyMetrics` inicialmente.

**`src/services/adminFeatured.ts`** — Callables de admin para listas destacadas.

**`src/services/adminPhotos.ts`** — Callables de admin para revisión de fotos.

---

## Tests

### Tests de hooks: cambio en mock strategy

Los tests actuales mockean `firebase/firestore` directamente. Después del refactor, deben mockear el servicio correspondiente.

| Archivo test | Que testear | Tipo | Mock strategy nueva |
|-------------|-------------|------|-------------------|
| `src/hooks/useProfileStats.test.ts` | counts aggregation, reset on user change, handles errors | unit | `vi.mock('../services/ratings')`, `vi.mock('../services/favorites')`, `vi.mock('../services/follows')` |
| `src/hooks/useRatingPrompt.test.ts` | eligibility evaluation, conversion detection, dismiss | unit | Reemplazar `vi.mock('firebase/firestore')` por `vi.mock('../services/ratings', () => ({ hasUserRatedBusiness: mockFn }))` |
| `src/hooks/usePriceLevelFilter.test.ts` | cache TTL, deduplication, error handling | unit | Reemplazar `vi.mock('firebase/firestore')` por `vi.mock('../services/priceLevels', () => ({ fetchPriceLevelMap: mockFn }))` |
| `src/hooks/useProfileVisibility.test.ts` | TTL, batching, default false on miss | unit | Nuevo archivo; mock `vi.mock('../services/users', () => ({ fetchProfileVisibility: mockFn }))` |
| `src/hooks/usePublicMetrics.test.ts` | happy path, not-found, error, ignore pattern | unit | Nuevo archivo; mock `vi.mock('../services/metrics', () => ({ fetchDailyMetrics: mockFn }))` |
| `src/hooks/useForceUpdate.test.ts` | version comparison, cooldown, limit, reload | unit | Reemplazar `vi.mock('firebase/firestore')` por `vi.mock('../services/config', () => ({ fetchAppVersionConfig: mockFn }))` |
| `src/services/config.test.ts` | fetchAppVersionConfig: exists, not-exists, error | unit | Mock `firebase/firestore` (test del servicio) |
| `src/services/metrics.test.ts` | fetchDailyMetrics: exists, not-exists, error | unit | Mock `firebase/firestore` |
| `src/services/adminFeatured.test.ts` | fetchPublicLists, toggleFeaturedList | unit | Mock `firebase/functions` |
| `src/services/adminPhotos.test.ts` | approve, reject, delete callables | unit | Mock `firebase/functions` |

**Nota sobre `useForceUpdate.test.ts`:** Los tests de los helpers internos (`_checkVersion`, `_getReloadCount`, `_isReloadLimitReached`) se mantienen. Solo cambia el mock: en lugar de mockear `firebase/firestore`, se mockea `../services/config`.

---

## Integracion

No hay cambios en integracion visible. Todos los componentes que consumen los hooks (`ProfileScreen`, `HomeScreen`, `SearchScreen`, admin panels) siguen usando los mismos hooks con la misma API pública. Los hooks no cambian sus nombres ni sus return types.

---

## Decisiones tecnicas

**1. Mantener el sistema de cache module-level en `usePriceLevelFilter`**

El hook tiene un sistema de cache eficiente con TTL, deduplicación de promise y reset de cache. Mover este sistema al servicio sería excesivo y lo haría difícil de testear. La decisión es mantener el cache en el hook y solo delegar el fetch al servicio.

**2. `fetchProfileVisibility` devuelve `Map<string, boolean>` en vez de los snapshots raw**

La función del servicio devuelve datos ya procesados, no snapshots de Firestore. El hook recibe el mapa y lo usa para poblar su cache interno. Esto mantiene la boundary del servicio limpia — el hook nunca ve `QueryDocumentSnapshot`.

**3. Separar `adminFeatured.ts` de `adminFeedback.ts`**

El patrón existente en `services/adminFeedback.ts` agrupa callables por dominio. Los callables de listas destacadas son un dominio diferente al feedback, por lo que van en un archivo separado.

**4. `firebase/storage` en `PhotoReviewCard` queda fuera del scope**

El proyecto actualmente permite imports de `firebase/storage` en componentes. El refactor de storage a un service layer separado es una decisión de arquitectura mayor que excede el scope de este issue.

**5. ThemePlayground y ConstantsDashboard son páginas DEV-only**

La decomposición sigue el patrón de `admin/perf/` y `admin/alerts/` — subdirectorio con sub-componentes, el archivo padre como orquestador. Los subdirectorios van dentro de `src/pages/` por ser páginas, no en `src/components/`.

---

## Hardening de seguridad

No hay nuevas superficies de ataque. Este refactor es de estructura, no de datos. Las reglas de Firestore y los permisos no cambian.

---

## Deuda tecnica: mitigacion incorporada

No hay issues de tech debt abiertos que apliquen directamente a los archivos tocados (los issues #260–#265 son de seguridad en funciones, seeds o `.env`). El refactor no agrava ninguna deuda existente.

---

## Textos de usuario

No hay textos visibles al usuario nuevos o modificados.

---

## Accesibilidad y UI mobile

No aplica. Este refactor no modifica ningún JSX visible al usuario.
