# Plan: Refactor BusinessSheet -- Reducir scroll y mejorar navegacion

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Extraer logica de rating a hook (S3 parcial)

**Branch:** `feat/refactor-business-sheet`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useBusinessRating.ts` | Crear hook. Mover logica de calculo (useMemo de promedios, criteriaAverages) y handlers (handleRate, handleDeleteRating, handleCriterionRate) desde BusinessRating. Incluir pendingRating y pendingCriteria state. Importar useAuth, useToast, useConnectivity, withOfflineSupport, upsertRating, deleteRating, upsertCriteriaRating. |
| 2 | `src/components/business/BusinessRating.tsx` | Refactorizar para consumir `useBusinessRating` en vez de tener logica inline. El componente queda como renderer puro que recibe los valores del hook. Eliminar la seccion de criterios expandible (se movera a CriteriaSection en paso siguiente). Mantener la interfaz `Props` identica para compatibilidad temporal. |
| 3 | `src/hooks/__tests__/useBusinessRating.test.ts` | Tests del hook: calculo de promedios con 0/1/N ratings, optimistic update, revert on error, delete rating, criterion rating individual, first-rating toast. Mock de useAuth, useToast, useConnectivity, withOfflineSupport. |

### Fase 2: Extraer CriteriaSection (S3 completo)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/components/business/CriteriaSection.tsx` | Crear componente. Mover el bloque Collapse + criterios (lineas 199-264 de BusinessRating actual) a este componente. Props: criteriaAverages, myCriteria, myRating, hasCriteriaData, onCriterionRate. State local: criteriaOpen (toggle expand). Importar RATING_CRITERIA, CRITERION_ICONS (mover constante de iconos a nivel de modulo o importar desde BusinessRating). |
| 5 | `src/components/business/BusinessRating.tsx` | Eliminar definitivamente el bloque de criterios. El componente ahora solo renderiza: promedio + estrellas readOnly + "(N opiniones)" + "Tu calificacion:" + estrellas interactivas + boton borrar. Resultado: ~60 lineas de render. |
| 6 | `src/components/business/__tests__/CriteriaSection.test.tsx` | Tests: expand/collapse toggle, render de promedios cuando hasCriteriaData=true, no render cuando hasCriteriaData=false y no hay user, estrellas disabled cuando myRating=null, llamada a onCriterionRate con criterionId y value. |

### Fase 3: Extraer useCommentListBase (S2)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `src/hooks/useCommentListBase.ts` | Crear hook con logica compartida: useAuth, useToast, useConnectivity, useProfileVisibility, useUndoDelete (con deleteComment), useOptimisticLikes (con like/unlike + withOfflineSupport), reply state (replyingTo, replyText, replyInputRef, submit, cancel), profile user state, handleToggleLike con error handling, userCommentsToday calc, isSubmitting. Recibe expandThread como parametro opcional para el reply handler. |
| 8 | `src/components/business/BusinessComments.tsx` | Refactorizar para usar useCommentListBase. Eliminar: useAuth, useToast, useConnectivity, useProfileVisibility, useUndoDelete, useOptimisticLikes, toggleAction, reply state, profile state, handleToggleLike, userCommentsToday. Mantener: useCommentEdit, useCommentThreads, sortMode, commentInputText dirty tracking, handleSubmitText (submit de comentario nuevo), renderCommentRow. Pasar expandThread del useCommentThreads al hook base. |
| 9 | `src/components/business/BusinessQuestions.tsx` | Refactorizar para usar useCommentListBase. Eliminar: useAuth, useToast, useConnectivity, useProfileVisibility, useUndoDelete, useOptimisticLikes, toggleAction, reply state, profile state, handleToggleLike, userCommentsToday. Mantener: useQuestionThreads, questionText state, handleSubmitQuestion, best answer logic, noopEdit handlers. Pasar expandQuestion del useQuestionThreads al hook base. |
| 10 | `src/hooks/__tests__/useCommentListBase.test.ts` | Tests: inicializacion correcta, toggleLike success actualiza optimistic state, toggleLike error revierte, markForDelete + undo, reply submit success + cancel, userCommentsToday calculo, profile visibility delegation. Mock de useAuth, useToast, useConnectivity, deleteComment, likeComment, unlikeComment, withOfflineSupport. |

