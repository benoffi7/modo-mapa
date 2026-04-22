# Plan: Business Detail Screen -- Sheet compacto + pantalla full con chip tabs

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-22

---

## Fases de implementacion

### Fase 1: Tipos, constantes y hook thin

**Branch:** `feat/business-detail-screen`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/constants/validation.ts` | Agregar `export const BUSINESS_ID_REGEX = /^biz_\d{1,6}$/;` (extrae el regex de `useDeepLinks`). Si el archivo no existe, crearlo. |
| 2 | `src/hooks/useDeepLinks.ts` | Importar `BUSINESS_ID_REGEX` desde `constants/validation` y reemplazar la constante local `BUSINESS_ID_RE`. Sin cambios de comportamiento. |
| 3 | `src/types/businessDetail.ts` | Crear archivo con `BusinessDetailTab` (union `'criterios' \| 'precio' \| 'tags' \| 'foto' \| 'opiniones'`) y `BUSINESS_DETAIL_TABS` (readonly array). |
| 4 | `src/types/index.ts` | Re-exportar `BusinessDetailTab` y `BUSINESS_DETAIL_TABS` desde el barrel. |
| 5 | `src/constants/analyticsEvents/business.ts` | Agregar `EVT_BUSINESS_DETAIL_OPENED`, `EVT_BUSINESS_DETAIL_TAB_CHANGED`, `EVT_BUSINESS_DETAIL_CTA_CLICKED`. Marcar `EVT_BUSINESS_SHEET_TAB_CHANGED` con `@deprecated` en JSDoc. |
| 6 | `src/constants/analyticsEvents/__tests__/barrel.test.ts` | Agregar los 3 nuevos eventos a la lista de constantes esperadas en el barrel. |
| 7 | `src/constants/storage.ts` | Agregar `export const STORAGE_KEY_LAST_BUSINESS_SHEET = 'mm_last_business_sheet';`. |
| 8 | `src/hooks/useBusinessById.ts` | Crear hook thin: valida `id` con `BUSINESS_ID_REGEX`, busca en `allBusinesses`, retorna `{ business, status }`. Sin fetch de Firestore. |
| 9 | `src/hooks/__tests__/useBusinessById.test.ts` | Tests: id valido retorna `found`, id formato valido pero inexistente retorna `not_found`, id malformado retorna `invalid_id`, id undefined retorna `invalid_id`. |

### Fase 2: BusinessNotFound + BusinessSheetCompactContent + BusinessDetailScreen

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | `src/constants/messages/businessDetail.ts` | Crear archivo con constantes `MSG_BUSINESS_DETAIL` (objeto con claves `notFound`, `invalidId`, `offlineNoCache`, `backToMap`, `viewDetails`, `chipCriterios`, `chipPrecio`, `chipTags`, `chipFoto`, `chipOpiniones`). |
| 11 | `src/constants/messages/index.ts` | Re-exportar `MSG_BUSINESS_DETAIL`. |
| 12 | `src/components/business/BusinessNotFound.tsx` | Crear componente con prop `reason` (`'invalid_id' \| 'not_found' \| 'offline_no_cache'`). Render: `ErrorOutlineIcon` + mensaje segun reason + boton "Volver al mapa" que hace `navigate('/')`. |
| 13 | `src/components/business/__tests__/BusinessNotFound.test.tsx` | Tests: render por cada reason muestra mensaje correcto, click en boton navega a `/`. |
| 14 | `src/components/business/BusinessSheetCompactContent.tsx` | Crear. Recibe `business`. Instancia `useBusinessData`, `useBusinessRating`, `useVisitHistory`, `useTrending`. Renderiza: `StaleBanner` (si stale) + `BusinessSheetHeader` (pasando props como el actual) + `Button` "Ver detalles" full-width con `EastIcon`. Al clickear: `sessionStorage.setItem(STORAGE_KEY_LAST_BUSINESS_SHEET, business.id)` + `trackEvent(EVT_BUSINESS_DETAIL_CTA_CLICKED, ...)` + `navigate('/comercio/' + business.id)`. Mantiene el `trackEvent('business_view', ...)` del mount. Envuelve en `BusinessScopeProvider` como el actual. |
| 15 | `src/components/business/__tests__/BusinessSheetCompactContent.test.tsx` | Tests: renderiza header + CTA, click en CTA dispara analytics y navega, no renderiza chips ni tabs, `sessionStorage` se setea con el businessId al clickear. |
| 16 | `src/components/business/BusinessDetailScreen.tsx` | Crear. Props: `business`, `initialTab?`. State: `activeTab` inicializado con `initialTab ?? 'criterios'`. Instancia `useBusinessData`, `useBusinessRating`, `useVisitHistory`, `useConnectivity`. Si `data.error && isOffline` -> `<BusinessNotFound reason="offline_no_cache" />`. Layout: back button (IconButton) + `BusinessSheetHeader` + sticky Box con 5 Chips (patron de `ListsScreen`, usando `NAV_CHIP_SX`) + contenido del chip activo via `display: none` para preservar state. El contenido del chip `criterios` es `CriteriaSection`; `precio` es `BusinessPriceLevel`; `tags` es `BusinessTags`; `foto` es `MenuPhotoSection`; `opiniones` es `OpinionesTab`. En mount: `trackEvent(EVT_BUSINESS_DETAIL_OPENED, { business_id, source: initialTab ? 'deep_link' : 'sheet_cta' })` y `recordVisit`. Al cambiar chip: `trackEvent(EVT_BUSINESS_DETAIL_TAB_CHANGED, ...)` + `trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'comercio', sub_tab })` + `setSearchParams({ tab })` con `replace: true`. Envuelve en `BusinessScopeProvider` como el flow actual. |
| 17 | `src/components/business/__tests__/BusinessDetailScreen.test.tsx` | Tests: render inicial en chip 'criterios', cambio de chip actualiza contenido y URL, analytics en mount y en cambio, back button dispara `navigate(-1)` (o `navigate('/')` si es deep link directo sin history), render de `BusinessNotFound` cuando offline + no cache. |

### Fase 3: BusinessDetailPage (ruta) + App.tsx

| Paso | Archivo | Cambio |
|------|---------|--------|
| 18 | `src/pages/BusinessDetailPage.tsx` | Crear. `useParams<{ id: string }>()`, `useSearchParams()`. Usa `useBusinessById`. Si `status !== 'found'` -> `<BusinessNotFound reason={status === 'invalid_id' ? 'invalid_id' : 'not_found'} />`. Si found: valida `?tab=` contra `BUSINESS_DETAIL_TABS` y pasa a `<BusinessDetailScreen business={biz} initialTab={validTab} />`. Envuelve en `FiltersProvider` para que `DirectionsButton` funcione. |
| 19 | `src/pages/__tests__/BusinessDetailPage.test.tsx` | Tests: id valido renderiza screen con business correcto, id invalido renderiza NotFound reason=invalid_id, id valido pero inexistente renderiza NotFound reason=not_found, parsea `?tab=opiniones` y lo pasa como initialTab, ignora `?tab=foo` y pasa undefined. |
| 20 | `src/App.tsx` | Agregar `const BusinessDetailPage = lazy(() => import('./pages/BusinessDetailPage'));`. Agregar `<Route path="/comercio/:id" element={<Suspense fallback={<AdminFallback />}><BusinessDetailPage /></Suspense>} />` antes de `/*`. |
| 21 | `src/App.test.tsx` (si existe, sino crear) | Tests de integracion: navegar a `/comercio/biz_001` renderiza `BusinessDetailScreen`, `/comercio/invalid` renderiza `BusinessNotFound`, `/comercio/biz_001?tab=opiniones` abre con chip Opiniones activo. |

### Fase 4: Simplificar BusinessSheet + restauracion de seleccion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 22 | `src/components/business/BusinessSheet.tsx` | Simplificar: eliminar `commentsDirty`, `useUnsavedChanges`, `DiscardDialog`. Reemplazar `<BusinessSheetContent ... />` por `<BusinessSheetCompactContent business={selectedBusiness} />`. Cambiar `maxHeight: '85dvh'` a `'50dvh'` en `PaperProps.sx` y en el `Box` interior. Preservar `key={selectedBusiness.id}`, el `DragHandle` y el tooltip. `handleClose` queda como `() => setSelectedBusiness(null)` (sin confirmacion porque ya no hay inputs dirty). |
| 23 | `src/components/business/__tests__/BusinessSheet.test.tsx` (si existe, sino crear) | Tests: sheet compacto renderiza solo header + CTA (no chips, no tabs, no `DiscardDialog`), al cerrar hace `setSelectedBusiness(null)` sin dialogo. |
| 24 | `src/hooks/useDeepLinks.ts` | Agregar logica de restore: al montar, leer `sessionStorage.getItem(STORAGE_KEY_LAST_BUSINESS_SHEET)`. Si existe, buscar el business en `allBusinesses`, setear `selectedBusiness` (sin cambiar `activeTab`), y `sessionStorage.removeItem` la key. Esto se ejecuta independientemente de `?business=` query param. |
| 25 | `src/hooks/__tests__/useDeepLinks.test.ts` | Tests nuevos: mock `sessionStorage` con `STORAGE_KEY_LAST_BUSINESS_SHEET = 'biz_001'` -> verificar que `setSelectedBusiness` se llama con el business, y que `sessionStorage.removeItem` se ejecuta. Caso sin key: no se llama. Caso con key invalida (business no existe): no se llama `setSelectedBusiness`. |

### Fase 5: ShareButton + backward compat

| Paso | Archivo | Cambio |
|------|---------|--------|
| 26 | `src/components/business/ShareButton.tsx` | Cambiar `const url = \`${window.location.origin}/?business=${business.id}\`` por `const url = \`${window.location.origin}/comercio/${business.id}\``. |
| 27 | `src/components/business/__tests__/ShareButton.test.tsx` | Test modificado: URL compartida es `/comercio/biz_001` y no `/?business=biz_001`. |
| 28 | `src/hooks/__tests__/useDeepLinks.test.ts` | Verificar que `?business=biz_001` sigue funcionando para backward compat de links viejos (sin regresion). |

### Fase 6: Eliminacion de codigo obsoleto del sheet

| Paso | Archivo | Cambio |
|------|---------|--------|
| 29 | `src/components/business/BusinessSheetContent.tsx` | **Conservar sin cambios.** Queda como codigo usado por la pantalla full indirectamente -- no. **Corregir:** la screen reutiliza `CriteriaSection`, `BusinessPriceLevel`, `BusinessTags`, `MenuPhotoSection`, `OpinionesTab` directamente, no via `BusinessSheetContent`. Este archivo queda huerfano si el sheet usa `BusinessSheetCompactContent`. **Accion:** eliminar `BusinessSheetContent.tsx` despues de verificar que no tiene imports externos. Tambien eliminar `InfoTab.tsx` si solo era usado por `BusinessSheetContent`. |
| 30 | `src/components/business/InfoTab.tsx` | Eliminar si solo era usado por `BusinessSheetContent`. `BusinessDetailScreen` usa los componentes hijos directamente, no via InfoTab wrapper. |
| 31 | `src/components/business/BusinessSheetSkeleton.tsx` | Actualizar al layout compacto (solo header + CTA). Eliminar skeleton de tabs y contenido de tab. |
| 32 | `src/components/business/BusinessSheet.error.test.tsx` | Actualizar para el nuevo flow (si testea el error state del sheet completo, ahora el error se maneja en pantalla full). |
| 33 | Buscar usos de `selectedBusinessTab` / `setSelectedBusinessTab` | `grep -r "selectedBusinessTab" src/` y eliminar del `SelectionContext` si ya no se usa. Alternativa: dejar en el contexto pero marcar `@deprecated` porque `useDeepLinks` lo setea cuando venia `?sheetTab=`. **Decision:** mantener el contexto tal cual porque el sheet compacto no renderiza tabs pero el mecanismo puede servir para futuros features; agregar comentario explicativo. |

### Fase 7: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 34 | `docs/reference/features.md` | Actualizar seccion BusinessSheet: describir flujo sheet compacto → pantalla full con chip tabs, mencionar ruta `/comercio/:id`. |
| 35 | `docs/reference/architecture.md` | Actualizar arbol de rutas en `App.tsx`: agregar `/comercio/:id` → `BusinessDetailPage` (lazy). Actualizar "Tab: Buscar" mencionando que el sheet ya no tiene tabs internos. |
| 36 | `docs/reference/patterns.md` | Agregar entrada para "Pantalla full para entidad detallada" con ejemplo `/comercio/:id`. Actualizar "Anti-sabana (max 5 secciones)" mencionando que el sheet compacto resuelve el caso tocando 1 solo componente. Actualizar "Deep linking" con el nuevo patron `/comercio/:id?tab=`. |
| 37 | `docs/reference/project-reference.md` | Bump version si aplica, agregar nota en summary de features. |
| 38 | `src/components/menu/HelpSection.tsx` (si aplica) | Si se menciona el flujo de navegacion en Help, actualizar. Probablemente no requerido. |
| 39 | `docs/_sidebar.md` | Agregar entrada `Specs` y `Plan` debajo del PRD existente `Business Detail Screen` en la seccion UX. |

---

## Estimacion de tamanio de archivos resultantes

| Archivo | Lineas estimadas | >400? |
|---------|-----------------|-------|
| `src/pages/BusinessDetailPage.tsx` | ~60 | No |
| `src/components/business/BusinessDetailScreen.tsx` | ~230 | No |
| `src/components/business/BusinessSheetCompactContent.tsx` | ~150 | No |
| `src/components/business/BusinessNotFound.tsx` | ~70 | No |
| `src/components/business/BusinessSheet.tsx` (reducido) | ~85 | No |
| `src/components/business/BusinessSheetSkeleton.tsx` (reducido) | ~30 | No |
| `src/hooks/useBusinessById.ts` | ~35 | No |
| `src/types/businessDetail.ts` | ~20 | No |
| `src/constants/messages/businessDetail.ts` | ~25 | No |

Ninguno supera 400 lineas. No se necesita decomposicion adicional.

---

## Orden de implementacion

El orden garantiza que cada paso compile incrementalmente.

1. **Constantes y tipos** (Fase 1, pasos 1-7) -- fundacion sin dependencias
2. **`useBusinessById`** (pasos 8-9) -- solo depende de constantes y datos estaticos
3. **Mensajes** (pasos 10-11)
4. **`BusinessNotFound`** (pasos 12-13) -- componente aislado
5. **`BusinessSheetCompactContent`** (pasos 14-15) -- depende de hooks existentes (`useBusinessData`, `useBusinessRating`) y componentes existentes (`BusinessSheetHeader`)
6. **`BusinessDetailScreen`** (pasos 16-17) -- depende de todo lo anterior y de los componentes de seccion existentes (`CriteriaSection`, `BusinessPriceLevel`, `BusinessTags`, `MenuPhotoSection`, `OpinionesTab`)
7. **`BusinessDetailPage`** (paso 18-19) -- depende de `useBusinessById` y `BusinessDetailScreen`
8. **`App.tsx`** routing (pasos 20-21) -- depende de `BusinessDetailPage`
9. **`BusinessSheet`** simplificado (pasos 22-23) -- depende de `BusinessSheetCompactContent`
10. **`useDeepLinks`** restore (pasos 24-25) -- independiente
11. **`ShareButton`** URL (pasos 26-28) -- independiente
12. **Cleanup** (pasos 29-33) -- despues de verificar que todo funciona
13. **Documentacion** (pasos 34-39)

En cualquier momento el arbol compila y los tests existentes siguen pasando (salvo los del flow sheet con tabs, que se actualizan en el paso 23).

---

## Tests por fase

| Fase | Tests creados/modificados |
|------|--------------------------|
| 1 | `useBusinessById.test.ts`, `barrel.test.ts` (modif) |
| 2 | `BusinessNotFound.test.tsx`, `BusinessSheetCompactContent.test.tsx`, `BusinessDetailScreen.test.tsx` |
| 3 | `BusinessDetailPage.test.tsx`, `App.test.tsx` (modif o crear) |
| 4 | `BusinessSheet.test.tsx` (modif), `useDeepLinks.test.ts` (modif) |
| 5 | `ShareButton.test.tsx` (modif), `useDeepLinks.test.ts` (modif) |
| 6 | (solo cleanup, tests existentes deben seguir pasando) |

**Cobertura objetivo:** >= 80% en todos los archivos nuevos. Verificar con `npm run test:coverage` al final.

---

## Riesgos

### 1. `MapAppShell` se desmonta al navegar a `/comercio/:id`

**Riesgo:** al ser ruta hermana (no hija) de `/*`, react-router desmonta `MapAppShell` entero. Esto significa que `SelectionProvider`, `TabProvider`, `OnboardingProvider`, `FiltersProvider`, y el mapa de Google Maps se reinicializan al volver con back. Usuario percibe flash / loading al volver.

**Mitigacion:** aceptar esta penalizacion por claridad arquitectural. El mapa ya estaba lazy-loaded; el re-mount tarda ~200ms en Pi, ~50ms en mobile moderno. Si resulta inaceptable en testing manual, evaluar mover la ruta a ruta hija (anidada en `MapAppShell`) con un condicional que oculte el mapa cuando el detail esta visible. **Mitigacion de segunda linea:** medir con `trackEvent('map_remount_on_back', { ms })` si se vuelve evidencia.

### 2. Sincronizacion "tu calificacion" depende del cache de `useBusinessData`

**Riesgo:** si el TTL de memory cache (5min) expira entre abrir el sheet y abrir la screen, o si el `BusinessScopeProvider` de cada arbol tiene keys distintas, el rating puede mostrar valor desactualizado temporalmente (fetch re-dispara).

**Mitigacion:** `useBusinessData` ya hace merge cache con IndexedDB, asi que en peor caso se muestra stale con `StaleBanner` mientras re-fetchea. El test de integracion verifica que tras `refetch('ratings')` en uno, el otro consume el valor patched. Se agrega una prueba especifica de "rating seteado en sheet -> navega a screen -> screen muestra el nuevo rating sin refetch adicional".

### 3. Deep link offline sin cache -- UX degradada

**Riesgo:** un usuario que recibe un link compartido sin haber visto nunca el comercio, y esta offline, solo ve `BusinessNotFound reason="offline_no_cache"`. No puede ni ver nombre/direccion porque el JSON estatico tampoco esta offline (en realidad el JSON SI esta bundled, asi que esto se invalida).

**Mitigacion correcta:** como los comercios son datos estaticos bundled en el JS, siempre estan disponibles offline. El unico caso de "offline no cache" es cuando `useBusinessData` falla al traer ratings/comments y NO tiene IndexedDB cache. En ese caso, se puede renderizar la screen con los datos estaticos (nombre, direccion, categoria) y mostrar skeletons/empty-states en las secciones dinamicas. **Accion:** en `BusinessDetailScreen`, si `data.error && isOffline`, NO renderizar `BusinessNotFound`; en su lugar, renderizar header completo (datos estaticos) + tabs con empty states. Esto se documenta como decision en el paso 16.

### 4. `sessionStorage` no disponible (Safari private mode) -- restore falla silencioso

**Riesgo:** Safari en modo privado lanza `QuotaExceededError` al escribir a `sessionStorage`. El restore no se ejecuta.

**Mitigacion:** wrap `sessionStorage.setItem/getItem/removeItem` en try/catch con `logger.warn` para que no rompa la navegacion. Test unitario que mockea `sessionStorage` throwing y verifica que la navegacion no falla.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (usa `useBusinessData` existente)
- [x] Archivos nuevos en carpeta de dominio correcta: `src/components/business/`, `src/pages/`, `src/hooks/`
- [x] Logica de negocio en hooks/services: validacion en `useBusinessById`, fetch en `useBusinessData`
- [x] Componentes orquestador (`BusinessDetailScreen`) delega a componentes existentes de seccion
- [x] Ningun archivo resultante supera 400 lineas (verificado en estimacion arriba)

## Guardrails de seguridad

- [x] `BUSINESS_ID_REGEX` valida `:id` antes de pasar a cualquier query
- [x] `BUSINESS_DETAIL_TABS` whitelist valida `?tab=`
- [x] No hay `dangerouslySetInnerHTML`
- [x] No hay writes nuevos -- rate limits N/A
- [x] No hay secrets ni admin emails en archivos nuevos

## Guardrails de observabilidad

- [x] 3 eventos GA4 nuevos registrados en `GA4_EVENT_NAMES` (se agrega en `functions/src/admin/analyticsReport.ts` si hay dashboard de eventos) -- verificar existencia del archivo en el paso 34
- [x] Feature card en `ga4FeatureDefinitions.ts` si existe -- verificar en doc-update phase
- [x] `logger.error` solo en paths criticos (ninguno nuevo aqui, se reusa el de `useBusinessData`)

## Guardrails de accesibilidad y UI

- [x] `IconButton` back con `aria-label="Volver al mapa"`
- [x] Chips con texto visible + icono opcional (patron `ListsScreen`)
- [x] Touch targets 44x44px minimo (IconButton default, Button default, Chip con `NAV_CHIP_SX` height 36 + padding interno)
- [x] Error state con retry (`BusinessNotFound` tiene boton "Volver al mapa")
- [x] No hay `<img>` con URL dinamica nueva
- [x] `navigate` en componentes user-facing: el chip cambia via `setSearchParams` para que back-button del navegador sea intuitivo

## Guardrails de copy

- [x] Voseo en mensajes de error ("No encontramos este comercio", "Necesitas conexion")
- [x] Tildes correctas en todos los strings (revisado manualmente -- ver seccion "Textos de usuario" del specs)
- [x] Terminologia: "comercio" (no "negocio"), "opiniones" (no "reviews")
- [x] Strings reutilizables en `src/constants/messages/businessDetail.ts`

---

## Fase final: Documentacion (OBLIGATORIA)

Incluida como Fase 7. Archivos a actualizar:

| Paso | Archivo | Cambio |
|------|---------|--------|
| 34 | `docs/reference/features.md` | Documentar flujo sheet compacto → pantalla full con chip tabs |
| 35 | `docs/reference/architecture.md` | Ruta `/comercio/:id` en arbol de rutas; sheet ya no tiene tabs |
| 36 | `docs/reference/patterns.md` | Nuevo patron "Pantalla full para entidad detallada"; update "Deep linking" |
| 37 | `docs/reference/project-reference.md` | Bump summary de features |
| 39 | `docs/_sidebar.md` | Agregar `Specs` y `Plan` bajo el PRD existente "Business Detail Screen" |

`docs/reference/security.md` y `docs/reference/firestore.md` no se actualizan (no hay cambios de rules ni colecciones). `HelpSection.tsx` posiblemente no cambia; se revisa.

---

## Criterios de done

- [ ] `/comercio/biz_xxx` abre pantalla full con header + chip tabs + contenido (Fase 2-3)
- [ ] Click en "Ver detalles" del sheet navega a `/comercio/:id` (Fase 2, 4)
- [ ] Sheet compacto ocupa <= 50dvh y solo muestra header + CTA (Fase 4)
- [ ] Back button desde pantalla full vuelve al mapa con el sheet abierto en el mismo comercio (Fase 4, restore via sessionStorage)
- [ ] Back button desde deep link directo (sin history) vuelve al mapa home (Fase 2, 4)
- [ ] URL compartida apunta a `/comercio/:id` y abre la pantalla full directa en el receptor (Fase 5)
- [ ] Deep link `/comercio/biz_001?tab=opiniones` abre con chip Opiniones activo (Fase 2, 3)
- [ ] Rating puntuado en el sheet aparece en la pantalla full sin refresh manual, y viceversa (verificado en tests, Fase 2)
- [ ] ID invalido muestra `BusinessNotFound reason=invalid_id` (Fase 2, 3)
- [ ] ID valido pero inexistente muestra `BusinessNotFound reason=not_found` (Fase 2, 3)
- [ ] Todos los tests existentes de `business/` siguen pasando (actualizados si testean tabs internos)
- [ ] Tests nuevos pasan con cobertura >= 80% del codigo nuevo
- [ ] `npm run lint` sin errores
- [ ] `npm run test:run` todo verde
- [ ] `npm run build` sin errores
- [ ] `npm run dev:full` + test manual: mapa -> sheet -> "Ver detalles" -> cambiar chips -> back -> sheet sigue abierto en el mismo comercio
- [ ] Docs actualizadas (Fase 7): `features.md`, `architecture.md`, `patterns.md`, `project-reference.md`, `_sidebar.md`
- [ ] Commit con mensaje descriptivo siguiendo la convencion del repo
