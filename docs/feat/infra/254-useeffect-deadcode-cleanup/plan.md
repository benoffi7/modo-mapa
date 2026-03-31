# Plan: useEffect race conditions + async handlers + dead exports

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Mensajes de error centralizados

**Branch:** `fix/254-useeffect-deadcode-cleanup`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/messages/checkin.ts` | Agregar `error: 'Error al hacer check-in'` al objeto `MSG_CHECKIN` |
| 2 | `src/constants/messages/common.ts` | Agregar `deleteError: 'No se pudo eliminar el comentario'` y `editError: 'No se pudo guardar la edicion'` al objeto `MSG_COMMON` |

### Fase 2: Cancellation guards en 8 useEffect

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useProfileStats.ts` | Agregar `let cancelled = false` antes de `Promise.all`, condicionar `setCounts` con `if (!cancelled)`, agregar `return () => { cancelled = true; }` |
| 2 | `src/components/business/MenuPhotoSection.tsx` (effect linea 29) | Agregar `let cancelled = false`, condicionar `.then()` y `.catch()` callbacks con `if (!cancelled)`, agregar cleanup |
| 3 | `src/components/business/MenuPhotoSection.tsx` (effect linea 42) | Agregar `let cancelled = false`, condicionar `.then()` y `.catch()` callbacks con `if (!cancelled)`, agregar cleanup |
| 4 | `src/components/business/RecommendDialog.tsx` (effect linea 37) | Agregar `let cancelled = false`, condicionar `setSentToday` y `setLoadingCount(false)` con `if (!cancelled)`, agregar cleanup |
| 5 | `src/components/home/SpecialsSection.tsx` (effect linea 65) | Agregar `let cancelled = false`, condicionar `setSpecials` con `if (!cancelled)`, agregar cleanup |
| 6 | `src/components/lists/SharedListsView.tsx` (effect linea 37) | Agregar `let cancelled = false`, condicionar `setSelectedList` con `if (!cancelled)`, agregar cleanup |
| 7 | `src/components/profile/MyFeedbackList.tsx` (effect linea 47) | Agregar `let cancelled = false`, condicionar `setItems` y `setLoading(false)` con `if (!cancelled)`, agregar cleanup |
| 8 | `src/components/admin/PhotoReviewCard.tsx` (effect linea 27) | Agregar `let cancelled = false`, condicionar `setImageUrl` con `if (!cancelled)`, agregar cleanup |

### Fase 3: try/catch en 3 async handlers

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/CheckInButton.tsx` | Wrappear cuerpo de `handleClick` en try/catch. Catch: `logger.error('[CheckInButton] handleClick failed:', err)` + `toast.error(MSG_CHECKIN.error)`. Agregar import de `logger` y `MSG_CHECKIN.error` |
| 2 | `src/components/profile/CommentsList.tsx` (onConfirmDelete, linea 44) | Wrappear `await deleteComment(...)` en try/catch. Catch: `logger.error('[CommentsList] deleteComment failed:', err)` + `toast.error(MSG_COMMON.deleteError)`. Agregar import de `useToast`, `logger`, `MSG_COMMON` |
| 3 | `src/components/profile/CommentsList.tsx` (handleEditSave, linea 58) | Wrappear `await editComment(...)` en try/catch. Catch: `logger.error('[CommentsList] editComment failed:', err)` + `toast.error(MSG_COMMON.editError)` |

### Fase 4: Eliminar dead exports

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/offline.ts` | Eliminar `export const OFFLINE_BACKOFF_BASE_MS = 1000;` y su comentario |
| 2 | `src/constants/lists.ts` | Eliminar `export const MAX_EDITORS_PER_LIST = 5;` y su comentario |
| 3 | `src/constants/ui.ts` | Eliminar `export const ADD_BUSINESS_URL = ...;` (lineas 8-9) |
| 4 | `src/constants/validation.ts` | Eliminar `TRUNCATE_COMMENT_PREVIEW`, `TRUNCATE_DETAIL_PREVIEW`, `TRUNCATE_USER_ID`, `MIN_RATING`, `MAX_RATING` |
| 5 | `src/constants/checkin.ts` | Eliminar `export const MAX_CHECKINS_PER_DAY = 10;` y su comentario |
| 6 | `src/constants/social.ts` | Eliminar archivo completo (ambas constantes son dead) |
| 7 | `src/constants/index.ts` | Eliminar linea `export * from './social';` |
| 8 | `src/constants/auth.ts` | Eliminar `export const PASSWORD_MIN_LENGTH = 8;`. Cambiar `export const PASSWORD_RULES` a `const PASSWORD_RULES` |
| 9 | `src/constants/badges.ts` | Cambiar `export const BADGES` a `const BADGES` |
| 10 | `src/services/sharedLists.ts` | Eliminar funcion `getListItemsCollection` (lineas 30-32). Cambiar `export function getSharedListsCollection` a `function getSharedListsCollection` |
| 11 | `src/services/priceLevels.ts` | Eliminar funcion `getPriceLevelsCollection` (lineas 13-16) |
| 12 | `src/services/follows.ts` | Cambiar `export function getFollowsCollection` a `function getFollowsCollection` |
| 13 | `src/services/checkins.ts` | Cambiar `export function getCheckinsCollection` a `function getCheckinsCollection` |