### Fase 4: Crear estructura de tabs y header sticky (S1)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `src/components/business/BusinessSheetHeader.tsx` | Crear componente. Recibe: business, isTrending, favoriteButton, shareButton, recommendButton, addToListButton, checkInButton, mas los datos de useBusinessRating (averageRating, totalRatings, myRating, handleRate, handleDeleteRating). Renderiza: BusinessHeader (existente) + CheckInButton centrado + rating compacto (promedio + estrellas usuario). Style: `position: sticky, top: 0, zIndex: 2, bgcolor: 'background.paper'`, con Divider al final. Usar ref para exponer altura al padre. |
| 12 | `src/components/business/InfoTab.tsx` | Crear componente wrapper. Recibe props de CriteriaSection + BusinessPriceLevel + BusinessTags + MenuPhotoSection. Renderiza en orden con Dividers. Sin state propio. |
| 13 | `src/components/business/OpinionesTab.tsx` | Crear componente wrapper. Recibe comments, regularComments, userCommentLikes, isLoading, onCommentsChange, onDirtyChange. State local: subTab ('comments' \| 'questions'). Renderiza Tabs de MUI (Comentarios / Preguntas) + BusinessComments o BusinessQuestions segun subTab. |
| 14 | `src/components/business/BusinessSheet.tsx` | Refactorizar orquestador: (a) Instanciar useBusinessRating con datos de useBusinessData. (b) Reemplazar secciones lineales por BusinessSheetHeader sticky + Tabs (Info/Opiniones) sticky + contenido del tab activo (InfoTab o OpinionesTab). (c) Cambiar activeTab state a BusinessSheetTab. (d) Agregar ref al header para medir altura y calcular top del sticky tabs. (e) Agregar trackEvent de EVT_BUSINESS_SHEET_TAB_CHANGED en onChange de tabs. (f) Aplicar fade animation al tab content via key={activeTab}. |
| 15 | `src/components/business/__tests__/BusinessSheetHeader.test.tsx` | Tests: render nombre y categoria, trending badge condicional, botones de accion condicionales (recommend/addToList solo si hay user no anonimo), rating compacto muestra promedio y estrellas. |

### Fase 5: Deep link, skeleton y analytics

| Paso | Archivo | Cambio |
|------|---------|--------|
| 16 | `src/context/SelectionContext.tsx` (o `MapContext.tsx` donde vive SelectionProvider) | Agregar `selectedBusinessTab: BusinessSheetTab \| null` y `setSelectedBusinessTab` al contexto. Default null. Reset a null cuando se cierra el sheet (setSelectedBusiness(null)). |
| 17 | `src/hooks/useDeepLinks.ts` | Agregar lectura de `?sheetTab=info\|opiniones`. Validar contra valores permitidos. Si presente junto con `?business=X`, llamar a `setSelectedBusinessTab(tab)`. Eliminar el parametro del URL despues de procesarlo. |
| 18 | `src/components/business/BusinessSheet.tsx` | Leer `selectedBusinessTab` de SelectionContext. Si no es null, usarlo como tab inicial en vez de 'info'. Resetear `selectedBusinessTab` a null despues de consumirlo (useEffect). |
| 19 | `src/constants/analyticsEvents.ts` | Agregar `EVT_BUSINESS_SHEET_TAB_CHANGED = 'business_sheet_tab_changed'`. |
| 20 | `src/components/business/BusinessSheetSkeleton.tsx` | Actualizar skeleton para reflejar nuevo layout: header (nombre + categoria + acciones + rating compacto), tabs (2 rectangulos), contenido de tab (3 bloques genericos). |
| 21 | `src/components/business/__tests__/BusinessSheet.test.tsx` | Tests: tab switching cambia contenido visible, deep link sheetTab abre tab correcta, tab default es 'info', skeleton durante loading, analytics event al cambiar tab. |

### Fase 6: Limpieza y verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 22 | `src/components/business/BusinessRating.tsx` | Verificar que no quedo codigo muerto de criterios. Confirmar que el componente solo renderiza el rating compacto y delega a useBusinessRating. |
| 23 | `src/components/business/BusinessComments.tsx` | Verificar que la logica duplicada fue eliminada. Contar lineas: debe haber reducido ~120 lineas respecto a las 443 originales. |
| 24 | `src/components/business/BusinessQuestions.tsx` | Verificar que la logica duplicada fue eliminada. Contar lineas: debe haber reducido ~100 lineas respecto a las 406 originales. |
| 25 | Ejecutar `npm run lint` | Verificar que no hay errores de lint en todos los archivos modificados/creados. |
| 26 | Ejecutar `npm run test:run` | Verificar que todos los tests pasan (existentes + nuevos). |
| 27 | Ejecutar `npm run test:coverage` | Verificar cobertura >= 80% en archivos nuevos. |

