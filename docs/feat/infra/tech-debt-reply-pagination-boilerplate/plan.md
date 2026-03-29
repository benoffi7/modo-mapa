# Plan: Tech Debt — InlineReplyForm, FollowedList Pagination, Boilerplate

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Constantes, CommentListFooter, adoptar InlineReplyForm

**Branch:** `fix/tech-debt-reply-pagination-boilerplate`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/social.ts` | Crear archivo con `MAX_FOLLOWS = 200` y `FOLLOWS_PAGE_SIZE = 20` |
| 2 | `src/constants/index.ts` | Agregar `export * from './social'` |
| 3 | `src/services/follows.ts` | Eliminar `const MAX_FOLLOWS = 200` y `const PAGE_SIZE = 20` (lineas 22-23). Importar `MAX_FOLLOWS`, `FOLLOWS_PAGE_SIZE` de `../../constants/social`. Reemplazar `PAGE_SIZE` por `FOLLOWS_PAGE_SIZE` en `fetchFollowing` (linea 69) y `fetchFollowers` (linea 87) |
| 4 | `src/components/common/CommentListFooter.tsx` | Crear componente con props `deleteSnackbarProps`, `profileUser`, `onCloseProfile`. Renderiza `<Snackbar>` con boton Deshacer + `<UserProfileSheet>` |
| 5 | `src/components/business/BusinessComments.tsx` | (a) Importar `InlineReplyForm` y `CommentListFooter`. (b) Reemplazar JSX de reply inline (lineas 307-369, los dos bloques condicionales de `replyingTo?.id === comment.id`) por `<InlineReplyForm replyingToName={replyingTo.userName} replyText={replyText} onReplyTextChange={setReplyText} onSubmit={handleSubmitReply} onCancel={handleCancelReply} isSubmitting={isSubmitting} isOverDailyLimit={userCommentsToday >= MAX_COMMENTS_PER_DAY} inputRef={replyInputRef} />`. (c) Reemplazar Snackbar+UserProfileSheet footer (lineas 383-396) por `<CommentListFooter deleteSnackbarProps={deleteSnackbarProps} profileUser={profileUser} onCloseProfile={closeProfile} />`. (d) Eliminar imports no usados: `TextField`, `SendIcon`, `CloseIcon` |
| 6 | `src/components/business/BusinessQuestions.tsx` | (a) Importar `InlineReplyForm` y `CommentListFooter`. (b) Reemplazar JSX de reply inline (lineas 288-347) por `<InlineReplyForm>` con mismos props pattern que paso 5, ajustando padding `pl` a `{ xs: 3, sm: 5.5 }` — nota: InlineReplyForm ya usa `pl: { xs: 3, sm: 5.5 }` en su implementacion, asi que se renderiza directamente sin wrapper de padding. (c) Reemplazar Snackbar+UserProfileSheet footer (lineas 360-373) por `<CommentListFooter>`. (d) Eliminar imports no usados: `TextField`, `SendIcon`, `CloseIcon` |
| 7 | `src/components/common/__tests__/CommentListFooter.test.tsx` | Tests: renderiza Snackbar cuando open, muestra boton Deshacer, renderiza UserProfileSheet con userId, llama onCloseProfile |

### Fase 2: Migrar FollowedList a useFollowedList

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useFollowedList.ts` | Crear hook adapter. Usa `usePaginatedQuery<Follow>` con `getFollowsCollection()`, `[where('followerId', '==', userId)]`, `'createdAt'`, `FOLLOWS_PAGE_SIZE`, cacheKey userId. Resuelve displayNames con `fetchUserDisplayNames` en `useEffect` que observa items del hook paginado. Retorna `{ items: FollowedItem[], isLoading, isLoadingMore, error, hasMore, loadMore, reload }` |
| 2 | `src/components/social/FollowedList.tsx` | (a) Eliminar 6 `useState` y `loadPage` callback. (b) Eliminar imports de `fetchFollowing`, `FollowCursor`, `fetchUserDisplayNames`. (c) Importar `useFollowedList` de `../../hooks/useFollowedList`. (d) Reemplazar por `const { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload } = useFollowedList(userId)`. (e) Actualizar `handleRefresh` para usar `reload`. (f) Actualizar `PaginatedListShell` props: `onLoadMore={loadMore}`, eliminar `isLoadingMore` manual |
| 3 | `src/hooks/__tests__/useFollowedList.test.ts` | Tests: hook retorna items con displayNames resueltos, maneja estado loading, maneja error, loadMore agrega items, reload invalida cache |