### Fase 5: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run lint` y corregir errores |
| 2 | N/A | Ejecutar `npm run test:run` y verificar que pasan |
| 3 | N/A | Ejecutar `npm run build` y verificar que compila |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar nota en seccion "Constantes centralizadas" sobre eliminacion periodica de dead exports |

---

## Orden de implementacion

1. **Fase 1** (mensajes): primero porque Fases 3 depende de estos mensajes.
2. **Fase 2** (cancellation guards): independiente, puede ir en paralelo con Fase 1.
3. **Fase 3** (try/catch): depende de Fase 1 para los mensajes centralizados.
4. **Fase 4** (dead exports): independiente del resto.
5. **Fase 5** (verificacion): despues de todo.
6. **Fase final** (docs): despues de verificacion.

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Dentro de limite? |
|---------|----------------|-----------------|-------------------|
| `useProfileStats.ts` | 36 | 41 | Si (< 400) |
| `MenuPhotoSection.tsx` | 162 | 172 | Si (< 400) |
| `RecommendDialog.tsx` | 139 | 144 | Si (< 400) |
| `SpecialsSection.tsx` | 149 | 152 | Si (< 400) |
| `SharedListsView.tsx` | 188 | 192 | Si (< 400) |
| `MyFeedbackList.tsx` | 154 | 159 | Si (< 400) |
| `PhotoReviewCard.tsx` | 185 | 189 | Si (< 400) |
| `CheckInButton.tsx` | 61 | 70 | Si (< 400) |
| `CommentsList.tsx` | 226 | 240 | Si (< 400) |

## Riesgos

1. **Tests que importan getters deexportados**: Mitigacion -- se verifico que ningun test importa los getters afectados (solo `getCommentsCollection` aparece en tests, y ese NO se toca).

2. **Barrel re-export de social.ts**: Mitigacion -- `constants/index.ts` linea 19 re-exporta `social.ts`. Se elimina esa linea junto con el archivo. Se verifico que ninguna importacion usa estos nombres.

3. **Constantes usadas en Cloud Functions**: Mitigacion -- las constantes eliminadas son del frontend (`src/constants/`). Las Cloud Functions tienen sus propias constantes en `functions/src/`. Se verifico que no hay imports cruzados.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No se agregan archivos nuevos (solo se modifican existentes y se elimina 1)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] No se toca ningun archivo con deuda tecnica que no sea parte del scope
- [x] Ningun archivo resultante supera 400 lineas

## Criterios de done

- [x] Los 8 useEffect identificados tienen cancellation guard (`let cancelled = false` + cleanup function)
- [x] Los 3 async handlers tienen try/catch con `logger.error()` y toast de error visible al usuario
- [x] Las 11 constantes muertas estan eliminadas (3 de ellas solo se deexportan)
- [x] Las 5 collection getters muertos estan eliminados o deexportados
- [x] Archivo `src/constants/social.ts` eliminado y barrel actualizado
- [x] `npm run test:run` pasa sin errores
- [x] `npm run lint` pasa sin errores
- [x] `npm run build` compila sin errores
- [x] Reference docs actualizados
