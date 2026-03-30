# Plan: Tech debt — security + architecture findings v2.31.0

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Security fixes (H-1, M-1, M-3)

**Branch:** `fix/236-tech-debt-v2-31-0`

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `functions/src/utils/callableRateLimit.ts` | Crear util `checkCallableRateLimit(db, key, limit)` con transaccion atomica, ventana diaria, y `HttpsError('resource-exhausted')` al exceder. |
| 2 | `functions/src/callable/inviteListEditor.ts` | Importar `checkCallableRateLimit`. Llamar con key `editors_invite_${request.auth.uid}` y limit 10 despues de validar auth y antes de leer la lista. Cambiar return de `{ success: true, targetUid }` a `{ success: true }`. |
| 3 | `functions/src/callable/removeListEditor.ts` | Importar `checkCallableRateLimit`. Llamar con key `editors_remove_${request.auth.uid}` y limit 10 despues de validar auth. |
| 4 | `src/components/lists/EditorsDialog.tsx` | Linea 106: reemplazar `secondary={editor.uid.slice(0, 8) + '...'}` por `secondary="Editor"`. |
| 5 | `functions/src/__tests__/utils/callableRateLimit.test.ts` | Crear tests: primera llamada OK, incremento dentro de ventana, rechazo al exceder, reset al dia siguiente. |
| 6 | `functions/src/__tests__/callable/inviteListEditor.test.ts` | Actualizar test "succeeds and returns targetUid" a verificar `{ success: true }` sin `targetUid`. Agregar test de rate limit (mock `checkCallableRateLimit`). |
| 7 | `functions/src/__tests__/callable/removeListEditor.test.ts` | Agregar test de rate limit. |
| 8 | `src/components/lists/__tests__/EditorsDialog.test.tsx` | Crear test que verifica: no hay UID en el DOM, secondary text es "Editor". |

### Fase 2: Architecture fixes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/hooks/useCheckIn.ts` | Cambiar return type de `performCheckIn` y `undoCheckIn` a `Promise<'success' | 'error' | 'blocked'>`. Agregar auth guard (`!user || user.isAnonymous -> return 'blocked'`) al inicio de ambas funciones. En `performCheckIn`: retornar `'success'` en try, `'error'` en catch. Idem `undoCheckIn`. Exportar type `CheckInResult`. |
| 2 | `src/components/business/CheckInButton.tsx` | Eliminar import de `useAuth`. Eliminar `const { user } = useAuth()`. Eliminar guarda `if (!user || user.isAnonymous)`. Refactorizar `handleClick`: usar resultado de `performCheckIn`/`undoCheckIn` para decidir toast. Para `'blocked'`: `toast.info(MSG_AUTH.loginRequired)`. Eliminar `user` y `status` de deps de `useCallback`. |
| 3 | `src/constants/business.ts` | Sin cambios (ya es la fuente canonica). |
| 4 | `src/components/business/BusinessHeader.tsx` | Cambiar import de `CATEGORY_LABELS` de `'../../types'` a `'../../constants/business'`. |
| 5 | `src/components/home/TrendingBusinessCard.tsx` | Cambiar import de `CATEGORY_LABELS` de `'../../types'` a `'../../constants/business'`. |
| 6 | `src/components/common/ListFilters.tsx` | Cambiar import de `CATEGORY_LABELS` de `'../../types'` a `'../../constants/business'`. |
| 7 | `src/components/lists/FavoritesList.tsx` | Cambiar import de `CATEGORY_LABELS` de `'../../types'` a `'../../constants/business'`. |
| 8 | `src/components/lists/RecentsUnifiedTab.tsx` | Cambiar import de `CATEGORY_LABELS` de `'../../types'` a `'../../constants/business'`. |
| 9 | `src/components/admin/FeaturedListsPanel.tsx` | Cambiar import de `CATEGORY_LABELS` de `'../../types'` a `'../../constants/business'`. |
| 10 | `src/types/index.ts` | Eliminar `CATEGORY_LABELS` del re-export (linea 137). Mantener `PREDEFINED_TAGS` y `PRICE_LEVEL_LABELS`. |
| 11 | `src/components/business/BusinessPriceLevel.tsx` | Cambiar import de `useConnectivity` de `'../../hooks/useConnectivity'` a `'../../context/ConnectivityContext'`. |
| 12 | `src/components/business/RecommendDialog.tsx` | Idem. |
| 13 | `src/components/business/FavoriteButton.tsx` | Idem. |
| 14 | `src/components/business/BusinessTags.tsx` | Idem. |
| 15 | `src/components/business/MenuPhotoViewer.tsx` | Idem. |
| 16 | `src/components/ui/OfflineIndicator.tsx` | Idem. |
| 17 | `src/components/ui/OfflineIndicator.test.tsx` | Cambiar mock/import de `'../../hooks/useConnectivity'` a `'../../context/ConnectivityContext'`. |
| 18 | `src/components/profile/FeedbackForm.tsx` | Cambiar import de `useConnectivity` de `'../../hooks/useConnectivity'` a `'../../context/ConnectivityContext'`. |
| 19 | `src/components/profile/PendingActionsSection.tsx` | Idem. |
| 20 | `src/components/social/ReceivedRecommendations.tsx` | Idem. |
| 21 | `src/components/lists/InviteEditorDialog.tsx` | Idem. |
| 22 | `src/hooks/useConnectivity.ts` | Eliminar archivo. |
| 23 | `src/hooks/__tests__/useCheckIn.test.ts` | Crear tests: auth guard retorna `'blocked'`, performCheckIn retorna `'success'`/`'error'`, undoCheckIn retorna `'success'`/`'error'`. |

