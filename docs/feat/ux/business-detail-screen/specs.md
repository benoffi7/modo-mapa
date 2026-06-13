# Specs: Business Detail Screen -- Sheet compacto + pantalla full con chip tabs

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-22

---

## Modelo de datos

Este feature es UI + routing. No se agregan ni modifican colecciones de Firestore, documentos, ni indices. Los tipos de datos existentes (`Business`, `Rating`, `Comment`, `UserTag`, `CustomTag`, `PriceLevel`, `MenuPhoto`) se mantienen intactos.

Los unicos tipos nuevos son de UI local:

```typescript
// src/types/businessDetail.ts (nuevo archivo)

/** Chip tabs de la pantalla full del comercio. */
export type BusinessDetailTab =
  | 'criterios'
  | 'precio'
  | 'tags'
  | 'foto'
  | 'opiniones';

/** Whitelist para validar query param `?tab=` en `/comercio/:id`. */
export const BUSINESS_DETAIL_TABS: readonly BusinessDetailTab[] = [
  'criterios',
  'precio',
  'tags',
  'foto',
  'opiniones',
] as const;
```

El tipo se re-exporta desde `src/types/index.ts`.

---

## Firestore Rules

Sin cambios. Este feature no introduce queries nuevas a Firestore. Todos los datos siguen fluyendo desde `useBusinessData` (que no se modifica) hacia los componentes hijos via props.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule que permite | Cambio necesario? |
|----------------------|------------|-------------|-----------------|-------------------|
| Sin queries nuevas | -- | -- | -- | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| Sin cambios | -- | -- | -- | No |

---

## Cloud Functions

Sin cambios. No se agregan triggers, scheduled functions ni callables.

---

## Seed Data

No aplica. Este feature no introduce colecciones nuevas ni campos nuevos. Los seeds existentes (`scripts/seed-admin-data.ts`, `scripts/seed-staging.ts`) no requieren modificacion.

---

## Componentes

### Arbol de componentes resultante

```text
App.tsx
  Routes
    /comercio/:id  ← NUEVO
      BusinessDetailPage (wrapper ruta con Suspense + validacion)
        BusinessDetailScreen
          [back button + BusinessSheetHeader (reutilizado, en modo "screen")]
          [sticky: chip tabs — 5 chips]
          [contenido del chip activo]
            └ CriteriaSection | PriceSection wrapper | TagsSection wrapper | MenuPhotoSection wrapper | OpinionesTab
    /*  (MapAppShell existente)
       TabShell
         ...
         BusinessSheet (compacto)
           BusinessSheetCompactContent  ← NUEVO (reemplaza BusinessSheetContent para el sheet)
             BusinessSheetHeader (reutilizado)
             CTA "Ver detalles"
```

### BusinessDetailPage (nuevo)

Wrapper de ruta. Encapsula el `useParams`, `useSearchParams`, validacion del `:id` contra `BUSINESS_ID_RE`, y validacion del `?tab=` contra `BUSINESS_DETAIL_TABS`. Se lee el `business` de `allBusinesses` (datos estaticos locales, misma fuente que `useDeepLinks`).

Ubicacion: `src/pages/BusinessDetailPage.tsx`

```typescript
export default function BusinessDetailPage() {
  // 1. useParams<{ id: string }>() → valida con BUSINESS_ID_RE
  // 2. useSearchParams() → valida `tab` contra BUSINESS_DETAIL_TABS
  // 3. busca el business en allBusinesses
  // 4. si no existe → renderiza BusinessNotFound
  // 5. si existe → renderiza <BusinessDetailScreen business={biz} initialTab={tab} />
}
```

Se registra con `lazy()` en `App.tsx` dentro de un `Suspense` con `AdminFallback`.

### BusinessDetailScreen (nuevo)

Pantalla full del comercio. Props-driven, sin queries internas (delega en `useBusinessData`).

