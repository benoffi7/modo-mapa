# Plan de Implementación: Mitigaciones de Cuota Firebase

**Branch:** `feat/24-firebase-quota-offline`
**Base:** `main`

---

## Fase 1 — Firestore Offline Persistence

### Paso 1.1: Modificar `src/config/firebase.ts`

- Reemplazar `getFirestore(app)` por `initializeFirestore` con `persistentLocalCache`
- En DEV: mantener `getFirestore(app)` sin persistence (emuladores)
- En PROD: usar `persistentLocalCache` con `persistentMultipleTabManager`
- Actualizar imports de `firebase/firestore`

### Paso 1.2: Verificar build y lint

- `npm run lint`
- `npm run build`
- `npm run test:run`

### Paso 1.3: Test manual de persistence

- `npm run dev` — verificar que emuladores siguen funcionando sin persistence
- `npm run build && npm run preview` — verificar que IndexedDB se usa en modo producción
- Abrir DevTools → Application → IndexedDB → verificar que Firestore crea entries

---

## Fase 2 — Cache Client-Side para Business View

### Paso 2.1: Crear `src/hooks/useBusinessDataCache.ts`

- Cache singleton (`Map` a nivel de módulo)
- Funciones: `get(businessId)`, `set(businessId, data)`, `invalidate(businessId)`, `invalidateCollection(businessId, collection)`
- TTL de 5 minutos
- `invalidateCollection` borra solo la colección indicada del entry (no todo el entry)

### Paso 2.2: Crear `src/hooks/useBusinessData.ts`

- Hook que recibe `businessId: string | null`
- Si hay cache válido → retorna datos del cache
- Si no → ejecuta las 5 queries en paralelo con `Promise.all`
- Guarda en cache tras fetch exitoso
- Expone `refetch(collection?)` para invalidar y recargar

### Paso 2.3: Refactorizar `FavoriteButton.tsx`

- Cambiar props: agregar `isFavorite`, `isLoading`, `onToggle`
- Eliminar `useEffect` de lectura y estado `isLoading` interno
- Mantener lógica de write (setDoc/deleteDoc)
- Después del write: llamar `onToggle()` para invalidar cache

### Paso 2.4: Refactorizar `BusinessRating.tsx`

- Cambiar props: agregar `ratings`, `isLoading`, `onRatingChange`
- Calcular `averageRating`, `totalRatings`, `myRating` con `useMemo` desde props
- Eliminar `useEffect` de lectura y `loadRatings`
- Mantener lógica de write (setDoc)
- Después del write: llamar `onRatingChange()`

### Paso 2.5: Refactorizar `BusinessComments.tsx`

- Cambiar props: agregar `comments`, `isLoading`, `onCommentsChange`
- Eliminar `useEffect` de lectura y estado `comments` interno
- Mantener estado local de UI: `newComment`, `isSubmitting`, `confirmDeleteId`
- Mantener lógica de write (addDoc/deleteDoc)
- Después del write: llamar `onCommentsChange()`
- Mantener rate limit check (calcular desde props en vez de estado)

### Paso 2.6: Refactorizar `BusinessTags.tsx`

- Cambiar props: agregar `userTags`, `customTags`, `isLoading`, `onTagsChange`
- Calcular `tagCounts` con `useMemo` desde `userTags` + `seedTags`
- Eliminar `useEffect` de lectura y `refreshKey`
- Mantener lógica de writes (setDoc/deleteDoc/addDoc/updateDoc)
- Después del write: llamar `onTagsChange()`

### Paso 2.7: Actualizar `BusinessSheet.tsx`

- Importar y usar `useBusinessData(selectedBusiness?.id ?? null)`
- Pasar datos como props a cada componente hijo:
  - `FavoriteButton`: `isFavorite`, `isLoading`, `onToggle`
  - `BusinessRating`: `ratings`, `isLoading`, `onRatingChange`
  - `BusinessComments`: `comments`, `isLoading`, `onCommentsChange`
  - `BusinessTags`: `userTags`, `customTags`, `isLoading`, `onTagsChange`