### Fase 3: Tests y verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run lint` — verificar 0 errores |
| 2 | N/A | Ejecutar `npm run test:run` — verificar todos los tests existentes pasan |
| 3 | N/A | Ejecutar `npm run build` — verificar build exitoso |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar entrada para `CommentListFooter` en UI patterns. Agregar entrada para `useFollowedList` adapter pattern. Actualizar entrada de `usePaginatedQuery` para mencionar el patron adapter |
| 2 | `docs/reference/tests.md` | Agregar `useFollowedList.test.ts` y `CommentListFooter.test.tsx` al inventario |

---

## Orden de implementacion

1. `src/constants/social.ts` — sin dependencias
2. `src/constants/index.ts` — depende de (1)
3. `src/services/follows.ts` — depende de (1)
4. `src/components/common/CommentListFooter.tsx` — sin dependencias
5. `src/components/business/BusinessComments.tsx` — depende de (4) + InlineReplyForm existente
6. `src/components/business/BusinessQuestions.tsx` — depende de (4) + InlineReplyForm existente
7. `src/hooks/useFollowedList.ts` — depende de (1) + usePaginatedQuery existente
8. `src/components/social/FollowedList.tsx` — depende de (7)
9. Tests — depende de (4), (7)
10. Docs — al final

Pasos 1-4 son independientes y pueden ejecutarse en paralelo. Pasos 5-6 dependen de 4. Pasos 7-8 son independientes de 5-6.

## Riesgos

1. **Regresion visual en reply forms:** InlineReplyForm usa `pl: { xs: 3, sm: 5.5 }` pero BusinessComments usa `pl: 5.5` (sin responsive). Al adoptar InlineReplyForm, el padding en mobile (xs) sera 3 en vez de 5.5. Esto es una **mejora** (mejor alineacion en pantallas chicas) pero puede sorprender en QA visual. **Mitigacion:** revisar visualmente en mobile antes de merge.

2. **DisplayNames async en useFollowedList:** Los displayNames se resuelven en un `useEffect` posterior al query paginado. Habra un flash donde los items muestran userId como fallback antes de que se resuelvan los nombres. **Mitigacion:** el componente FollowedList actual ya tiene este mismo comportamiento (linea 48: `names.get(followedId) ?? followedId`). No es regresion.

3. **Cache key collision:** `usePaginatedQuery` usa `cacheKey` basado en userId. Si el mismo userId tiene queries a `follows` desde otro componente con el mismo cache key, podrian colisionar. **Mitigacion:** el cacheKey se combina con `collectionRef.path` internamente (ver linea 70 de usePaginatedQuery), asi que no hay colision.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta: `constants/social.ts`, `hooks/useFollowedList.ts`, `components/common/CommentListFooter.tsx`
- [x] Logica de negocio en hooks/services, no en componentes (paginacion movida a `useFollowedList`)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (este plan ES el fix)
- [x] Ningun archivo resultante supera 400 lineas

### File size estimation

| Archivo | Lineas actuales | Lineas estimadas | Supera 400? |
|---------|----------------|-----------------|-------------|
| `src/constants/social.ts` | NUEVO | ~5 | No |
| `src/components/common/CommentListFooter.tsx` | NUEVO | ~40 | No |
| `src/hooks/useFollowedList.ts` | NUEVO | ~80 | No |
| `src/components/business/BusinessComments.tsx` | 398 | ~325 | No |
| `src/components/business/BusinessQuestions.tsx` | 375 | ~300 | No |
| `src/components/social/FollowedList.tsx` | 134 | ~95 | No |
| `src/services/follows.ts` | 103 | ~103 | No |

## Criterios de done

- [ ] `InlineReplyForm` se usa en BusinessComments y BusinessQuestions, eliminando JSX duplicado de reply
- [ ] `CommentListFooter` encapsula Snackbar + UserProfileSheet compartido
- [ ] `FollowedList` usa `useFollowedList` con `usePaginatedQuery` interno y cache de primera pagina
- [ ] `MAX_FOLLOWS` y `FOLLOWS_PAGE_SIZE` viven en `src/constants/social.ts`
- [ ] Tests nuevos pasan con >= 80% cobertura en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Todos los tests existentes pasan sin modificaciones
- [ ] Reference docs updated (patterns.md, tests.md)