Ubicacion: `src/components/business/BusinessDetailScreen.tsx`

```typescript
interface BusinessDetailScreenProps {
  business: Business;
  initialTab?: BusinessDetailTab;
}
```

**Contenido (en orden vertical):**

1. Back button (IconButton `ArrowBackIcon`, `aria-label="Volver al mapa"`) -- posicionado inline antes del header, mismo bloque que el nombre
2. `BusinessSheetHeader` (reutilizado, sin cambios) -- nombre, categoria, trending, botones de accion, `CheckInButton` + `DirectionsButton`, rating compacto + "Tu calificacion"
3. Sticky chip tabs (5 chips: `Criterios`, `Precio`, `Tags`, `Foto`, `Opiniones`)
4. Contenido del chip activo (render condicional por `display: none` para preservar state, patron de `OpinionesTab`)

**Comportamiento:**

- `useBusinessData(business.id)` provee datos
- `useBusinessRating({ ... })` provee el rating + criterios (misma fuente que el sheet)
- `useState<BusinessDetailTab>` inicializado con `initialTab ?? 'criterios'`
- Al cambiar chip: `setActiveChip(chip)` + `trackEvent(EVT_BUSINESS_DETAIL_TAB_CHANGED, { business_id, tab, previous_tab })` + `trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'comercio', tab: chip })`
- Back button: `useNavigate()` → `navigate(-1)` si hay history, o `navigate('/')` si es deep link directo (se detecta con `useLocation().key === 'default'`)
- Mount: `trackEvent(EVT_BUSINESS_DETAIL_OPENED, { business_id, source: initialTab ? 'deep_link' : 'sheet_cta' })` y `recordVisit(business.id)`

**Layout:**

```text
+------------------------------------------+
| [<- back]                                |
| BusinessSheetHeader (no sticky en screen)|
|   nombre, categoria, acciones            |
|   check-in + directions                  |
|   rating promedio + tu calificacion      |
+-- sticky boundary -----------------------+
| [Criterios][Precio][Tags][Foto]          |
|           [Opiniones]                    |
+------------------------------------------+
| (contenido del chip activo)              |
+------------------------------------------+
```

Nota: `BusinessSheetHeader` tiene `position: sticky; top: 0` hoy. En `BusinessDetailScreen` se reutiliza tal cual -- dado que el scroll container es `window` (o un `Box` con `overflow: auto`), sticky funciona igual.

### BusinessNotFound (nuevo)

Estado de error para ID invalido o no encontrado.

Ubicacion: `src/components/business/BusinessNotFound.tsx`

```typescript
interface BusinessNotFoundProps {
  reason: 'invalid_id' | 'not_found' | 'offline_no_cache';
}
```

Render: icono `ErrorOutlineIcon` + mensaje contextual + boton "Volver al mapa" (`navigate('/')`).

### BusinessSheetCompactContent (nuevo)

Reemplazo de `BusinessSheetContent` para el sheet compacto. Solo renderiza header + CTA, sin chips ni tabs.

Ubicacion: `src/components/business/BusinessSheetCompactContent.tsx`

```typescript
interface BusinessSheetCompactContentProps {
  business: Business;
}
```

**Contenido:**

1. `BusinessSheetHeader` (reutilizado, sin cambios) -- incluye "Tu calificacion" que usa el mismo hook
2. Boton `Button variant="contained"` full-width con label "Ver detalles" y `EastIcon` de MUI -- dispara `navigate(\`/comercio/${business.id}\`)`

No hay `useBusinessRating` redundante aqui -- lo usa `BusinessSheetHeader` a traves del prop `ratingData` que se calcula en este wrapper. La logica interna del hook garantiza que al escribir un rating en el sheet y abrir luego la pantalla full, el `useBusinessRating` de la pantalla full lee los mismos datos cacheados (via `useBusinessData` -> memory cache).

**Comportamiento:**