---

## Orden de implementacion

El orden esta disenado para que cada paso compile y los tests pasen incrementalmente.

1. **`useBusinessRating.ts`** -- sin dependencias nuevas, solo extrae logica existente
2. **`BusinessRating.tsx`** (refactor) -- consume el hook del paso 1
3. **Tests de `useBusinessRating`**
4. **`CriteriaSection.tsx`** -- depende de tipos/constantes de rating, no del hook
5. **`BusinessRating.tsx`** (eliminar criterios) -- depende de que CriteriaSection exista
6. **Tests de `CriteriaSection`**
7. **`useCommentListBase.ts`** -- sin dependencias nuevas, solo extrae logica existente
8. **`BusinessComments.tsx`** (refactor) -- consume el hook del paso 7
9. **`BusinessQuestions.tsx`** (refactor) -- consume el hook del paso 7
10. **Tests de `useCommentListBase`**
11. **`BusinessSheetHeader.tsx`** -- depende de useBusinessRating
12. **`InfoTab.tsx`** -- depende de CriteriaSection + componentes existentes
13. **`OpinionesTab.tsx`** -- depende de BusinessComments/Questions refactorizados
14. **`BusinessSheet.tsx`** (refactor principal) -- depende de todos los anteriores
15. **`SelectionContext`** -- agregar selectedBusinessTab
16. **`useDeepLinks.ts`** -- depende de SelectionContext actualizado
17. **`BusinessSheet.tsx`** (deep link) -- depende de useDeepLinks actualizado
18. **`analyticsEvents.ts`** -- constante nueva
19. **`BusinessSheetSkeleton.tsx`** -- actualizar layout
20. **Tests de integracion** (BusinessSheetHeader, BusinessSheet)
21. **Limpieza y verificacion**

---

## Riesgos

### 1. Sticky header no funciona dentro de SwipeableDrawer

**Riesgo:** `position: sticky` requiere que el ancestor scroll container no tenga `overflow: hidden` en ancestros intermedios. El `SwipeableDrawer` de MUI podria tener estilos que lo impidan.

**Mitigacion:** El `PaperProps` actual ya tiene `overflow: 'hidden'` en el Paper, pero el scroll container es el `Box` interior con `overflow: 'auto'`. Sticky deberia funcionar dentro de ese Box. Si no, se puede usar un layout con `display: flex; flex-direction: column` donde el header es `flex-shrink: 0` y el contenido scrolleable es `flex: 1; overflow: auto`.

### 2. Regresion en dirty tracking de comentarios

**Riesgo:** Al mover BusinessComments dentro de OpinionesTab, el `onDirtyChange` callback podria no propagarse correctamente, permitiendo cerrar el sheet con texto sin guardar.

**Mitigacion:** OpinionesTab recibe y propaga `onDirtyChange` directamente. Test especifico en BusinessSheet.test.tsx que verifica que el DiscardDialog aparece cuando hay texto en el input de comentarios.

### 3. Performance de re-renders al cambiar tabs

**Riesgo:** Si InfoTab y OpinionesTab se montan/desmontan con cada cambio de tab, se pierde el state interno (scroll position, expanded threads, etc.).

**Mitigacion:** Usar `display: none` para ocultar el tab inactivo en vez de renderizado condicional (`{activeTab === 'info' && ...}`). Asi ambos tabs se montan una vez y se preserva su state. Solo el tab visible genera layout. Esto es consistente con el patron de `TabContent` en `TabShell` (linea 38 de architecture.md: "display toggle por tab activa").

---

## Criterios de done

- [ ] El usuario ve header, acciones y rating promedio sin hacer scroll al abrir el BusinessSheet
- [ ] El usuario navega entre Info y Opiniones con un tap, sin scroll
- [ ] BusinessComments y BusinessQuestions comparten logica via useCommentListBase, eliminando >= 150 lineas de duplicacion
- [ ] Todos los tests existentes del folder business/ siguen pasando
- [ ] Tests nuevos cubren >= 80% del codigo nuevo
- [ ] Deep link `?business={id}&sheetTab=opiniones` abre el sheet en tab Opiniones
- [ ] Analytics event `business_sheet_tab_changed` se dispara al cambiar tab
- [ ] Skeleton actualizado refleja el nuevo layout
- [ ] No hay errores de lint
- [ ] Build succeeds (`npm run build`)
- [ ] Commit con mensaje descriptivo y lint passing
