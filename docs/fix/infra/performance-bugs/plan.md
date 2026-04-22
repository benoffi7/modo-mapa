# Plan: #277-#278 Race Conditions, Re-renders y CF Serial Reads

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Branch

`fix/performance-bugs`

---

## Fase 1: Bugs de comportamiento (#277)

Prioridad HIGH. Cada paso es independiente del siguiente.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useCheckIn.ts` | Agregar `.catch((err) => { if (cancelled) return; logger.warn('[useCheckIn] fetchCheckInsForBusiness failed', err); })` encadenado al `.then` existente en el `useEffect` (lineas 54-65). Verificar que `logger` este importado (ya lo importan otros hooks — si no esta, agregarlo desde `'../utils/logger'`). |
| 2 | `src/constants/messages/lists.ts` (o archivo equivalente en `src/constants/messages/`) | Agregar clave `itemRemoveError: 'No se pudo eliminar el comercio. Intentá de nuevo.'` al objeto `MSG_LIST`. |
| 3 | `src/components/lists/ListDetailScreen.tsx` | Reescribir `handleRemoveItem` (lineas 117-121) con patron optimista: snapshot previo, `setItems` optimista, `try { await removeBusinessFromList; toast.success }`, `catch { setItems(prev); toast.error(MSG_LIST.itemRemoveError) }`. |
| 4 | `src/hooks/useCommentListBase.ts` | Agregar `const togglingIds = useRef<Set<string>>(new Set())` junto a `optimisticLikes`. Modificar `handleToggleLike` para: (a) retornar temprano si `togglingIds.current.has(commentId)`, (b) `togglingIds.current.add(commentId)` al inicio, (c) `togglingIds.current.delete(commentId)` en bloque `finally`. |

---

## Fase 2: Performance de cliente (#278 — re-renders)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `src/components/layout/TabShell.tsx` | Cambiar linea 54: `const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);`. Agregar `useMemo` al import de React si no esta. |
| 6 | `src/components/business/BusinessSheet.tsx` | Extraer dos callbacks antes del call a `useBusinessRating`: `const handleRatingChange = useCallback(() => data.refetch('ratings'), [data.refetch]);` y `const handleTagsChange = useCallback(() => { data.refetch('userTags'); data.refetch('customTags'); }, [data.refetch]);`. Reemplazar las lambdas inline en `useBusinessRating` (linea 85) y en `InfoTab` (linea 283) con las referencias nombradas. Agregar `useCallback` al import de React si no esta. |
| 7 | `src/hooks/useUserSettings.ts` | Envolver el bloque de construccion de `settings` (lineas 25-30) en `useMemo` con deps `[data, optimistic, digestOverride, localityOverride]`. Agregar `useMemo` al import si no esta. |
| 8 | `src/hooks/useBusinessRating.ts` | Envolver `handleRate` (linea 94) y `handleDeleteRating` (linea 119) en `useCallback` con sus dependencias (`user`, `businessId`, `businessName`, `isOffline`, `toast`, `onRatingChange`, `serverMyRating` segun aplique). `handleCriterionRate` ya usa `useCallback` — no tocar. |
| 9 | `src/hooks/useCommentListBase.ts` | Envolver `handleToggleLike` (ya modificado en Paso 4) en `useCallback` con deps `[user, isLiked, businessId, businessName, isOffline, toast]`. |

---

## Fase 3: Cloud Functions — reads paralelas (#278 — CF)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | `functions/src/triggers/comments.ts` | En `onCommentCreated`, bloque `if (parentId)` (lineas 56-60): reemplazar las dos operaciones secuenciales por `Promise.all([parentRef.update({ replyCount: FieldValue.increment(1) }), parentRef.get()])`, destructurar como `[, parentSnap]`. |
| 11 | `functions/src/triggers/ratings.ts` | En el branch `!beforeExists && afterExists` (lineas 40-43): reemplazar los dos `await` secuenciales por `const [userSnap, bizSnap] = await Promise.all([db.doc(\`users/${userId}\`).get(), db.doc(\`businesses/${businessId}\`).get()])`. |

---

## Fase 4: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 12 | `src/hooks/__tests__/useCheckIn.test.ts` | Crear. Testear: (a) rechazo de `fetchCheckInsForBusiness` con componente montado llama `logger.warn`; (b) rechazo con `cancelled=true` NO llama `logger.warn` (guard funciona). Mock: `vi.mock('../services/checkins')`, `vi.mock('../utils/logger')`. |
| 13 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Crear. Testear: (a) si `removeBusinessFromList` rechaza, `items` vuelve al estado original; (b) `toast.error` aparece en fallo; (c) `toast.success` aparece en exito. Mock: `vi.mock('../../services/sharedLists')`, contextos de Auth y Toast. |
| 14 | `src/hooks/__tests__/useCommentListBase.test.ts` | Crear. Testear: (a) segunda llamada a `handleToggleLike` con mismo `commentId` mientras la primera está pendiente no aplica un segundo toggle; (b) `optimisticLikes` queda con delta correcto tras una sola resolucion. Mock: `vi.mock('../services/comments')`. |
| 15 | `src/hooks/__tests__/useUserSettings.test.ts` | Crear. Testear: referencia de `settings` es la misma entre renders consecutivos si `data`, `optimistic`, `digestOverride` y `localityOverride` no cambian. Usar `renderHook` de `@testing-library/react`. |

---

## Orden de implementacion

1. Paso 2 (constante `itemRemoveError`) — debe existir antes del Paso 3.
2. Pasos 1, 3, 4 — independientes entre si, pueden ir en cualquier orden.
3. Pasos 5-9 — independientes entre si.
4. Pasos 10-11 — independientes entre si; requieren build de functions para verificar.
5. Pasos 12-15 — despues de sus respectivos fixes.

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Estado |
|---------|----------------|-----------------|--------|
| `src/hooks/useCheckIn.ts` | 139 | ~142 | OK |
| `src/components/lists/ListDetailScreen.tsx` | 281 | ~288 | OK |
| `src/hooks/useCommentListBase.ts` | 190 | ~198 | OK |
| `src/components/layout/TabShell.tsx` | 76 | ~77 | OK |
| `src/components/business/BusinessSheet.tsx` | ~305 | ~310 | OK |
| `src/hooks/useUserSettings.ts` | 99 | ~101 | OK |
| `src/hooks/useBusinessRating.ts` | 169 | ~174 | OK |
| `functions/src/triggers/comments.ts` | 181 | ~179 | OK |
| `functions/src/triggers/ratings.ts` | 69 | ~67 | OK |

Ningun archivo supera 400 lineas.

---

## Riesgos

1. **`useCallback` deps en `useBusinessRating`:** `handleRate` y `handleDeleteRating` referencian `serverMyRating` (calculado en `useMemo`). Si se omite de las deps, el lint de `exhaustive-deps` fallara. Incluirlo en deps hace que el callback se recree cuando cambia el rating del servidor — aceptable.

2. **`Promise.all` en `comments.ts`:** Si `parentRef.update` rechaza (e.g. el documento padre fue eliminado entre el write del hijo y el trigger), `Promise.all` rechazara y `parentSnap` no se asignara. El codigo ya maneja esto con `if (parentId && parentSnap?.exists)`. El comportamiento de error es identico al actual.

3. **`togglingIds` como `useRef`:** Al ser un ref (no estado), los cambios no causan re-render. Si en el futuro se quiere deshabilitar el boton de like mientras esta en vuelo, se necesitara un `useState` separado. Por ahora el comportamiento silencioso (ignorar el segundo tap) es correcto.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No hay archivos nuevos — todos los cambios son en archivos existentes
- [x] Logica de negocio en hooks/services, no en componentes (handleRemoveItem sigue en componente porque necesita `setItems` local — correcto)
- [x] Ningun archivo resultante supera 400 lineas

---

## Fase final: Documentacion

Este fix no introduce nuevas colecciones, reglas, features visibles ni patrones nuevos. Solo se actualiza el changelog.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 16 | `docs/reports/changelog.md` | Agregar entrada para fix/performance-bugs: bugs #277 y #278 resueltos |

---

## Criterios de done

- [x] Los 9 fixes implementados (Pasos 1-11)
- [x] 4 archivos de test creados (Pasos 12-15)
- [x] `npm run lint` sin errores
- [x] `npm run build` exitoso (cliente + functions)
- [x] Tests pasan (`npm run test`)
- [x] Changelog actualizado
