# PRD: Refactor BusinessSheet — Reducir scroll y mejorar navegacion

**Feature:** refactor-business-sheet
**Categoria:** ux
**Fecha:** 2026-03-27
**Issue:** N/A (refactor interno)
**Prioridad:** Alta

---

## Contexto

El BusinessSheet (`src/components/business/BusinessSheet.tsx`) es el bottom sheet que muestra todo el detalle de un comercio. Actualmente contiene 8 secciones apiladas verticalmente (header, acciones, check-in, rating con criterios expandibles, nivel de gasto, tags, foto de menu, tabs comentarios/preguntas) que obligan al usuario a hacer scroll extenso para llegar al contenido que le interesa. La carpeta `business/` suma 3,629 lineas en 25 archivos, con duplicacion significativa entre `BusinessComments` (443 lineas) y `BusinessQuestions` (406 lineas).

## Problema

- **Scroll excesivo**: el usuario debe desplazarse por 8 secciones completas para llegar a comentarios o preguntas, que estan al final del sheet. En mobile (target principal de la app), esto degrada la experiencia significativamente
- **Contenido oculto por posicion**: las secciones mas interactivas (comentarios, preguntas) quedan debajo del fold, reduciendo su descubrimiento y uso
- **Duplicacion de codigo**: BusinessComments y BusinessQuestions comparten ~70% de su estructura (hooks de likes, undo delete, connectivity, profile visibility, reply forms, sorting/thread logic), pero no hay una abstraccion comun

## Solucion

### Analisis de alternativas UX

#### Opcion 1: Tabs internos (2-3 tabs)

Agrupar secciones en tabs como "Info" / "Opiniones" / "Fotos".

- **Pros**: separacion clara, reduce scroll drasticamente, patron conocido
- **Contras**: oculta contenido, requiere taps extra para explorar, rompe el flujo de descubrimiento natural
- **Veredicto**: buena opcion pero pierde la visibilidad inmediata de rating y tags que son importantes para la primera impresion

#### Opcion 2: Accordion/secciones colapsables

Cada seccion se expande/colapsa individualmente.

- **Pros**: usuario ve todos los titulos, abre lo que necesita
- **Contras**: muchos taps para explorar, estado por defecto (todo cerrado o todo abierto) nunca es ideal, no reduce realmente el problema si las secciones expandidas son largas
- **Veredicto**: no resuelve el problema core, lo desplaza

#### Opcion 3: Sticky header + navegacion por secciones

Header fijo con pills de navegacion que hacen scroll a anclas. Similar a Google Maps.

- **Pros**: familiar (Google Maps usa este patron), todo el contenido accesible, no oculta nada
- **Contras**: sigue siendo un scroll largo, las pills ocupan espacio vertical
- **Veredicto**: mejora la navegacion pero no reduce la longitud total

#### Opcion 4: Sheet de dos niveles

Media altura muestra resumen (header + rating + acciones), altura completa revela todo.

- **Pros**: progressive disclosure efectivo, primera impresion limpia
- **Contras**: complejidad de gestos, MUI `SwipeableDrawer` no soporta snap points nativos, requeriria libreria adicional o implementacion custom
- **Veredicto**: demasiada complejidad de implementacion para el beneficio

#### Opcion 5 (Recomendada): Hibrido — Sticky header + tabs ampliados

Combinar un header compacto sticky con tabs que agrupen TODO el contenido debajo.

**Layout propuesto**:

```text
+----------------------------------+
| [drag handle]                    |
| Header: nombre, categoria,      |
|   trending badge                 |
| Acciones: fav, share, recommend, |
|   lista, check-in, directions   |
| Rating compacto: promedio +      |
|   estrellas del usuario          |
+-- sticky boundary ---------------+
| [Info] [Opiniones] [Fotos]       |
+----------------------------------+
| (contenido del tab activo)       |
|                                  |
+----------------------------------+
```

