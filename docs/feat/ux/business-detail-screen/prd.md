# PRD: Business Detail Screen — Sheet compacto + pantalla full con chip tabs

**Feature:** business-detail-screen
**Categoria:** ux
**Fecha:** 2026-04-22
**Issue:** N/A (refactor interno, continuacion de `refactor-business-sheet`)
**Prioridad:** Alta

---

## Contexto

El `BusinessSheet` fue refactorizado en marzo 2026 (ver [docs/feat/ux/refactor-business-sheet](../refactor-business-sheet/prd.md)) para introducir sticky header y 2 tabs internos (Info / Opiniones). A pesar del refactor, el sheet sigue siendo grande (~786 lineas en 25 archivos de `src/components/business/`) y sigue obligando al usuario a hacer scroll dentro del tab Info para atravesar criterios, precio, tags y foto antes de llegar a Opiniones.

El patron "bottom sheet como contenedor de TODO" tiene un techo: por mas que se reduzca, compite con el mapa por espacio vertical. Para contenido denso se necesita una pantalla completa.

En paralelo, `ListsScreen` estrena un patron de chip tabs (horizontal, scrollable, con iconos) que esta recibiendo buena recepcion y no se esta reutilizando en otros lugares.

## Problema

- **El sheet sigue grande**: aun con 2 tabs, el tab Info acumula criterios + precio + tags + foto, forzando scroll dentro del sheet. En un dispositivo mobile medio el sheet ocupa hasta 85dvh y el contenido denso lo vuelve incomodo
- **No hay deep link compartible**: el sheet se abre via `SelectionContext` + `setActiveTab('buscar')` (ver [useNavigateToBusiness.ts](src/hooks/useNavigateToBusiness.ts)). No hay URL por comercio, por lo que no se puede compartir un link directo a "este comercio" ni volver con el back-button del navegador
- **Inconsistencia de patrones**: los tabs internos del sheet son MUI Tabs clasicos, mientras que `ListsScreen` usa chips. Introducir chip tabs en una pantalla dedicada al comercio alinea el vocabulario visual

## Solucion

### Concepto general

**Principio rector:** la pantalla full es la vista canonica del comercio. El sheet es una vista reducida / preview sobre el mapa, pero todo lo que muestra el sheet **tambien** esta en la pantalla full (nunca al reves: ninguna info critica solo existe en el sheet).