### Fase 3: Performance fixes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/components/lists/ListDetailScreen.tsx` | Reemplazar imports directos de `IconPicker`, `EditorsDialog`, `InviteEditorDialog` con `React.lazy()`. Agregar `import { lazy, Suspense } from 'react'`. Wrappear los 3 componentes en `<Suspense fallback={null}>`. |
| 2 | `src/components/lists/ListDetailScreen.tsx` | Wrappear `handleEditorsChanged` en `useCallback` con deps `[list.id]`. |
| 3 | `src/components/business/DirectionsButton.tsx` | Agregar `memo`. Cambiar interface a recibir `userLocation` como prop. Eliminar `import { useFilters }` y `const { userLocation } = useFilters()`. |
| 4 | `src/components/business/BusinessSheetHeader.tsx` | Importar `useFilters`. Obtener `userLocation`. Pasar `userLocation={userLocation}` a `<DirectionsButton>`. |

### Fase 4: Copy fixes

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/constants/messages/list.ts` | `deleteError`: "Error al eliminar lista" a "No se pudo eliminar la lista" |
| 2 | `src/constants/messages/list.ts` | `colorError`: "Error al cambiar color" a "No se pudo cambiar el color" |
| 3 | `src/constants/messages/list.ts` | `visibilityError`: "Error al cambiar visibilidad" a "No se pudo cambiar la visibilidad" |
| 4 | `src/constants/messages/list.ts` | `iconError`: "Error al cambiar icono" a "No se pudo cambiar el icono" |
| 5 | `src/constants/messages/list.ts` | `addFavoritesError`: "Error al agregar favoritos" a "No se pudo agregar favoritos" |
| 6 | `src/constants/messages/list.ts` | `favoriteUpdateError`: "Error al actualizar favorito" a "No se pudo actualizar el favorito" |

### Fase 5: Icon fallback documentacion (L-3)

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `src/constants/listIcons.ts` | Agregar comentario JSDoc en `getListIconById` documentando que retorna `undefined` para IDs legacy/desconocidos y que la UI debe usar un fallback (icono default). Agregar mapa `LEGACY_ICON_MAP` vacio con comentario explicando que se puede poblar si se detectan IDs legacy en Firestore. |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|---|---|---|
| 1 | `docs/reference/security.md` | Documentar rate limits en callables de editores (10/dia). Documentar eliminacion de UID leak. |
| 2 | `docs/reference/firestore.md` | Documentar nuevos docs en `_rateLimits` (`editors_invite_*`, `editors_remove_*`). |
| 3 | `docs/reference/patterns.md` | Actualizar seccion "Rate limiting (3 capas)" para incluir callables con `checkCallableRateLimit`. Actualizar nota sobre `useConnectivity` wrapper eliminado. Eliminar mencion de re-export de `CATEGORY_LABELS` en `types/index.ts`. |
| 4 | `docs/reference/tests.md` | Agregar nuevos test files al inventario. |

---

## Orden de implementacion

1. `functions/src/utils/callableRateLimit.ts` (nuevo util, sin dependencias)
2. `functions/src/__tests__/utils/callableRateLimit.test.ts` (tests del util)
3. `functions/src/callable/inviteListEditor.ts` (depende de paso 1)
4. `functions/src/callable/removeListEditor.ts` (depende de paso 1)
5. `functions/src/__tests__/callable/inviteListEditor.test.ts` (depende de paso 3)
6. `functions/src/__tests__/callable/removeListEditor.test.ts` (depende de paso 4)
7. `src/components/lists/EditorsDialog.tsx` (independiente)
8. `src/components/lists/__tests__/EditorsDialog.test.tsx` (depende de paso 7)
9. `src/hooks/useCheckIn.ts` (independiente)
10. `src/components/business/CheckInButton.tsx` (depende de paso 9)
11. `src/hooks/__tests__/useCheckIn.test.ts` (depende de paso 9)
12. Imports `CATEGORY_LABELS` (6 archivos, independientes entre si)
13. `src/types/index.ts` (depende de paso 12)
14. Imports `useConnectivity` (11 archivos + 1 test, independientes entre si)
15. Eliminar `src/hooks/useConnectivity.ts` (depende de paso 14)
16. `src/components/lists/ListDetailScreen.tsx` (lazy + useCallback)
17. `src/components/business/DirectionsButton.tsx` (memo + prop)
18. `src/components/business/BusinessSheetHeader.tsx` (depende de paso 17)
19. `src/constants/messages/list.ts` (copy, independiente)
20. `src/constants/listIcons.ts` (docs, independiente)
21. Docs de referencia (fase final)

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Excede 400? |
|---|---|---|---|
| `functions/src/utils/callableRateLimit.ts` | 0 (nuevo) | ~30 | No |
| `functions/src/callable/inviteListEditor.ts` | 57 | ~65 | No |
| `functions/src/callable/removeListEditor.ts` | 34 | ~42 | No |
| `src/components/lists/EditorsDialog.tsx` | 117 | ~117 | No |
| `src/hooks/useCheckIn.ts` | 132 | ~140 | No |
| `src/components/business/CheckInButton.tsx` | 69 | ~65 | No |
| `src/components/lists/ListDetailScreen.tsx` | 274 | ~280 | No |
| `src/components/business/DirectionsButton.tsx` | 41 | ~40 | No |
| `src/components/business/BusinessSheetHeader.tsx` | 68 | ~72 | No |

Ningun archivo excede 400 lineas.

---

## Riesgos

1. **Breaking change en respuesta de `inviteListEditor`**: Si algun componente del frontend lee `targetUid` de la respuesta, fallara. **Mitigacion:** Verificado que `InviteEditorDialog` no usa `targetUid` del response; llama a `onInvited()` que refetchea via `fetchSharedList`.

2. **`useConnectivity` importado desde tests de terceros**: Si hay tests que mockean el path `hooks/useConnectivity`, dejaran de funcionar. **Mitigacion:** Solo `OfflineIndicator.test.tsx` lo importa directamente, y se actualiza en Fase 2 paso 17.

3. **Lazy load de dialogs puede causar flash en redes lentas**: El primer click en "abrir IconPicker" podria tardar un instante en cargar el chunk. **Mitigacion:** Los chunks son pequenos (<5KB cada uno). Fallback `null` es imperceptible. El dialog de confirmacion delete NO se lazy-loadea (es nativo MUI Dialog ya importado).

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`functions/src/utils/`, `functions/src/__tests__/`)
- [x] Logica de negocio en hooks/services, no en componentes (auth guard movida a `useCheckIn`)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (todos los findings del merge audit estan cubiertos)
- [x] Ningun archivo resultante supera 400 lineas

---

## Criterios de done

- [ ] Respuesta de `inviteListEditor` no contiene `targetUid`
- [ ] Ambos callables rechazan con `resource-exhausted` al superar 10/dia
- [ ] `EditorsDialog` no renderiza UID en el DOM
- [ ] `CheckInButton` no muestra toast exito cuando `performCheckIn` falla
- [ ] `CATEGORY_LABELS` tiene un unico import path en todo el codebase
- [ ] `useConnectivity` wrapper eliminado, 11+ archivos actualizados
- [ ] 3 dialogs de `ListDetailScreen` se cargan via `React.lazy()`
- [ ] `handleEditorsChanged` esta en `useCallback`
- [ ] `DirectionsButton` wrapeado con `memo` y recibe `userLocation` como prop
- [ ] 6 mensajes de error usan patron "No se pudo..."
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (frontend + functions)
- [ ] Docs de referencia actualizados
