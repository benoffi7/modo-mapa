# Changelog — Fase 2: Fotos de menú + Historial de visitas + Nivel de gasto

## Archivos creados

- `storage.rules` — reglas de Firebase Storage para fotos de menú
- `src/services/menuPhotos.ts` — servicio upload/query de fotos con AbortSignal
- `src/services/priceLevels.ts` — servicio upsert de nivel de gasto
- `src/hooks/useVisitHistory.ts` — hook localStorage para historial de visitas
- `src/hooks/usePriceLevelFilter.ts` — cache global de promedios de precio para filtro
- `src/components/business/BusinessPriceLevel.tsx` — sección nivel de gasto con optimistic UI (pendingLevel + key remount)
- `src/components/business/MenuPhotoSection.tsx` — sección foto de menú con staleness chip + viewer/upload toggle
- `src/components/business/MenuPhotoUpload.tsx` — dialog de upload con preview, progress, AbortController cancel
- `src/components/business/MenuPhotoViewer.tsx` — dialog fullscreen para ver foto + report button
- `src/components/menu/RecentVisits.tsx` — lista de comercios visitados recientemente
- `src/components/admin/PhotoReviewPanel.tsx` — panel admin: filtro por status, lista de fotos con counts
- `src/components/admin/PhotoReviewCard.tsx` — card individual: approve/reject/delete + revert actions + report count badge
- `functions/src/triggers/menuPhotos.ts` — trigger thumbnail generation
- `functions/src/triggers/priceLevels.ts` — triggers counters
- `functions/src/admin/menuPhotos.ts` — callables: approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto
- `functions/src/scheduled/cleanupPhotos.ts` — cron cleanup rejected photos > 7 días
- `scripts/dev-env.sh` — gestión de entorno dev: status, start, stop, restart, seed, health, logs. Auto-seed al iniciar

## Archivos modificados

- `package.json` — version bump a 2.1.0, dep: browser-image-compression
- `firebase.json` — storage config + emulator port 9199
- `firestore.rules` — reglas menuPhotos + priceLevels
- `firestore.indexes.json` — índices menuPhotos + priceLevels
- `src/config/firebase.ts` — getStorage + connectStorageEmulator
- `src/config/collections.ts` — MENU_PHOTOS, PRICE_LEVELS
- `src/config/converters.ts` — menuPhotoConverter, priceLevelConverter
- `src/types/index.ts` — MenuPhoto, MenuPhotoStatus, PriceLevel, PRICE_LEVEL_LABELS
- `src/services/index.ts` — nuevos exports
- `src/services/admin.ts` — fetchPendingPhotos + fetchAllPhotos
- `src/hooks/useBusinessData.ts` — priceLevels + menuPhoto en data flow + patchedRef race condition fix
- `src/hooks/useBusinessDataCache.ts` — nuevos campos cache
- `src/hooks/useBusinesses.ts` — filtro por precio
- `src/context/MapContext.tsx` — activePriceFilter state
- `src/components/business/BusinessSheet.tsx` — nuevas secciones + visit tracking + key={businessId} en BusinessPriceLevel
- `src/components/layout/SideMenu.tsx` — sección "Recientes"
- `src/components/search/FilterChips.tsx` — chips de precio $/$$/$$
- `src/components/admin/AdminLayout.tsx` — tab "Fotos"
- `functions/src/index.ts` — nuevos exports (incl. deleteMenuPhoto, reportMenuPhoto)
- `functions/src/admin/backups.ts` — enforceAppCheck: !IS_EMULATOR
- `functions/package.json` — dep: sharp
- `scripts/seed-admin-data.mjs` — seed priceLevels + menuPhotos

## Bugs resueltos durante implementación

- **Race condition precio**: refetches parciales incrementaban fetchIdRef cancelando full loads; full loads sobreescribían datos parciales. Fix: patchedRef + functional setData + key remount
- **Upload colgado**: sin mecanismo de abort ni botón cancel habilitado. Fix: AbortController + useWebWorker: false
- **App Check en emuladores**: enforceAppCheck: true bloqueaba callables. Fix: enforceAppCheck: !IS_EMULATOR
- **Lint violations**: react-hooks/set-state-in-effect, refs, purity. Fix: key remount, useState initializer, eslint-disable guards
