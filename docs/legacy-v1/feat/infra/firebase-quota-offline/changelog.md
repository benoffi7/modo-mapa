# Changelog — Firebase Quota Mitigations

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useBusinessData.ts` | Hook orquestador: 5 queries en `Promise.all` + caché client-side |
| `src/hooks/useBusinessDataCache.ts` | Caché module-level (`Map`) con TTL de 5 min para business view |
| `src/hooks/useBusinessDataCache.test.ts` | Tests: get/set, TTL expiry, invalidación, independencia |
| `docs/feat-firebase-quota-offline/prd.md` | PRD del feature |
| `docs/feat-firebase-quota-offline/specs.md` | Especificaciones técnicas |
| `docs/feat-firebase-quota-offline/plan.md` | Plan de implementación |
| `docs/feat-firebase-quota-offline/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/firebase.ts` | Agregado `initializeFirestore` con `persistentLocalCache` + `persistentMultipleTabManager` en producción |
| `src/components/business/BusinessSheet.tsx` | Usa `useBusinessData` hook, pasa datos como props a todos los hijos |
| `src/components/business/BusinessHeader.tsx` | Recibe `favoriteButton: ReactNode` como prop en vez de renderizar FavoriteButton internamente |
| `src/components/business/FavoriteButton.tsx` | Props-driven: recibe `isFavorite`, `isLoading`, `onToggle`. Invalida query cache tras write |
| `src/components/business/BusinessRating.tsx` | Props-driven: recibe `ratings[]`, `isLoading`, `onRatingChange`. Calcula promedios con `useMemo` |
| `src/components/business/BusinessComments.tsx` | Props-driven: recibe `comments[]`, `isLoading`, `onCommentsChange`. Invalida query cache tras write |
| `src/components/business/BusinessTags.tsx` | Props-driven: recibe `userTags[]`, `customTags[]`, `isLoading`, `onTagsChange`. Calcula `tagCounts` con `useMemo` |
| `src/hooks/usePaginatedQuery.ts` | Agregado caché de primera página (TTL 2 min), exporta `invalidateQueryCache()` |
| `src/hooks/usePaginatedQuery.test.ts` | Agregados tests de caché y `invalidateQueryCache`. Actualizado `mockRef` con `.path` |
| `docs/PROJECT_REFERENCE.md` | Actualizado con nuevos hooks, patrones, issue #24 y #25 |
