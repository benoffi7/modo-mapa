# PRD: Tech debt — setMetaTag util + chip focus on mount + noop onDirtyChange

**Feature:** 319-techdebt-meta-chipfocus-dirty
**Categoria:** infra
**Fecha:** 2026-04-23
**Issue:** #319
**Prioridad:** Media

---

## Contexto

Durante la auditoria de merge de `fix/318-remaining-items` (remainder de #318, review post-implementacion del feature `business-detail-screen`) se detectaron 3 hallazgos de arquitectura que no eran bloqueantes pero que quedan como deuda del feature. Este issue los consolida para atacarlos juntos sin mezclarlos con cambios funcionales, siguiendo la misma estrategia usada en #312-#317.

## Problema

- `setMetaTag()` esta inlined en `src/pages/BusinessDetailPage.tsx` (lineas 11-19). Es una utilidad generica de manipulacion del DOM (`<meta property=...>`) que va a necesitarse en mas paginas a medida que se agreguen rutas con OG tags (perfil publico, lista publica, etc.). Actualmente no es reutilizable porque vive dentro de la pagina.
- El `useEffect(() => { chipRefs.current[activeIdx]?.focus(); }, [activeIdx])` en `BusinessDetailScreen.tsx` (lineas 117-119) se dispara en el mount inicial con `activeIdx=0`, robando foco del resto de la pagina al cargar. El foco programatico deberia ocurrir solo como respuesta a una accion del usuario (click o teclado sobre un chip), no en el primer render.
- `OpinionesTab.tsx` define `onDirtyChange` como prop *requerida* (linea 15) pero en `BusinessDetailScreen.tsx` (linea 336) se pasa como `() => {}` noop. La pagina full no tiene dialogo de salida con confirmacion, por lo que el "dirty" no tiene consumidor real. Mantener el prop con noop viola la regla `feedback_no_placeholder_props` (todo prop debe ser funcional).

## Solucion

### S1 — Extraer `setMetaTag` a `src/utils/meta.ts`

Crear `src/utils/meta.ts` exportando `setMetaTag(property: string, content: string): void`. La implementacion preserva el comportamiento actual: buscar `<meta property="...">` existente o crear uno nuevo en `document.head`. Mover el hook `useBusinessPageMeta` a `src/hooks/useBusinessPageMeta.ts` (al archivo de hooks, no en `pages/`). `BusinessDetailPage.tsx` queda reducido a importar el hook y llamarlo. Mantenemos el naming `setMetaTag` del issue — no inventamos API nueva.

Referencia de patron: ya existen utilidades genericas de DOM en `src/utils/` (ver `media.ts`, `formatDate.ts`). Los hooks que manipulan DOM via `useEffect` viven en `src/hooks/` (ver `useActivityReminder.ts`).

### S2 — Chip focus solo en interaccion del usuario

Eliminar el `useEffect(() => { chipRefs.current[activeIdx]?.focus(); }, [activeIdx])` (lineas 117-119 de `BusinessDetailScreen.tsx`). En su lugar, llamar `chipRefs.current[CHIP_ORDER.indexOf(chip)]?.focus()` directamente dentro de `handleChipChange` (linea 163) despues de `setActiveChip(chip)`. Esto preserva el comportamiento de foco al cambiar tab via teclado (ArrowLeft/ArrowRight/Home/End) y click, pero elimina el foco automatico en el mount inicial.

Alternativa considerada: agregar un ref `isFirstRender` booleano para skipear el primer disparo del effect. Desestimada porque introduce mas estado para resolver un problema que se resuelve mejor moviendo la logica al handler — el efecto no tiene razon de existir si el foco se puede disparar desde el mismo callsite que cambia el tab.

### S3 — Eliminar `onDirtyChange` de `OpinionesTab`

Dado que `BusinessDetailScreen` es el unico consumidor de `OpinionesTab` (grep confirmado) y no necesita reaccionar a dirtiness (no hay dialog de confirmacion al volver atras), eliminar la prop de la interfaz de `OpinionesTab`. Propagacion:

- `OpinionesTab.tsx`: remover `onDirtyChange` de `Props`, del desestructurado, y del spread a `BusinessComments`.
- `BusinessDetailScreen.tsx`: remover `onDirtyChange={() => {}}` (linea 336).
- `BusinessComments.tsx`: la prop sigue existiendo como **opcional** (`onDirtyChange?:`) porque `FeedbackForm` la usa en otro contexto. No hay cambio en `BusinessComments` — solo deja de recibirla desde `OpinionesTab`.

El `useEffect` de `BusinessComments` que calcula dirty (lineas 78-84) queda como esta — sigue sirviendo a `FeedbackForm` via su `FeedbackSender` interno. Verificar que el `useEffect` es tolerante a `onDirtyChange` undefined (ya lo es: usa optional chaining `onDirtyChange?.(isDirty)`).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 Extraer `setMetaTag` a `src/utils/meta.ts` + `useBusinessPageMeta` a `src/hooks/` | Media | XS |
| S2 Mover focus() al handler, eliminar useEffect | Media | XS |
| S3 Eliminar `onDirtyChange` de `OpinionesTab` + unwire en `BusinessDetailScreen` | Media | XS |
| Tests unitarios para `setMetaTag` + integracion chip focus + unit de `OpinionesTab` sin la prop | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactor general de OG meta tags en otras paginas (`AdminDashboard`, perfil publico). Se deja el helper listo para que el proximo feature lo use sin duplicar codigo.
- Cambios al flujo de dirty tracking en `BusinessComments`/`FeedbackForm` — sigue funcional y sin cambios.
- A11y adicional de los chips (ya cubierto en #318 con `role=tab`, `aria-selected`, navegacion por teclado).
- Migrar `<meta name="description">` (tag `name=`, no `property=`) — `setMetaTag` sigue especifico a `property=`. Si en el futuro se necesita `name=`, se genericiza en ese momento.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/meta.test.ts` | Unitario | `setMetaTag` crea `<meta>` nuevo si no existe; actualiza `content` si ya existe (mismo `property`); coexiste con meta tags `name=` (no los toca); persiste tras multiples calls con distintos properties |
| `src/hooks/__tests__/useBusinessPageMeta.test.ts` | Unitario | Al montar setea `document.title` + 4 meta tags (og:title, og:description, og:url, og:type); al desmontar restaura `document.title` previo; re-render con mismo business no toca DOM (estable refs) |
| `src/components/business/__tests__/BusinessDetailScreen.test.tsx` | Unitario (extender) | Mount inicial NO dispara `focus()` sobre el primer chip (verificar con `expect(document.activeElement).not.toBe(chipRefs[0])`); click/teclado sobre chip si dispara `focus()` |
| `src/components/business/__tests__/OpinionesTab.test.tsx` | Unitario | Renderizar sin prop `onDirtyChange` no tira warning de TS ni runtime; forward de props a `BusinessComments` funciona sin la prop |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (`meta.ts`, `useBusinessPageMeta.ts`)
- El test de chip focus es **bloqueante para merge** porque el regreso de este bug es silencioso (no rompe nada, solo vuelve a robar foco)
- Tests de validacion para todos los inputs del usuario: N/A (no hay inputs nuevos)
- Todos los paths condicionales cubiertos: create-meta vs update-meta en `setMetaTag`
- Side effects verificados: `document.head` se mantiene limpio entre tests (cleanup en `afterEach`)

---

## Seguridad

Este issue es refactor puro sin nuevas superficies de ataque. Los items relevantes:

- [ ] `setMetaTag` recibe `content` directamente del objeto `business` (name, category, address) — son datos bundled del JSON local, no user input. No hay inyeccion posible por esta ruta.
- [ ] Si en el futuro se usa `setMetaTag` con user-generated content (ej: nombre de lista publica), el consumidor debe sanitizar antes de pasar. Documentar en JSDoc de `setMetaTag` que asume input confiable.
- [ ] El removal del `useEffect` de chip focus no cambia la superficie de ataque — los chips siguen siendo `<Chip>` MUI con handlers tipados, no hay HTML raw.

### Vectores de ataque automatizado

No hay nueva superficie. No hay nuevos endpoints, colecciones ni callables.

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `setMetaTag` expuesto como util | Consumidor futuro podria pasar user content sin sanitizar | JSDoc explicito: "No pasar user-generated content sin sanitizar. El valor se usa como `content=` de un meta tag, no como HTML" |

No hay escrituras nuevas a Firestore en este issue — no aplican checklists de `hasOnly()`, rate limits ni triggers.

---

## Deuda tecnica y seguridad

```bash
gh issue list --label security --state open --json number,title
# → []  (0 vulnerabilidades abiertas)
gh issue list --label "tech debt" --state open --json number,title
# → []  (el label "tech debt" no esta aplicado — issues recientes usan label "enhancement")
```

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #318 business-detail-screen post-impl | Este issue es follow-up directo (hallazgos del merge audit de #318) | Se ataca como pieza separada para no mezclar con el bulk de #318 |
| #320 FANOUT_MAX_RECIPIENTS_PER_ACTION naming | Otro hallazgo de auditoria, en otro archivo | No agravar — no tocamos functions/src/ |
| #321 lastCheckTs per event type | Otro hallazgo de auditoria, en `useForceUpdate` | No agravar — no tocamos `useForceUpdate.ts` |
| #317 barrel test export count | `src/utils/meta.ts` es archivo nuevo — si esta exportado desde un barrel, podria bumpear el count hardcodeado | Verificar: `src/utils/` no tiene barrel file (confirmado: cada util se importa directo). No aplica |

### Mitigacion incorporada

- S1 crea `src/utils/meta.ts` como archivo nuevo independiente — no modifica barrels ni appendea a archivos existentes. Compatible con regla `feedback_never_skip_merge_skill`.
- S3 elimina un caso canonico de la regla `feedback_no_placeholder_props` (`onDirtyChange={() => {}}`) — mejora cumplimiento de la regla sin crear nuevos casos.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] `useBusinessPageMeta` no hace operaciones async — solo manipulacion sincronica del DOM. No requiere patron de cancelacion
- [ ] El `useEffect` mantiene el cleanup existente (`return () => { document.title = prev; }`) — verificar que sigue funcionando tras el move a `src/hooks/`
- [ ] `setMetaTag` es sincronico y sin side effects ajenos al DOM — no necesita try/catch
- [ ] No hay `setState` nuevos en ninguno de los cambios — S2 elimina un `useEffect` existente, no agrega estado
- [ ] Archivos en `src/hooks/` DEBEN usar al menos un React hook: `useBusinessPageMeta` usa `useEffect` — cumple
- [ ] `logger.error` N/A — no hay catch blocks nuevos
- [ ] Archivos nuevos no superan 300 lineas: `meta.ts` ~20 lineas, `useBusinessPageMeta.ts` ~20 lineas — muy por debajo

### Checklist de observabilidad

- [ ] No se agregan Cloud Function triggers ni services con queries Firestore — no aplica `trackFunctionTiming` ni `measureAsync`
- [ ] No se agregan `trackEvent` nuevos — no aplica registro en `GA4_EVENT_NAMES`

### Checklist offline

- [ ] No hay formularios nuevos — no aplica disable offline
- [ ] No hay error handlers nuevos en catch blocks — `setMetaTag` no tira errores (el DOM API no lanza para tag inexistente)

### Checklist de documentacion

- [ ] No se agregan secciones de HomeScreen
- [ ] No se agregan analytics events
- [ ] No se agregan tipos nuevos — `setMetaTag` y `useBusinessPageMeta` usan tipos TS nativos (`string`, `Business`)
- [ ] `docs/reference/patterns.md` — agregar linea breve en seccion "Utilidades compartidas" mencionando `src/utils/meta.ts` como helper DOM generico para OG tags
- [ ] `docs/reference/features.md` — no requiere update (no es feature visible al usuario)
- [ ] `docs/reference/firestore.md` — no requiere update (no toca Firestore)

---

## Offline

No aplica. Este issue no introduce ni modifica data flows. Los cambios son:

- S1: refactor de ubicacion de codigo (mismo DOM API, mismo comportamiento)
- S2: elimina un side effect erroneo en mount inicial
- S3: elimina un prop noop

### Data flows

N/A — sin cambios en reads ni writes.

### Checklist offline

- [x] Reads de Firestore: sin cambios (`useBusinessData` no se toca)
- [x] Writes: sin cambios
- [x] APIs externas: sin cambios
- [x] UI: sin cambios en indicadores offline
- [x] Datos criticos: sin cambios

### Esfuerzo offline adicional: S (mas concretamente: 0)

---

## Modularizacion y % monolitico

Este issue **reduce** el acoplamiento:

- `BusinessDetailPage.tsx` deja de contener dos unidades de logica acopladas (`setMetaTag` DOM helper + `useBusinessPageMeta` hook). Queda solo como orquestador de routing.
- `OpinionesTab` deja de tener un prop que no usa — contrato mas honesto.
- `BusinessDetailScreen` deja de tener un `useEffect` de focus management — componente con menos concerns implicitos.

### Checklist modularizacion

- [ ] Logica de DOM (`setMetaTag`) en `src/utils/` (util), no en el componente de pagina
- [ ] Hook con `useEffect` en `src/hooks/` (dominio correcto)
- [ ] No se agrega useState de logica de negocio a `AppShell` ni `SideMenu`
- [ ] Props explicitas mantenidas — se elimina el prop noop (menos deuda, no mas)
- [ ] Cada prop de accion tiene handler real — S3 elimina el ultimo noop identificado en el dominio Business
- [ ] Ningun componente nuevo importa directamente de `firebase/firestore`, `firebase/functions` o `firebase/storage` — los archivos nuevos solo tocan DOM
- [ ] Archivos en `src/hooks/` contienen al menos un React hook: `useBusinessPageMeta` usa `useEffect`
- [ ] Ningun archivo nuevo supera 400 lineas (se esperan ~20 lineas por archivo)
- [ ] No hay converters nuevos
- [ ] Archivos nuevos en `src/utils/` y `src/hooks/` (carpetas de dominio correctas)
- [ ] No se necesita estado global nuevo
- [ ] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Extrae util y hook de la pagina; elimina prop noop entre componentes |
| Estado global | = | Sin cambios en contextos |
| Firebase coupling | = | No toca Firebase SDK |
| Organizacion por dominio | - | Mueve DOM helper a `src/utils/`, hook a `src/hooks/` — ambas carpetas correctas |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [ ] El fix de S2 **mejora** la accesibilidad: eliminar el foco automatico en mount significa que screen readers no son interrumpidos con anuncio del chip al cargar la pagina. El foco inicial queda en el flujo natural de la pagina (el boton de volver, segun orden de tab)
- [ ] Al cambiar chip via teclado (ArrowRight/Left/Home/End) el foco sigue moviendose al chip activo — mantenemos este comportamiento movido al handler
- [ ] Al cambiar chip via click, mover el foco explicito al chip clickeado es opcional (los screen readers ya siguen el click). Decision: llamar `focus()` en `handleChipChange` independiente del origen (click o teclado) — preserva comportamiento actual post-interaccion del usuario
- [ ] Elementos interactivos usan semantica correcta — sin cambios, `<Chip role="tab">` ya correcto
- [ ] Clickable boxes — sin cambios
- [ ] Touch targets — sin cambios
- [ ] Componentes con carga de datos tienen error state — sin cambios (`DetailError` existente)
- [ ] Imagenes con URLs dinamicas — sin cambios
- [ ] Formularios tienen labels — sin cambios

### Checklist de copy

- [ ] No se agregan textos user-facing nuevos
- [ ] Tono consistente — N/A
- [ ] Terminologia — N/A
- [ ] Strings reutilizables — N/A (el helper `setMetaTag` no agrega strings)
- [ ] Mensajes de error accionables — N/A

---

## Success Criteria

1. `src/utils/meta.ts` existe con `setMetaTag(property, content)` exportado y con tests >= 80% cobertura. `src/pages/BusinessDetailPage.tsx` importa y delega (lineas 11-19 eliminadas).
2. `src/hooks/useBusinessPageMeta.ts` existe con el hook movido (lineas 21-31 de `BusinessDetailPage.tsx` eliminadas de esa pagina). Importado desde `BusinessDetailPage`.
3. En un test de integracion `BusinessDetailScreen.test.tsx`, montar el componente con `initialTab=undefined` **no** deja el foco en `chipRefs[0]`. Cambiar chip via click o teclado si mueve el foco.
4. `OpinionesTab.Props` ya no declara `onDirtyChange`. `BusinessDetailScreen` ya no pasa `onDirtyChange={() => {}}`. `BusinessComments` sigue con la prop opcional y sigue siendo consumida por `FeedbackForm`.
5. `npm test` pasa en local y CI. Cobertura global no baja del 80%. `tsc --noEmit` pasa sin errores de tipo.

---

## Validacion Funcional

**Analista**: Sofia
**Fecha**: 2026-04-23
**Ciclo**: 1
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos

No hay BLOQUEANTES ni IMPORTANTES. Scope cerrado, refactor puro sin nuevas superficies de datos, sin impacto en billing/offline/privacy/multi-tab (el PRD lo declara explicitamente y se verifico). Archivos destino (`src/utils/meta.ts`, `src/hooks/useBusinessPageMeta.ts`) confirmados como inexistentes (creacion limpia). Consumidores de `OpinionesTab` y `BusinessComments` verificados: solo los esperados (`BusinessDetailScreen` → `OpinionesTab` → `BusinessComments`), sin fan-out a otras pantallas.

### Observaciones (no bloqueantes, pulido del PRD)

- **OBS #1 — Justificacion de S3 inexacta**: El PRD dice que `BusinessComments` mantiene `onDirtyChange` opcional "porque `FeedbackForm` la usa en otro contexto". Grep confirma que `FeedbackForm` **no consume `BusinessComments`**; tiene su propio `FeedbackSender` interno con su `useEffect`/`onDirtyChange`. La prop queda opcional como seguro a futuro, no por un consumidor actual. Corregir redaccion en S3.
- **OBS #2 — Nota de timing focus + re-render en S2**: Llamar `focus()` sincronicamente en `handleChipChange` despues de `setActiveChip(chip)` apunta al chip antes de que React lo re-renderize con el nuevo `tabIndex`. Suele funcionar con MUI `<Chip>` pero amerita mencion: el criterio de exito real es "el test de teclado (ArrowRight/Left/Home/End) preserva focus en el chip activo"; si aparece un issue de timing, se acepta como fallback un `useEffect` con flag "interaction-only". La ubicacion exacta del `focus()` call la decide el implementador.
- **OBS #3 — Success criterion #3 demasiado ligado al matcher**: El criterio "expect(document.activeElement).not.toBe(chipRefs[0])" mezcla comportamiento con sintaxis de test. Reformular como "al montar `BusinessDetailScreen` sin interaccion previa del usuario, el primer chip no recibe focus".
- **OBS #4 — Criterio de test de `useBusinessPageMeta` ambiguo**: "re-render con mismo business no toca DOM (estable refs)" es ambiguo (¿desde que render?). Reformular a "el segundo render con los mismos `business.{id,name,category,address}` no invoca `document.createElement('meta')` ni re-escribe `document.title`".

### Credit al PRD

- Out-of-scope explicito para `<meta name=...>` — bien acotado.
- Test de chip focus marcado como bloqueante para merge (linea 83) — atencion al regreso silencioso del bug.
- Reconoce el fix de a11y de S2 (no interrumpe screen readers en mount).
- Referencia al patron existente `useActivityReminder` — verificado que existe y aplica.

### Listo para specs-plan-writer

Si. Las 4 observaciones son refinamientos de redaccion; specs-plan-writer puede arrancar con el PRD tal cual. Si se desea pulir antes, `prd-writer` puede incorporarlas en paralelo.