1. **Achicar el sheet** a lo minimo de "primera impresion":
   - Header (nombre, favorite, share, recommend, addToList) — sin check-in (decisión: check-in queda solo en la pantalla full)
   - Rating promedio
   - CTA primario **"Ver detalles"** que navega a `/comercio/:id`
   - Nota de implementación: "Tu calificacion" se omitió del sheet compacto para mantenerlo ultra-compacto. Issue [#318](https://github.com/benoffi7/modo-mapa/issues/318) item #5 documenta la decisión pendiente.

2. **Crear `BusinessDetailScreen`** (pantalla full, ruta nueva `/comercio/:id`):
   - Header del comercio (nombre, fav/share/recommend/addToList/check-in) + boton back
   - Rating promedio + **Tu calificacion** (en header via `useBusinessRating`)
   - **Chip tabs** horizontales (patron de `ListsScreen`): `Criterios` | `Precio` | `Tags` | `Foto` | `Opiniones`
   - Cada chip renderiza la seccion correspondiente (componentes existentes, reusados sin cambios de logica)

3. **Sync de "tu calificacion"**: el input de rating es el mismo componente controlado en ambos lugares, leyendo del mismo hook (`useBusinessData` / rating hook). Puntuar en el sheet refleja en la pantalla full al instante, y viceversa. No hay estado local duplicado.

### Layout propuesto

**Sheet compacto (hasta 50% de la pantalla):**

```text
+----------------------------------+
| [drag handle]                    |
| Header: nombre, categoria        |
| Acciones: fav, share, check-in,  |
|   directions                     |
+----------------------------------+
| Rating promedio (estrellas)      |
| Tu calificacion (input)          |
+----------------------------------+
| [  Ver detalles  ]  <- CTA       |
+----------------------------------+
```

**Pantalla full `/comercio/:id`:**

```text
+----------------------------------+
| [<- Volver]  Header del comercio |
| nombre, categoria, trending      |
| Acciones: fav, share, check-in,  |
|   directions                     |
+----------------------------------+
| Rating promedio (estrellas)      |
| Tu calificacion (input)          |
+-- sticky boundary ---------------+
| [Criterios][Precio][Tags][Foto]  |
|           [Opiniones]            |
+----------------------------------+
| (contenido del chip activo)      |
|                                  |
+----------------------------------+
```

Nota: chips sticky bajo el header + rating. El bloque header + rating es superset de lo que muestra el sheet.

### Rutas y navegacion

- Nueva `Route path="/comercio/:id"` en [App.tsx](src/App.tsx) (hoy solo expone `/dev/*`, `/admin/*`, `/*`)
- Click en "Ver detalles" → `navigate(\`/comercio/${businessId}\`)`
- Back-button del navegador vuelve al mapa con el sheet abierto en el mismo comercio (el `SelectionContext` se preserva mientras se navega dentro de la SPA)
- Deep link: abrir `/comercio/:id` directo carga la pantalla full sin pasar por el sheet (fetch del business por ID, loading state)
- Compartir URL: tanto el share del sheet como el share de la pantalla full copian la URL `/comercio/:id`. El receptor abre la pantalla full **directa** (no el sheet sobre el mapa)

### Chip tabs

- Patron identico al de [ListsScreen.tsx:55-71](src/components/lists/ListsScreen.tsx#L55-L71)
- `Chip` MUI, `variant="filled"` activo / `"outlined"` inactivo
- `NAV_CHIP_SX` (constante existente en `constants/ui`)
- Estado local (`useState<BusinessDetailTab>`) inicializado desde query param `?tab=` para permitir deep link con tab
- Analytics: `EVT_SUB_TAB_SWITCHED` con `parent: 'comercio'`, `sub_tab: <chip>`
- Scroll horizontal si no entran en una fila (ya manejado por `overflow: 'auto'` del contenedor)

### Mapeo de secciones a chips

| Chip | Contenido | Fuente actual |
|------|-----------|---------------|
| Criterios | Criterios de rating detallados (expandible hoy) | `CriteriaSection` existente |
| Precio | Nivel de gasto | `PricingSection` existente en BusinessSheetContent |
| Tags | Tags predefinidos + custom | `TagsSection` existente |
| Foto | Foto de menu | `MenuPhotoSection` existente |
| Opiniones | Sub-tabs Comentarios / Preguntas | `OpinionesTab` existente |

### Sync de "tu calificacion"

- El input de rating (componente `BusinessRating` o equivalente) se renderiza en ambos lugares: sheet y pantalla full
- Ambos leen del mismo hook (`useBusinessData` / `useUserRating`). Al escribir en uno, el otro se actualiza via Firestore realtime o refetch
- No hay estado local duplicado: mismo componente controlado, mismos props, mismos handlers
- El chip "Criterios" de la pantalla full tambien muestra el rating por criterio (detalle granular), consistente con lo que ya hay en el sheet actual

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Nueva ruta `/comercio/:id` en `App.tsx` | Must | S |
| Componente `BusinessDetailScreen` (layout + header + chips) | Must | M |
| Chip tabs: Criterios, Precio, Tags, Foto, Opiniones | Must | S |
| CTA "Ver detalles" en `BusinessSheet` (reemplaza tabs internos) | Must | S |
| Sheet compacto: remover todo el tab Info/Opiniones del sheet | Must | M |
| Hook `useBusinessById` o extension de `useBusinessData` para cargar comercio por ID desde URL (deep link) | Must | M |
| Loading state cuando se entra por URL directa a `/comercio/:id` | Must | S |
| Error state si el ID no existe o no se encuentra | Must | S |
| Back-button: vuelve al mapa con sheet reabierto en el mismo comercio | Should | S |
| Share del sheet y de la pantalla full comparten URL `/comercio/:id` | Should | S |
| Deep link con chip activo: `?tab=opiniones` | Should | S |
| Analytics: `business_detail_opened`, `business_detail_tab_changed`, `business_detail_cta_clicked` | Should | S |
| Actualizar `BusinessSheetSkeleton` al nuevo layout compacto | Must | S |
| Skeleton para `BusinessDetailScreen` | Must | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Cambiar la mecanica interna de cada seccion (Criterios, Precio, Tags, Foto, Opiniones). Solo se mueven al nuevo contenedor, no se redisenan
- Cambiar el `SwipeableDrawer` por otra libreria de bottom sheet
- Agregar nuevas secciones (fotos del local, menu completo, etc.) — quedan para features futuras, el patron de chip tabs hace trivial sumarlas
- Redisenar el rating UI
- Modificar reglas de Firestore o servicios (es solo UI y routing)
- Deep link via sistema operativo (Android App Links, iOS Universal Links) — solo funciona el link web

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/business/BusinessDetailScreen.tsx` | Component | Render con business prop, parse de `?tab=` query param, cambio de chip, loading/error states, back navigation |
| `src/components/business/BusinessSheet.tsx` | Component | Sheet compacto muestra solo header + rating + tu calificacion + CTA, click en "Ver detalles" navega a `/comercio/:id` |
| `src/hooks/useBusinessById.ts` (o extension de useBusinessData) | Hook | Fetch por ID, loading, error, cache hit |
| `src/App.tsx` (route test) | Integration | `/comercio/:id` renderiza `BusinessDetailScreen`, ID invalido muestra error |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (alineado con [docs/reference/tests.md](docs/reference/tests.md))
- Tests de integracion para la navegacion sheet ↔ pantalla full (preservacion de estado de seleccion)
- Tests de deep link: abrir `/comercio/:id` sin pasar por el mapa
- Tests de sync: rating seteado en sheet se refleja en pantalla full (mismo query)
- Todos los tests existentes de `business/` siguen pasando (o se actualizan si testean el tab Info/Opiniones interno)

---

## Seguridad

Este refactor es de UI + routing, sin cambios de datos. Checklist:

- [ ] El parametro `:id` de la ruta se valida antes de usar en query a Firestore (sanitizacion basica, regex de ID esperado)
- [ ] El query param `?tab=` se valida contra whitelist (`criterios|precio|tags|foto|opiniones`), no se interpreta como HTML/JS
- [ ] No se introduce `dangerouslySetInnerHTML`
- [ ] Deep link a `/comercio/:id` respeta las reglas de Firestore existentes (si el comercio no es publico, Firestore devuelve denied y mostramos error state, nunca data parcial)
- [ ] Las acciones autenticadas (rating, comments, etc.) mantienen sus guards de auth existentes
- [ ] Share de URL `/comercio/:id` no expone datos privados (solo el ID publico)

---

## Offline

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|-------------------|-------------|
| Cargar comercio por ID (deep link) | read | Cache existente de `useBusinessData` + persistencia Firestore offline | `StaleBanner` si es cache viejo, error state si nunca se cargo |
| Render de tabs, header, rating | read (local state) | N/A — pure UI | N/A |
| Rating / comentarios / preguntas | write | Sin cambio — `withOfflineSupport` ya wrappea | `OfflineIndicator` existente |

### Checklist offline

- [x] Reads Firestore: `useBusinessData` mantiene persistencia offline existente
- [x] Writes: sin cambio
- [x] Deep link offline: si el comercio esta en cache, funciona; si no, error state con mensaje claro ("Necesitas conexion para ver este comercio por primera vez")
- [x] Navegacion SPA: react-router funciona offline (no requiere server)
- [x] `OfflineIndicator` y `StaleBanner` existentes cubren la pantalla nueva

### Esfuerzo offline adicional: S (solo verificar deep link sin cache)

---

## Modularizacion

- `BusinessDetailScreen` es un componente nuevo independiente, props-driven (recibe `businessId` via route param, resto via hooks)
- Reutiliza componentes de seccion existentes (`CriteriaSection`, `PricingSection`, `TagsSection`, `MenuPhotoSection`, `OpinionesTab`) sin modificarlos
- El CTA "Ver detalles" es un boton simple que dispara `navigate()`, sin contexto nuevo
- Extraer `useBusinessById` (o similar) si no existe, separando la logica de "cargar por ID" de la de "cargar seleccionado actualmente"

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (fetch por ID en hook, no inline en componente)
- [ ] Componentes nuevos reutilizables — `BusinessDetailScreen` puede abrirse desde cualquier lugar via `navigate`
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas, sin dependencias implicitas a contextos de layout
- [ ] Cada prop de accion (onClick, onTabChange, onBack) tiene handler real, sin noops

---

## Success Criteria

1. El `BusinessSheet` ocupa como maximo ~50dvh y muestra solo header + rating + tu calificacion + CTA "Ver detalles"
2. Click en "Ver detalles" navega a `/comercio/:id` y muestra la pantalla full con chip tabs
3. La URL `/comercio/:id` es compartible: abrirla en una pestana nueva muestra el mismo comercio
4. La puntuacion del usuario se sincroniza entre sheet y pantalla full sin refresh manual
5. Back-button del navegador desde `/comercio/:id` vuelve al mapa con el sheet abierto en el mismo comercio
6. Deep link con chip: `/comercio/:id?tab=opiniones` abre directo en el chip Opiniones
7. Todos los tests existentes de `business/` pasan (actualizados si hace falta)
8. Cobertura del codigo nuevo >= 80%

---

## Decisiones aprobadas (2026-04-22)

- [x] **Path**: `/comercio/:id`
- [x] **Chips**: 5 chips separados — `Criterios` | `Precio` | `Tags` | `Foto` | `Opiniones`
- [x] **Tu calificacion**: replicada en **ambos** (sheet y pantalla full), sync via mismo hook
- [x] **Share URL**: el receptor abre la pantalla full directa, no el sheet sobre el mapa
- [x] **Principio**: todo lo del sheet esta tambien en la pantalla full (nunca al reves)