- Mount: `trackEvent('business_view', { ... })` (se preserva el evento actual)
- No hay tabs internos, no hay chip tabs
- Click "Ver detalles": `navigate(\`/comercio/${business.id}\`)` + `trackEvent(EVT_BUSINESS_DETAIL_CTA_CLICKED, { business_id })`

### BusinessSheet (modificado)

Se simplifica: el sheet solo muestra el `BusinessSheetCompactContent`. Se elimina el state `commentsDirty` y la logica de `useUnsavedChanges` (ya no hay inputs de comentario en el sheet).

Cambios:

1. Eliminar `commentsDirty`, `useUnsavedChanges`, `DiscardDialog`
2. Reemplazar `BusinessSheetContent` por `BusinessSheetCompactContent`
3. Eliminar `selectedBusinessTab` y `setSelectedBusinessTab` del uso (se consumen en la screen via query param)
4. `maxHeight: '50dvh'` (antes `85dvh`) en `PaperProps.sx` y en el `Box` interior
5. El `key={selectedBusiness.id}` se mantiene

### App.tsx (modificado)

Agregar ruta `/comercio/:id` antes de `/*`. Lazy load de `BusinessDetailPage`.

```typescript
const BusinessDetailPage = lazy(() => import('./pages/BusinessDetailPage'));

<Route
  path="/comercio/:id"
  element={
    <Suspense fallback={<AdminFallback />}>
      <BusinessDetailPage />
    </Suspense>
  }
/>
```

Importante: la ruta `/comercio/:id` queda **fuera** de `MapAppShell` -- es una pantalla independiente. Esto implica que `SelectionProvider`, `TabProvider`, `OnboardingProvider` no envuelven a la pantalla. Para mantener consistencia (ej: `FavoriteButton` lee del mismo estado de auth), la pantalla se envuelve en su propio arbol minimo:

```text
BusinessDetailPage
  FiltersProvider (para DirectionsButton userLocation)
  ↓
  BusinessDetailScreen
```

Los providers globales (`AuthProvider`, `ToastProvider`, `ConnectivityProvider`, `NotificationsProvider`) ya estan arriba en `App.tsx` y cubren ambas rutas.

**Alternativa considerada:** anidar `/comercio/:id` dentro de `MapAppShell`. Se rechaza porque implica renderizar el mapa en background (waste de recursos) y rompe el principio de "pantalla full independiente".

**Providers requeridos en `BusinessDetailPage`:**

- `FiltersProvider` -- `DirectionsButton` lee `userLocation` de `useFilters`. Sin este provider, el componente tira porque `useFilters` retorna default sin location.
- No se requiere `APIProvider` de Google Maps porque la pantalla no renderiza mapa.

### ShareButton (modificado)

Se actualiza el URL compartido para apuntar a `/comercio/:id` en vez de `/?business=:id`:

```typescript
const url = `${window.location.origin}/comercio/${business.id}`;
```

El receptor abre la pantalla full directa. El path `/?business=:id` sigue funcionando via `useDeepLinks` (backward compat), pero ya no es el link generado por share.

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| BusinessDetailScreen | business | ninguno (solo lectura) | NO | N/A |
| BusinessDetailScreen | initialTab | activeTab interno | SI (useState activeTab) | N/A (no hay parent callback; la screen es root) |
| BusinessSheetCompactContent | business | ninguno | NO | N/A |
| BusinessNotFound | reason | ninguno | NO | N/A |

El unico estado mutable es `activeTab` de la pantalla full, que se sincroniza con la URL via `setSearchParams` para que el back-button del navegador cambie de chip sin remount.