**Tab "Info"** (default):
- Criterios de rating (expandible, ya existe)
- Nivel de gasto
- Tags (predefinidos + custom)

**Tab "Opiniones"**:
- Sub-tabs existentes: Comentarios / Preguntas (reutilizar logica actual)

**Tab "Fotos"**:
- MenuPhotoSection (foto de menu actual)
- Espacio preparado para futuras fotos del local (#fotos-local)

**Ventajas de este enfoque**:
- El header + rating (la info mas consultada) siempre visible sin scroll
- 3 tabs reducen el scroll dentro de cada tab a ~1/3 del actual
- Los sub-tabs de Comentarios/Preguntas se mantienen intactos (no se rompe logica existente)
- El tab "Fotos" prepara la arquitectura para la feature de fotos del local (issue pendiente)
- Patron `Tabs` de MUI ya usado en el proyecto (BusinessSheet ya tiene tabs para comentarios/preguntas)
- Sticky header usa CSS puro (`position: sticky`), sin librerias adicionales

**Consideraciones UX**:
- El rating compacto en el header muestra solo promedio + estrellas del usuario (1 linea). El desglose por criterios se mueve al tab Info
- Los action buttons se compactan en una fila horizontal con `IconButton` (ya son iconos, solo se reorganizan)
- Deep linking: `?business={id}&tab=opiniones` para abrir directamente en un tab (extension del deep link existente)
- Animacion: fade transition entre tabs (200ms, consistente con el fadeIn actual del sheet)

### S1: Refactor de estructura (tabs + sticky header)

1. Crear componente `BusinessSheetHeader` que encapsule: header, acciones, rating compacto
2. Hacer el header sticky dentro del scroll container del `SwipeableDrawer`
3. Reemplazar la seccion lineal actual por `Tabs` de MUI con 3 tabs: Info, Opiniones, Fotos
4. Mover las secciones existentes a sus respectivos tabs sin cambiar su logica interna
5. Agregar soporte para deep link con tab (`?business={id}&tab=info|opiniones|fotos`)

### S2: Refactor de codigo — Extraer base comun de comentarios/preguntas

1. Crear `useCommentListBase` hook que encapsule la logica compartida entre BusinessComments y BusinessQuestions:
   - Optimistic likes (`useOptimisticLikes`)
   - Undo delete (`useUndoDelete`)
   - Profile visibility (`useProfileVisibility`)
   - Connectivity check (`useConnectivity`)
   - Submit/delete/like handlers
2. Simplificar BusinessComments y BusinessQuestions para que usen el hook base y solo definan su logica especifica (sorting en comments, best answer en questions)

### S3: Extraer CriteriaSection de BusinessRating

1. Extraer la seccion de criterios expandible (~120 lineas) a un componente `CriteriaSection`
2. `CriteriaSection` recibe `criteriaAverages`, `myCriteria`, `onCriteriaChange` como props
3. BusinessRating queda como componente compacto (~100 lineas) que muestra promedio + estrellas + boton "Ver criterios"

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| `BusinessSheetHeader` — componente sticky con header + acciones + rating compacto | Must | M |
| 3 tabs (Info / Opiniones / Fotos) en BusinessSheet | Must | M |
| Mover secciones existentes a sus tabs respectivos | Must | S |
| Deep link con tab parameter (`&tab=`) | Should | S |
| `useCommentListBase` hook — logica compartida comments/questions | Must | M |
| Simplificar BusinessComments usando hook base | Must | M |
| Simplificar BusinessQuestions usando hook base | Must | M |
| Extraer `CriteriaSection` de BusinessRating | Should | S |
| Fade transition entre tabs | Nice | S |
| Analytics: `business_tab_changed` event | Should | S |
| Actualizar `BusinessSheetSkeleton` para nuevo layout | Must | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Cambiar el componente `SwipeableDrawer` por una libreria con snap points (ej. react-spring-bottom-sheet)
- Agregar fotos del local (feature separada, #fotos-local). El tab "Fotos" solo muestra la foto de menu existente
- Redisenar el rating UI (solo se reorganiza, no se cambia la interaccion)
- Virtualizar listas de comentarios dentro del sheet (ya existe `useVirtualizedList` en CommentsList del menu lateral, pero no aplica al sheet donde los comentarios son pocos por comercio)
- Cambiar la mecanica de carga de datos (`useBusinessData` se mantiene intacto)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/hooks/useCommentListBase.ts` | Hook | Inicializacion, handlers de like/delete/submit, integracion con useOptimisticLikes y useUndoDelete, error handling |
| `src/components/business/BusinessSheetHeader.tsx` | Component | Render con/sin trending, render con/sin usuario autenticado (botones condicionales), rating compacto |
| `src/components/business/CriteriaSection.tsx` | Component | Expand/collapse, render de promedios, interaccion con estrellas de criterio |
| `src/components/business/BusinessSheet.tsx` | Component | Tab switching, deep link parsing, default tab, skeleton while loading |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (tabs, estados de auth, offline)
- Side effects verificados (analytics `business_tab_changed`, deep link update)

---

## Seguridad

Este refactor es puramente de UI/UX frontend. No agrega nuevas colecciones, escrituras a Firestore, ni inputs de usuario. Los items de seguridad relevantes:

- [ ] No se introduce `dangerouslySetInnerHTML` en componentes nuevos
- [ ] Los action buttons mantienen sus guards de autenticacion existentes (recommend/addToList solo para no-anonimos)
- [ ] El deep link parameter `tab` se valida contra valores permitidos (`info|opiniones|fotos`), no se interpreta como HTML/JS
- [ ] No se exponen datos nuevos que no estuvieran ya visibles

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Render de tabs y header | read (local state) | N/A — pure UI | N/A |
| Todas las operaciones de datos | read/write | Sin cambio — la logica de datos (`useBusinessData`, servicios) no se modifica | `StaleBanner` existente, `OfflineIndicator` existente |

### Checklist offline

- [x] Reads de Firestore: sin cambio, usan persistencia offline existente via `useBusinessData`
- [x] Writes: sin cambio, `withOfflineSupport` ya wrappea todas las escrituras
- [x] APIs externas: no hay nuevas
- [x] UI: `OfflineIndicator` existente cubre el contexto
- [x] Datos criticos: cache 3-tier existente los cubre

### Esfuerzo offline adicional: S (ninguno real, solo verificar que no se rompe)

---

## Modularizacion

Este refactor mejora activamente la modularizacion del proyecto:

- `BusinessSheetHeader` extrae la logica de header/acciones del orquestador `BusinessSheet`
- `useCommentListBase` elimina duplicacion entre BusinessComments y BusinessQuestions
- `CriteriaSection` extrae logica de UI del monolitico BusinessRating
- Cada tab content es un componente independiente que recibe datos via props (patron `Props-driven business components` ya establecido)

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services (no inline en componentes de layout) — `useCommentListBase` centraliza logica compartida
- [ ] Componentes nuevos son reutilizables fuera del contexto actual de layout — `CriteriaSection` y `BusinessSheetHeader` son props-driven
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas en vez de dependencias implicitas a contextos de layout — todos los componentes nuevos reciben datos via props
- [ ] Cada prop de accion (onClick, onSelect, onNavigate) tiene un handler real especificado — nunca noop `() => {}`

---

## Success Criteria

1. El usuario puede ver el header, acciones y rating promedio sin hacer scroll al abrir el BusinessSheet
2. El usuario puede navegar entre Info, Opiniones y Fotos con un tap, sin scroll
3. BusinessComments y BusinessQuestions comparten logica via `useCommentListBase`, eliminando al menos 150 lineas de duplicacion
4. Todos los tests existentes del folder `business/` siguen pasando sin modificaciones (excepto los que testeen estructura de render)
5. El deep link `?business={id}&tab=opiniones` abre el sheet directamente en el tab de opiniones