### Paso 2.8: Verificar build, lint y tests

- `npm run lint`
- `npm run build`
- `npm run test:run`

### Paso 2.9: Test manual de cache

- Abrir comercio → cerrar → reabrir antes de 5 min → verificar que no hay queries en Network tab
- Abrir comercio → comentar → verificar que comentario aparece (cache invalidado)
- Abrir comercio → toggle favorito → verificar reflejo inmediato
- Abrir comercio → calificar → verificar nuevo promedio
- Abrir comercio → toggle tag → verificar conteo actualizado

---

## Fase 3 — Cache de Listas del Menú

### Paso 3.1: Agregar cache en `usePaginatedQuery.ts`

- Cache `Map` a nivel de módulo con key `collectionPath__userId`
- TTL de 2 minutos
- Primera página: si hay cache válido, usar cache sin query
- "Cargar más": siempre query (no cachear)
- `reload()`: invalida cache y recarga
- Exportar `invalidateQueryCache(collectionPath, userId)`

### Paso 3.2: Agregar invalidación en componentes de write

- `FavoriteButton.tsx`: llamar `invalidateQueryCache` del favorites collection después de toggle
- `BusinessComments.tsx`: llamar `invalidateQueryCache` del comments collection después de create/delete
- `BusinessRating.tsx`: llamar `invalidateQueryCache` del ratings collection después de rate

### Paso 3.3: Verificar build, lint y tests

- `npm run lint`
- `npm run build`
- `npm run test:run`

### Paso 3.4: Test manual de cache de listas

- Abrir favoritos → cerrar menú → reabrir favoritos (< 2 min) → sin query
- Agregar favorito desde business view → abrir lista favoritos → nuevo favorito visible
- Eliminar comentario desde lista → reabrir lista → comentario no aparece

---

## Fase 4 — Tests

### Paso 4.1: Tests para `useBusinessDataCache`

- Cache hit retorna datos cuando TTL no expiró
- Cache miss retorna null cuando no hay entry
- Cache miss retorna null cuando TTL expiró
- `invalidate(businessId)` borra la entry completa
- `invalidateCollection` marca solo esa colección como inválida

### Paso 4.2: Tests para `useBusinessData`

- Con cache válido: no hace queries a Firestore
- Sin cache: hace 5 queries en paralelo
- `refetch('comments')`: invalida solo comments y recarga
- `refetch()` sin argumento: invalida todo y recarga
- Con `businessId` null: retorna estado vacío

### Paso 4.3: Actualizar tests existentes de `usePaginatedQuery`

- Primera página con cache válido: no hace query
- Primera página sin cache: hace query y guarda en cache
- "Cargar más": siempre hace query
- `reload()`: invalida cache y recarga
- `invalidateQueryCache`: borra entry del cache

### Paso 4.4: Verificación final

- `npm run lint`
- `npm run build`
- `npm run test:run`
- Test manual completo de flujo (abrir comercio, interactuar, verificar cache)

---

## Resumen de archivos por fase

| Fase | Nuevos | Modificados | Total |
|------|--------|------------|-------|
| 1 | 0 | 1 | 1 |
| 2 | 2 | 5 | 7 |
| 3 | 0 | 4 | 4 |
| 4 (tests) | 2 | 1 | 3 |
| **Total** | **4** | **7** | **11** |

---

## Notas de coordinación

- Branch `feat/24-firebase-quota-offline` desde `main`
- Si el agente de security hardening crea su branch antes de que terminemos: sin conflicto, ambos parten de `main`
- Archivos compartidos con security hardening: `firebase.ts` (zonas distintas), `BusinessComments.tsx` (props vs flagged field)
- El primero que mergee a main define la base para el rebase del segundo
