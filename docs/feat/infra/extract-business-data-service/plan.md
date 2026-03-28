# Plan: Extraer data-fetching de useBusinessData a service

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Crear servicio y tipo

**Branch:** `feat/extract-business-data-service`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/businessData.ts` | Crear archivo nuevo. Definir y exportar `BusinessDataCollectionName` (type alias del union de 7 colecciones). Definir y exportar `BusinessDataResult` (interfaz con los 8 campos: isFavorite, ratings, comments, userTags, customTags, userCommentLikes, priceLevels, menuPhoto). |
| 2 | `src/services/businessData.ts` | Copiar la funcion `fetchUserLikes` (lineas 49-71 de `useBusinessData.ts`) tal cual. Agregar imports de `getDocs, query, collection, where, documentId` de `firebase/firestore`, `db` de `../config/firebase`, `COLLECTIONS` de `../config/collections`. |
| 3 | `src/services/businessData.ts` | Copiar la funcion `fetchSingleCollection` (lineas 73-129). Agregar imports de `getDoc, doc` y los 6 converters (`ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter`). Cambiar tipo del param `col` a `BusinessDataCollectionName`. Tipar retorno como `Promise<Partial<BusinessDataResult>>`. |
| 4 | `src/services/businessData.ts` | Copiar la funcion `fetchBusinessData` (lineas 131-182). Tipar retorno como `Promise<BusinessDataResult>`. |
| 5 | `src/services/businessData.ts` | Agregar `export` a las 3 funciones. Agregar type imports para `Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto` desde `../types`. |
| 6 | `src/services/index.ts` | Agregar al final: `export { fetchBusinessData, fetchSingleCollection } from './businessData';` y `export type { BusinessDataCollectionName, BusinessDataResult } from './businessData';` |

### Fase 2: Refactorizar hook

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `src/hooks/useBusinessData.ts` | Reemplazar import `import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore'` por nada (eliminar linea completa). |
| 8 | `src/hooks/useBusinessData.ts` | Reemplazar import de `db` de `../config/firebase` por nada (eliminar). |
| 9 | `src/hooks/useBusinessData.ts` | Reemplazar import de `COLLECTIONS` de `../config/collections` por nada (eliminar). |
| 10 | `src/hooks/useBusinessData.ts` | Reemplazar import de los 6 converters de `../config/converters` por nada (eliminar). |
| 11 | `src/hooks/useBusinessData.ts` | Agregar nuevo import: `import { fetchBusinessData, fetchSingleCollection } from '../services/businessData';` y `import type { BusinessDataCollectionName } from '../services/businessData';` |
| 12 | `src/hooks/useBusinessData.ts` | Eliminar la declaracion del tipo local `type CollectionName = ...` (linea 46). Reemplazar todas las referencias a `CollectionName` por `BusinessDataCollectionName` (2 ocurrencias: type annotation del parametro de `refetch` en la interfaz `UseBusinessDataReturn` linea 25, y el parametro del callback `refetch` linea 297). |
| 13 | `src/hooks/useBusinessData.ts` | Eliminar las funciones `fetchUserLikes` (lineas 48-71), `fetchSingleCollection` (lineas 73-129), y `fetchBusinessData` (lineas 131-182). Total: ~135 lineas eliminadas. |
| 14 | `src/hooks/useBusinessData.ts` | Verificar que el hook compila sin errores. Las llamadas a `fetchBusinessData(bId, uid)` en linea 253 y `fetchSingleCollection(businessId, user.uid, collectionName)` en linea 311 ya usan la misma firma que el servicio. |

### Fase 3: Tests del servicio

| Paso | Archivo | Cambio |
|------|---------|--------|
| 15 | `src/services/businessData.test.ts` | Crear archivo. Setup: mock `firebase/firestore` (getDoc, getDocs, collection, doc, query, where, documentId), mock `../config/firebase`, mock `../config/collections`, mock converters. |
| 16 | `src/services/businessData.test.ts` | Tests para `fetchUserLikes`: 4 casos (empty array, single batch, multi batch, doc ID parsing). |
| 17 | `src/services/businessData.test.ts` | Tests para `fetchSingleCollection`: 7 casos (uno por rama del switch). Cada caso verifica la query correcta y el formato del resultado. |
| 18 | `src/services/businessData.test.ts` | Tests para `fetchBusinessData`: 6 casos (parallel execution, flagged filter, comment sort, customTag sort, likes integration, menuPhoto null). |
| 19 | — | Ejecutar `npm run test:run` para verificar que todos los tests pasan, incluyendo `useBusinessDataCache.test.ts` existente. |

### Fase 4: Verificacion final

| Paso | Archivo | Cambio |
|------|---------|--------|
| 20 | — | Ejecutar `npx eslint src/hooks/useBusinessData.ts src/services/businessData.ts` para verificar que no hay imports de `firebase/firestore` en el hook. |
| 21 | — | Ejecutar `npm run test:coverage` y verificar >= 80% en el nuevo servicio. |
| 22 | — | Crear commit con los cambios. |

---

## Estimacion de archivos

| Archivo | Lineas estimadas | Accion |
|---------|-----------------|--------|
| `src/services/businessData.ts` | ~140 | OK (nuevo) |
| `src/hooks/useBusinessData.ts` | ~145 | OK (actualmente 325, se eliminan ~180) |
| `src/services/businessData.test.ts` | ~250 | OK (test file, exento del limite) |
| `src/services/index.ts` | ~13 | OK (actualmente 10, se agregan 2 lineas) |

---

## Orden de implementacion

1. `src/services/businessData.ts` — crear primero porque el hook dependera de este archivo
2. `src/services/index.ts` — agregar re-exports (depende de paso 1)
3. `src/hooks/useBusinessData.ts` — refactorizar para importar del servicio (depende de paso 1)
4. `src/services/businessData.test.ts` — tests del servicio (depende de paso 1)
5. Verificacion final: lint + tests + coverage

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| La firma de las funciones extraidas difiere sutilmente del uso en el hook (ej: tipo de retorno implicito) | Baja | TypeScript detectara incompatibilidades de tipo en build. El refactor es mecanico (copiar y exportar). |
| Tests existentes que mockean `firebase/firestore` directamente en contexto del hook dejen de funcionar | Baja | No existen tests de `useBusinessData` actualmente (verificado en inventario de tests). Solo `useBusinessDataCache.test.ts` existe y no es afectado por este cambio. |
| Import circular entre servicio y cache hook | Nula | El servicio no importa nada del cache. El hook importa del servicio y del cache independientemente. |

## Criterios de done

- [x] `src/services/businessData.ts` existe con `fetchBusinessData`, `fetchSingleCollection` y `fetchUserLikes` exportados
- [x] `src/hooks/useBusinessData.ts` no importa nada de `firebase/firestore`
- [x] La interfaz publica de `useBusinessData` (`UseBusinessDataReturn`) no cambio
- [x] `src/services/businessData.test.ts` tiene >= 17 test cases con >= 80% coverage
- [x] `npm run test:run` pasa sin regresiones
- [x] No hay errores de lint
- [x] Build exitoso (`npm run build`)