---

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Ver detalles" | CTA en sheet compacto | Sin tilde |
| "Volver al mapa" | aria-label del back button + boton de BusinessNotFound | Sin tilde |
| "Criterios" | Chip label en BusinessDetailScreen | Tilde implicita en el icono, texto simple |
| "Precio" | Chip label | Sin tilde |
| "Tags" | Chip label | Sin tilde |
| "Foto" | Chip label | Sin tilde |
| "Opiniones" | Chip label | Sin tilde |
| "No encontramos este comercio" | BusinessNotFound reason=not_found | Sin tilde |
| "El link parece estar roto" | BusinessNotFound reason=invalid_id | Sin tilde |
| "Necesitás conexión para ver este comercio." | BusinessNotFound reason=offline_no_cache | Con tildes (voseo rioplatense) |
| "No se pudo cargar la información del comercio." | DetailError (error online, inline en BusinessDetailScreen) | - |
| "Reintentar" | Botón en DetailError | - |

**Implementado:** `src/constants/messages/businessDetail.ts` (`MSG_BUSINESS_DETAIL`) re-exportado desde `constants/messages/index.ts`. `BusinessNotFound`, `BusinessDetailScreen` (DetailError inline), y `BusinessSheetCompactContent` consumen este objeto.

---

## Hooks

### useBusinessById (nuevo, thin wrapper)

El feature NO requiere un hook nuevo de Firestore porque los comercios son datos estaticos (`allBusinesses` de `useBusinesses.ts`). La busqueda es O(n) sobre un array en memoria.

Para no acoplar la pantalla al detalle de "comercios son estaticos", se crea un hook thin que encapsula la lookup:

Ubicacion: `src/hooks/useBusinessById.ts`

```typescript
interface UseBusinessByIdReturn {
  business: Business | null;
  status: 'found' | 'not_found' | 'invalid_id';
}

export function useBusinessById(id: string | undefined): UseBusinessByIdReturn;
```

Implementacion:

1. Si `id` es undefined o no matchea `BUSINESS_ID_RE` -> `{ business: null, status: 'invalid_id' }`
2. `allBusinesses.find((b) => b.id === id)` -> si existe, `{ business, status: 'found' }`
3. Si no -> `{ business: null, status: 'not_found' }`

No hace fetch de Firestore. Si en el futuro los comercios migran a Firestore, este hook se actualiza sin tocar la screen.

**Caching:** N/A (datos estaticos en memoria).

### useBusinessRating (existente, con ajustes menores)

Se consume tal cual en `BusinessSheetCompactContent` (a traves de `BusinessSheetHeader`) y en `BusinessDetailScreen`. La sincronizacion de "tu calificacion" entre sheet y screen funciona porque ambos consumen de `useBusinessData` que tiene cache en memoria con TTL 5min + escritura optimista via `refetch('ratings')`.

**Flujo de sync verificado:**

1. Usuario abre sheet -> `useBusinessData(biz.id)` carga y cachea
2. Usuario puntua -> `handleRate` escribe a Firestore + `onRatingChange` -> `refetch('ratings')` -> patcha cache
3. Usuario tapea "Ver detalles" -> `navigate('/comercio/biz_xxx')`
4. `BusinessDetailScreen` monta -> `useBusinessData(biz.id)` encuentra cache hit (mismo `businessId`) -> renderiza con los datos actualizados sin re-fetch
5. Usuario punta de nuevo en la screen -> misma ruta, cache patched
6. Back -> `MapAppShell` vuelve a montar (fue desmontado al navegar a /comercio/:id); `SelectionProvider` se reinicia -> `selectedBusiness === null`

**Consecuencia importante del step 6:** al volver del screen via back button, el sheet NO esta abierto porque `SelectionProvider` se remonto y perdio su state. El criterio 5 del PRD ("Back-button vuelve al mapa con el sheet abierto en el mismo comercio") requiere preservar esa seleccion. Ver seccion Integracion → "Preservacion de seleccion al volver".

---

## Servicios

Sin cambios. Todos los servicios existentes (`services/comments.ts`, `services/ratings.ts`, `services/businessData.ts`, etc.) se mantienen intactos.

---

