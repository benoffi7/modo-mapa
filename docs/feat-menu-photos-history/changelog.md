# Changelog — Fase 2: Fotos de menú + Historial de visitas + Nivel de gasto

## Archivos creados

- `storage.rules` — reglas de Firebase Storage para fotos de menú
- `src/services/menuPhotos.ts` — servicio upload/query de fotos
- `src/services/priceLevels.ts` — servicio upsert de nivel de gasto
- `src/hooks/useVisitHistory.ts` — hook localStorage para historial de visitas
- `src/hooks/usePriceLevelFilter.ts` — cache global de promedios de precio para filtro
- `src/components/business/BusinessPriceLevel.tsx` — sección nivel de gasto en BusinessSheet
- `src/components/business/MenuPhotoSection.tsx` — sección foto de menú en BusinessSheet
- `src/components/business/MenuPhotoUpload.tsx` — dialog de upload con preview y progress
- `src/components/business/MenuPhotoViewer.tsx` — dialog fullscreen para ver foto
- `src/components/menu/RecentVisits.tsx` — lista de comercios visitados recientemente
- `src/components/admin/PhotoReviewPanel.tsx` — panel admin para revisar fotos pendientes
- `src/components/admin/PhotoReviewCard.tsx` — card individual de revisión
- `functions/src/triggers/menuPhotos.ts` — trigger thumbnail generation
- `functions/src/triggers/priceLevels.ts` — triggers counters
- `functions/src/admin/menuPhotos.ts` — callables approve/reject
- `functions/src/scheduled/cleanupPhotos.ts` — cron cleanup rejected photos

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
- `src/services/admin.ts` — fetchPendingPhotos
- `src/hooks/useBusinessData.ts` — priceLevels + menuPhoto en data flow
- `src/hooks/useBusinessDataCache.ts` — nuevos campos cache
- `src/hooks/useBusinesses.ts` — filtro por precio
- `src/context/MapContext.tsx` — activePriceFilter state
- `src/components/business/BusinessSheet.tsx` — nuevas secciones + visit tracking
- `src/components/layout/SideMenu.tsx` — sección "Recientes"
- `src/components/search/FilterChips.tsx` — chips de precio $/$$/$$
- `src/components/admin/AdminLayout.tsx` — tab "Fotos"
- `functions/src/index.ts` — nuevos exports
- `functions/package.json` — dep: sharp
- `scripts/seed-admin-data.mjs` — seed priceLevels + menuPhotos
