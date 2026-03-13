# Plan de implementación — Fase 2

---

## Paso 1 — Tipos, colecciones y converters

**Archivos:**

- `src/types/index.ts` — agregar `MenuPhoto`, `MenuPhotoStatus`, `PriceLevel`, `PRICE_LEVEL_LABELS`
- `src/config/collections.ts` — agregar `MENU_PHOTOS`, `PRICE_LEVELS`
- `src/config/converters.ts` — agregar `menuPhotoConverter`, `priceLevelConverter`

**Verificación:** `npx tsc --noEmit`

---

## Paso 2 — Firebase Storage setup

**Archivos:**

- `src/config/firebase.ts` — agregar `getStorage`, `connectStorageEmulator`, exportar `storage`
- `firebase.json` — agregar `storage` emulator (port 9199)
- `storage.rules` (nuevo) — reglas de acceso para `/menus/{businessId}/{fileName}`

**Verificación:** `npx tsc --noEmit`, emuladores arrancan con storage

---

## Paso 3 — Firestore rules + indexes

**Archivos:**

- `firestore.rules` — agregar rules para `menuPhotos` y `priceLevels`
- `firestore.indexes.json` — agregar índices compuestos para menuPhotos y priceLevels

**Verificación:** emuladores arrancan sin errores de rules

---

## Paso 4 — Service layer: priceLevels

**Archivos:**

- `src/services/priceLevels.ts` (nuevo) — `upsertPriceLevel`, `getPriceLevelsCollection`
- `src/services/index.ts` — agregar exports

**Verificación:** `npx tsc --noEmit`

---

## Paso 5 — Service layer: menuPhotos

**Archivos:**

- `src/services/menuPhotos.ts` (nuevo) — `uploadMenuPhoto`, `getApprovedMenuPhoto`, `getUserPendingPhotos`
- `src/services/index.ts` — agregar exports

**Dependencia:** Instalar `browser-image-compression` en root

**Verificación:** `npx tsc --noEmit`

---

## Paso 6 — Hook: useBusinessData + cache (priceLevels + menuPhoto)

**Archivos:**

- `src/hooks/useBusinessData.ts` — agregar `priceLevels` y `menuPhoto` al data flow (Promise.all + fetchSingleCollection)
- `src/hooks/useBusinessDataCache.ts` — agregar campos al tipo cache

**Verificación:** `npx tsc --noEmit`

---

## Paso 7 — Componente: BusinessPriceLevel

**Archivos:**

- `src/components/business/BusinessPriceLevel.tsx` (nuevo) — UI de nivel de gasto con $ / $$ / $$$
- `src/components/business/BusinessSheet.tsx` — renderizar BusinessPriceLevel entre Rating y Tags

**Verificación:** `npm run dev:full`, abrir comercio, ver sección de precio

---

## Paso 8 — Componentes: MenuPhoto (Section + Upload + Viewer)

**Archivos:**

- `src/components/business/MenuPhotoSection.tsx` (nuevo) — sección en BusinessSheet
- `src/components/business/MenuPhotoUpload.tsx` (nuevo) — dialog upload con preview + progress
- `src/components/business/MenuPhotoViewer.tsx` (nuevo) — dialog fullscreen
- `src/components/business/BusinessSheet.tsx` — renderizar MenuPhotoSection entre Tags y Comments

**Verificación:** `npm run dev:full`, subir foto, ver preview, ver estado pendiente

---

## Paso 9 — Hook: useVisitHistory + componente RecentVisits

**Archivos:**

- `src/hooks/useVisitHistory.ts` (nuevo) — localStorage visit tracking
- `src/components/menu/RecentVisits.tsx` (nuevo) — lista de recientes
- `src/components/layout/SideMenu.tsx` — agregar sección "Recientes"
- `src/components/business/BusinessSheet.tsx` — llamar `recordVisit` al abrir comercio

**Verificación:** abrir comercios, verificar que aparecen en "Recientes"

---

## Paso 10 — Filtros: nivel de gasto en mapa

**Archivos:**

- `src/context/MapContext.tsx` — agregar `activePriceFilter` state
- `src/hooks/usePriceLevelFilter.ts` (nuevo) — cache global de promedios de precio
- `src/hooks/useBusinesses.ts` — filtrar por precio usando cache
- `src/components/search/FilterChips.tsx` — agregar chips $ / $$ / $$$

**Verificación:** activar filtro de precio, verificar que filtra comercios en mapa

---

## Paso 11 — Cloud Functions: priceLevels triggers

**Archivos:**

- `functions/src/triggers/priceLevels.ts` (nuevo) — onCreate/onUpdate counters
- `functions/src/index.ts` — agregar exports

**Verificación:** `cd functions && npx tsc --noEmit`

---

## Paso 12 — Cloud Functions: menuPhotos trigger + callables + cleanup

**Archivos:**

- `functions/src/triggers/menuPhotos.ts` (nuevo) — thumbnail generation con sharp
- `functions/src/admin/menuPhotos.ts` (nuevo) — approveMenuPhoto, rejectMenuPhoto callables
- `functions/src/scheduled/cleanupPhotos.ts` (nuevo) — cron cleanup
- `functions/src/index.ts` — agregar exports

**Dependencia:** Instalar `sharp` en functions/

**Verificación:** `cd functions && npx tsc --noEmit`

---

## Paso 13 — Admin: PhotoReviewPanel

**Archivos:**

- `src/services/admin.ts` — agregar `fetchPendingPhotos`
- `src/components/admin/PhotoReviewPanel.tsx` (nuevo) — tab de review
- `src/components/admin/PhotoReviewCard.tsx` (nuevo) — card individual
- `src/components/admin/AdminLayout.tsx` — agregar tab "Fotos"

**Verificación:** `npm run dev:full`, ir a /admin, ver tab Fotos

---

## Paso 14 — Seed script + test local

**Archivos:**

- `scripts/seed-admin-data.mjs` — agregar menuPhotos, priceLevels, actualizar counters

**Verificación:** correr seed, verificar datos en emulator UI, probar todos los flujos

---

## Paso 15 — Lint, type-check, documentación

**Acciones:**

- `npm run lint`
- `npx tsc --noEmit`
- `cd functions && npx tsc --noEmit`
- Actualizar `docs/PROJECT_REFERENCE.md`
- Crear `docs/feat-menu-photos-history/changelog.md`
- Bump version a 2.1.0

---

## Orden de dependencias

```text
1 (tipos) → 2 (storage) → 3 (rules) → 4 (service PL) → 5 (service photos)
                                          ↓                    ↓
                                     6 (hook data) ←──────────┘
                                          ↓
                              7 (PriceLevel UI) → 8 (MenuPhoto UI)
                                                        ↓
                                                   9 (Recientes)
                                                        ↓
                                                  10 (Filtros mapa)
                                                        ↓
                                            11 (CF priceLevels) → 12 (CF photos)
                                                                       ↓
                                                                  13 (Admin)
                                                                       ↓
                                                                  14 (Seed)
                                                                       ↓
                                                                  15 (Docs)
```