## Integracion

### Preservacion de seleccion al volver

**Problema:** al navegar de `/` a `/comercio/:id`, `MapAppShell` (que contiene `SelectionProvider`) se desmonta. Al volver con back, el provider se monta con state inicial (`selectedBusiness: null`), por lo que el sheet no se reabre.

**Solucion:** persistir el ultimo `businessId` visto en `sessionStorage` cuando se navega al detail, y restaurar en `MapAppShell` al montar.

Implementacion:

1. En `BusinessSheetCompactContent`, justo antes de `navigate('/comercio/:id')`, guardar `sessionStorage.setItem('mm_last_business_sheet', business.id)`
2. En `useDeepLinks` (o un nuevo `useSheetRestore` hook), al montar: leer `sessionStorage.getItem('mm_last_business_sheet')`. Si existe y `location.pathname === '/'`, buscar el business y setear `selectedBusiness`. Limpiar la key despues (`sessionStorage.removeItem`).
3. La key se agrega a `src/constants/storage.ts` como `STORAGE_KEY_LAST_BUSINESS_SHEET`

Alternativa considerada: usar `useNavigate` con `state` y preservar via `location.state`. Rechazada porque se pierde si el usuario refresca la pagina en `/comercio/:id` (el state de react-router vive en el history entry, no en storage).

**Nota:** el back-button del navegador desde `/comercio/:id` que fue abierto como deep link directo (ej: desde un share externo) nunca tuvo sheet, asi que el criterio "reabrir el sheet en el mismo comercio" no aplica a esa variante. En ese caso, el back va al home del navegador (pagina anterior fuera de la app) o si el usuario llego directo, el boton back "Volver al mapa" de la screen hace `navigate('/')`.

### Validacion de `:id` y `?tab=`

- `:id` -> `BUSINESS_ID_REGEX = /^biz_\d{1,6}$/` exportado desde `src/constants/validation.ts` e importado en `useDeepLinks.ts` y `useBusinessById.ts`. Acepta exactamente el prefijo `biz_` seguido de 1 a 6 dígitos. Si no matchea, `useBusinessById` retorna `status: 'invalid_id'` y `BusinessDetailPage` renderiza `<BusinessNotFound reason="invalid_id" />`. Si matchea el formato pero no existe en el mapa, retorna `status: 'not_found'`.
- `?tab=` -> whitelist `BUSINESS_DETAIL_TABS`. Si no matchea, se ignora y se usa default `'criterios'`

### Analytics

Agregar en `src/constants/analyticsEvents/business.ts`:

```typescript
export const EVT_BUSINESS_DETAIL_OPENED = 'business_detail_opened';
export const EVT_BUSINESS_DETAIL_TAB_CHANGED = 'business_detail_tab_changed';
export const EVT_BUSINESS_DETAIL_CTA_CLICKED = 'business_detail_cta_clicked';
```

Eventos:

| Evento | Parametros | Donde se dispara |
|--------|-----------|-----------------|
| `business_detail_opened` | `{ business_id, source: 'deep_link' \| 'sheet_cta' }` | `BusinessDetailScreen` en mount |
| `business_detail_tab_changed` | `{ business_id, tab, previous_tab }` | Al clickear chip |
| `business_detail_cta_clicked` | `{ business_id }` | Al clickear "Ver detalles" en el sheet |
| `sub_tab_switched` (existente) | `{ parent: 'comercio', sub_tab: BusinessDetailTab }` | Al clickear chip (reutiliza el evento generico) |

Se mantiene el evento existente `business_sheet_tab_changed` para el sheet... pero como ya no hay tabs en el sheet, ese evento queda deprecated. Se documenta en la seccion "Decisiones tecnicas".

### Preventive checklist

- [x] **Service layer**: ningun componente importa `firebase/firestore`. `useBusinessData` ya encapsula las queries.
- [x] **Duplicated constants**: `BUSINESS_ID_RE` se importa de `useDeepLinks` (o se extrae a `src/constants/validation.ts` para reuso). **Accion:** extraer a `src/constants/validation.ts` como `BUSINESS_ID_REGEX` e importar desde ahi en `useDeepLinks.ts` y `useBusinessById.ts` (evita duplicacion).
- [x] **Context-first data**: `useBusinessData` cacheado cubre el caso de compartir datos entre sheet y screen.
- [x] **Silent .catch**: N/A.
- [x] **Stale props**: el unico prop mutable es `initialTab` de `BusinessDetailScreen`, y se maneja via `useState` local inicializado con el prop + sync via `searchParams`.

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/hooks/__tests__/useBusinessById.test.ts` | Retorna `found` con id valido, `not_found` con id valido-formato pero inexistente, `invalid_id` con id malformado o undefined | Hook |
| `src/pages/__tests__/BusinessDetailPage.test.tsx` | Renderiza `BusinessDetailScreen` con id valido, renderiza `BusinessNotFound` con id invalido/inexistente, parsea `?tab=opiniones` y lo pasa como `initialTab`, ignora tab invalido y usa default | Page |
| `src/components/business/__tests__/BusinessDetailScreen.test.tsx` | Render inicial en chip 'criterios', cambio de chip actualiza contenido, analytics se disparan en mount y cambio de chip, back button navega, sticky positioning del chip bar | Component |
| `src/components/business/__tests__/BusinessSheetCompactContent.test.tsx` | Render header + CTA, click en CTA navega a `/comercio/:id`, analytics CTA click se dispara, NO renderiza chips ni tabs | Component |
| `src/components/business/__tests__/BusinessSheet.test.tsx` (modificado) | Sheet en modo compacto renderiza `BusinessSheetCompactContent`, `maxHeight: 50dvh` aplicado, no hay `DiscardDialog` | Component |
| `src/components/business/__tests__/BusinessNotFound.test.tsx` | Render por cada `reason`, boton "Volver al mapa" navega a `/` | Component |
| `src/App.test.tsx` (modificado o nuevo) | `/comercio/biz_001` renderiza `BusinessDetailScreen`, `/comercio/invalid` renderiza `BusinessNotFound`, `/comercio/biz_001?tab=opiniones` abre con chip Opiniones | Integration |
| `src/hooks/__tests__/useDeepLinks.test.ts` (modificado) | `sessionStorage.mm_last_business_sheet` restaura `selectedBusiness` al montar en `/` | Hook |
| `src/components/business/__tests__/ShareButton.test.tsx` (modificado) | URL compartida ahora es `/comercio/:id` y no `/?business=:id` | Component |

### Mock strategy

- `react-router-dom` hooks (`useParams`, `useSearchParams`, `useNavigate`, `useLocation`): `vi.mock('react-router-dom', ...)` con implementaciones stub
- `useBusinessData`: mock return value con data fija para tests de `BusinessDetailScreen`
- `useBusinessRating`: mock para verificar propagacion al header
- `trackEvent`: `vi.mock('../../utils/analytics')` para verificar eventos

### Criterio de aceptacion

- Cobertura >= 80% del codigo nuevo (alineado con [docs/reference/tests.md](../../reference/tests.md))
- Tests pasan en CI
- Ningun test existente de `src/components/business/` se rompe (los que testean tabs internos del sheet se actualizan al nuevo flow sheet compacto → screen)

---

## Analytics

Ver seccion Integracion → Analytics. Resumen:

| Evento | Cuando |
|--------|--------|
| `business_detail_opened` | Mount de `BusinessDetailScreen` |
| `business_detail_tab_changed` | Cambio de chip en pantalla full |
| `business_detail_cta_clicked` | Click en "Ver detalles" del sheet |
| `sub_tab_switched` (existente) | Al clickear chip, con `parent: 'comercio'` |

---

## Offline

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Datos del comercio (ratings, comments, etc.) | 3-tier existente de `useBusinessData` | 5min mem / 24h IDB | Memory + IndexedDB |
| Datos estaticos (nombre, direccion, categoria) | JSON bundled | N/A | Bundle |
| Chip activo (pantalla full) | State local | Session | RAM |
| `activeTab` sync con URL | `searchParams` | Session | URL |
| Last business sheet ID para restore | `sessionStorage` | Session | sessionStorage |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Rating/comment/tag/etc. en pantalla full | Sin cambio (`withOfflineSupport` existente) | Last-write-wins (existente) |

### Fallback UI

- **Deep link offline sin cache:** si `/comercio/biz_xxx` se abre sin conexion y el businessId NO esta en IndexedDB cache, `useBusinessData` muestra error. `BusinessDetailScreen` detecta `data.error && isOffline` y renderiza `<BusinessNotFound reason="offline_no_cache" />`. Esta chequeo usa `useConnectivity()` dentro de `BusinessDetailScreen`.
- **Deep link offline con cache:** `useBusinessData` sirve desde IndexedDB con `stale: true`. Se renderiza `<StaleBanner />` como ya hace `BusinessSheetContent`.
- **Online normal:** sin cambios.

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| BusinessDetailScreen | IconButton back | "Volver al mapa" | 44x44px | N/A |
| BusinessDetailScreen | Chip (x5) | texto del chip | 36px height (ya tenemos NAV_CHIP_SX) | N/A |
| BusinessSheetCompactContent | Button "Ver detalles" | "Ver detalles del comercio" | 44x44px (MUI Button default) | N/A |
| BusinessNotFound | Button "Volver al mapa" | "Volver al mapa" | 44x44px | N/A |

### Reglas aplicadas

- Back button es `IconButton` con `aria-label` obligatorio
- Chips reutilizan patron de `ListsScreen` con `NAV_CHIP_SX` (36px height, dentro del minimo tolerable de touch target para mobile-first)
- Boton CTA usa `variant="contained"` con padding default MUI (cumple 44px)
- Deep link offline: `BusinessNotFound` con retry (boton "Volver al mapa") -- no skeleton forever
- El chip bar es `overflow: auto` para permitir scroll horizontal si no entran en una fila

---

## Textos y copy

Ver seccion "Textos de usuario". Todos los strings nuevos revisados manualmente para ortografia (sin tildes faltantes, voseo N/A porque son labels cortos).

### Reglas de copy

- "Ver detalles" en voseo implicito (no hay verbo conjugado; es sustantivado)
- "Volver al mapa" en infinitivo (correcto)
- Mensajes de error usan voseo: "No encontramos este comercio", "El link parece estar roto", "Necesitas conexion para ver este comercio"
- Terminologia: "comercio" (no "negocio"), "opiniones" (no "reviews")

---

## Decisiones tecnicas

### 1. Ruta fuera de `MapAppShell`

**Decision:** `/comercio/:id` se registra en `App.tsx` al mismo nivel que `/*`, no anidada. `MapAppShell` se desmonta al navegar al detail.

**Razon:** pantalla full independiente, no waste de recursos del mapa en background, limites claros entre "la app con mapa" y "la pantalla del comercio".

**Consecuencia:** se necesita `sessionStorage` para restaurar seleccion del sheet al volver (ver Integracion → Preservacion de seleccion al volver).

### 2. 5 chips separados vs agrupados

**Decision:** 5 chips (`Criterios`, `Precio`, `Tags`, `Foto`, `Opiniones`), consistente con la decision aprobada del PRD.

**Alternativa:** 2 chips (`Info` y `Opiniones`) igual que el sheet actual. Rechazada por el PRD -- la pantalla full aprovecha el espacio para granularidad mayor.

### 3. Comercios estaticos vs Firestore

**Decision:** `useBusinessById` lee de `allBusinesses` (JSON local), no de Firestore. El hook es un thin wrapper para encapsular la implementacion.

**Razon:** los comercios son datos estaticos en el proyecto actual. El patron existente (`useDeepLinks`, `useBusinesses`) lee de `allBusinesses`.

**Futuro:** si se migran a Firestore, se actualiza `useBusinessById` y el resto del feature funciona sin cambios.

### 4. Validacion `?tab=` como query param, no path segment

**Decision:** `/comercio/:id?tab=opiniones` en vez de `/comercio/:id/opiniones`.

**Razon:** query param es opcional y no requiere rutas adicionales. Alinea con el patron existente de `useDeepLinks` (`?business=`, `?tab=`).

### 5. Sync "tu calificacion" via `useBusinessData` cache

**Decision:** no hay state local duplicado. Ambos usos (sheet y screen) consumen `useBusinessData(businessId)` que cachea en memoria con TTL 5min + `refetch('ratings')` post-escritura.

**Razon:** el cache ya existe y es fuente unica de verdad. No se necesita un nuevo provider ni un atom global.

**Verificacion:** test de integracion en `BusinessDetailScreen.test.tsx` mockea `useBusinessData` con distintos valores entre renders y verifica que `BusinessRating` muestra el valor actualizado sin re-fetch.

### 6. `business_sheet_tab_changed` queda deprecated

**Decision:** el evento existente deja de dispararse cuando el sheet pierde sus tabs. La constante se mantiene en `analyticsEvents` con JSDoc `@deprecated` por 1 ciclo, luego se remueve.

**Razon:** backward compat del reporting de analytics (GA4 ya tiene histograma). Se agrega un comentario "desde v2.X.Y ya no se dispara" para contexto.

### 7. ShareButton apunta a `/comercio/:id` (no `/?business=:id`)

**Decision:** el URL compartido apunta al detail screen directo. `useDeepLinks` sigue procesando `?business=` para backward compat con links viejos.

**Razon:** consistente con el principio aprobado del PRD: "el receptor abre la pantalla full directa, no el sheet sobre el mapa".

---

## Hardening de seguridad

### Firestore rules requeridas

Ningun cambio a `firestore.rules`. No hay queries nuevas.

### Rate limiting

N/A. No hay writes nuevos.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Inyeccion de `:id` malformado | `BUSINESS_ID_REGEX` whitelist en `BusinessDetailPage` antes de pasar a `useBusinessData` | `src/pages/BusinessDetailPage.tsx`, `src/hooks/useBusinessById.ts` |
| Inyeccion de `?tab=` con valor random | `BUSINESS_DETAIL_TABS` whitelist antes de setear `initialTab` | `src/pages/BusinessDetailPage.tsx` |
| XSS via nombre del comercio en compartir URL | N/A -- la URL solo contiene el ID, no el nombre. El nombre se renderiza via React (escapado). | `src/components/business/ShareButton.tsx` |
| Deep link a comercio inexistente (enumeracion de IDs) | `BusinessNotFound` muestra el mismo mensaje generico, no confirma existencia ni ausencia. La unica info es que el formato es valido. | `src/components/business/BusinessNotFound.tsx` |

---

## Deuda tecnica: mitigacion incorporada

Consulta realizada:

```bash
gh issue list --label security --state open
gh issue list --label "tech debt" --state open
```

Issues relevantes que se pueden abordar como parte de este feature:

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| (ninguno especifico hoy) | -- | -- |

Si durante la implementacion se detecta deuda tecnica en archivos que se estan tocando (ej: `BusinessSheet.tsx`), se incluye el fix como paso adicional antes de cerrar la fase correspondiente.

**No-aggravation:** al simplificar `BusinessSheet.tsx` (eliminar `useUnsavedChanges`, tabs, dirty tracking), el archivo reduce a ~60 lineas. No se introduce deuda nueva.

---
