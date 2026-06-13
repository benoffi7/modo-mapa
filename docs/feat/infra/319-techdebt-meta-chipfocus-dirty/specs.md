# Specs: Tech debt — setMetaTag util + chip focus on mount + noop onDirtyChange

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-23

---

## Modelo de datos

N/A. Este issue es refactor puro de codigo client-side. No se agregan, modifican ni eliminan colecciones de Firestore, campos, indices ni documentos.

## Firestore Rules

N/A. Sin cambios en `firestore.rules`.

### Rules impact analysis

N/A. No se introducen nuevas queries ni writes.

### Field whitelist check

N/A. No se tocan campos de Firestore.

## Cloud Functions

N/A. No se agregan ni modifican triggers, scheduled, ni callable functions.

## Seed Data

N/A. Sin cambios de schema.

## Componentes

### Mutable prop audit

N/A. Ninguno de los componentes tocados (`BusinessDetailScreen`, `OpinionesTab`, `BusinessComments`, `BusinessDetailPage`) recibe props que deban copiarse a estado local. El contrato ya es correcto.

### Cambios por componente

**`src/pages/BusinessDetailPage.tsx`** (modificado, reducido)
- Elimina la funcion `setMetaTag` (lineas 11-19) — se mueve a `src/utils/meta.ts`.
- Elimina el hook `useBusinessPageMeta` (lineas 21-31) — se mueve a `src/hooks/useBusinessPageMeta.ts`.
- Agrega `import { useBusinessPageMeta } from '../hooks/useBusinessPageMeta';`.
- Elimina el import de `useEffect` de React (ya no se usa directamente en este archivo).
- Queda ~30 lineas: solo routing + resolucion de `initialTab` + render.

**`src/components/business/BusinessDetailScreen.tsx`** (modificado)
- Elimina el `useEffect(() => { chipRefs.current[activeIdx]?.focus(); }, [activeIdx])` (lineas 117-119).
- Elimina la variable intermedia `const activeIdx = CHIP_ORDER.indexOf(activeChip);` (linea 116) si solo se usa en el effect; de lo contrario se deja.
- Agrega `chipRefs.current[CHIP_ORDER.indexOf(chip)]?.focus();` al final de `handleChipChange` (post `setActiveChip(chip)` y tracking). Con esto, el foco solo se mueve cuando el usuario cambia de chip via click o teclado (ArrowRight/Left/Home/End llaman `handleChipChange`).
- Elimina el prop `onDirtyChange={() => {}}` del `<OpinionesTab />` (linea 336).
- Nota de timing (OBS #2): `Chip` de MUI propaga la ref via `forwardRef`, por lo que el nodo ya existe cuando se llama `focus()` sincronicamente dentro del handler. Si apareciera un issue de timing (foco no se aplica porque React aun no re-renderizo el `tabIndex`), el fallback aceptado es conservar el `useEffect` detras de un flag `interactionRef` (ref booleano que se setea `true` dentro de `handleChipChange` y se consume en el effect). La decision final la toma el implementador al escribir el test de teclado.

**`src/components/business/OpinionesTab.tsx`** (modificado)
- Elimina `onDirtyChange: (dirty: boolean) => void;` de la interface `Props` (linea 15).
- Elimina `onDirtyChange` del destructuring del componente (linea 24).
- Elimina `onDirtyChange={onDirtyChange}` del forward a `<BusinessComments />` (linea 45).

**`src/components/business/BusinessComments.tsx`** (sin cambios)
- La prop `onDirtyChange?: (dirty: boolean) => void;` (linea 34) queda como esta: es **opcional** y deja de recibir valor desde `OpinionesTab`. El `useEffect` que calcula dirty (lineas 78-84) ya es tolerante a `undefined` via optional chaining (`onDirtyChange?.(isDirty)`).
- Justificacion corregida (OBS #1): el PRD mencionaba que `FeedbackForm` usa esta prop. Grep confirma que `FeedbackForm` tiene su **propio** `FeedbackSender` interno con su propio `onDirtyChange` y **no consume `BusinessComments`**. La prop en `BusinessComments` queda como "seguro a futuro" para cuando haya un consumidor que necesite reaccionar a dirty (ej: un dialogo con confirmacion al cerrar), no por un consumidor actual.

**`src/utils/meta.ts`** (archivo nuevo)

```typescript
/**
 * Crea o actualiza un meta tag en <head> identificado por property.
 *
 * @param property El valor del atributo `property` (ej: "og:title", "og:type").
 * @param content El valor del atributo `content`.
 *
 * IMPORTANTE: `content` se setea como valor del atributo, no como innerHTML.
 * No pasar HTML raw. Si en el futuro se usa con user-generated content
 * (nombre de lista publica, titulo de comentario, etc.), sanitizar/escapar
 * antes de pasarlo a este helper.
 *
 * Nota: este helper solo maneja meta tags `property=` (OpenGraph). Los tags
 * `name=` (description, viewport, etc.) NO los modifica. Si se necesita
 * soporte para `name=`, genericizar en ese momento.
 */
export function setMetaTag(property: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
```

**`src/hooks/useBusinessPageMeta.ts`** (archivo nuevo)

```typescript
import { useEffect } from 'react';
import { setMetaTag } from '../utils/meta';
import type { Business } from '../types';

/**
 * Setea document.title y los meta tags OpenGraph (og:title, og:description,
 * og:url, og:type) para la pagina de detalle de un comercio. Restaura el
 * title previo al desmontar.
 *
 * Se dispara cuando cambian business.id, name, category o address — valores
 * primitivos para deps estables.
 */
export function useBusinessPageMeta(business: Business): void {
  useEffect(() => {
    const prev = document.title;
    document.title = `${business.name} — Modo Mapa`;
    setMetaTag('og:title', business.name);
    setMetaTag('og:description', `${business.category} · ${business.address}`);
    setMetaTag('og:url', `${window.location.origin}/comercio/${business.id}`);
    setMetaTag('og:type', 'place');
    return () => { document.title = prev; };
  }, [business.id, business.name, business.category, business.address]);
}
```

## Textos de usuario

N/A. No se agregan, modifican ni eliminan textos visibles al usuario. El titulo del documento (`${business.name} — Modo Mapa`) y los OG tags (`${business.category} · ${business.address}`) se preservan byte-a-byte.

## Hooks

**`useBusinessPageMeta`** (movido, sin cambios de comportamiento)

| Campo | Valor |
|-------|-------|
| Archivo | `src/hooks/useBusinessPageMeta.ts` (nuevo) |
| Params | `business: Business` |
| Return | `void` |
| Deps del effect | `[business.id, business.name, business.category, business.address]` |
| Cleanup | Restaura `document.title` al valor previo al mount |
| Side effects | Manipulacion de `document.head` via `setMetaTag` |

## Servicios

N/A. No se agregan ni modifican servicios.

## Integracion

Cambios locales al dominio `business/`. Unicos consumidores a verificar:
- `src/pages/BusinessDetailPage.tsx` — ahora importa `useBusinessPageMeta` del nuevo path.
- `src/components/business/BusinessDetailScreen.tsx` — deja de pasar `onDirtyChange` a `OpinionesTab`.
- No hay otros consumidores de `OpinionesTab` (confirmado: solo `BusinessDetailScreen` lo instancia — grep de "from './OpinionesTab'" y "from '../business/OpinionesTab'").
- No hay otros consumidores de `setMetaTag` ni de `useBusinessPageMeta` en este momento — son nuevos archivos publicos que quedan disponibles para el proximo feature que los necesite.

### Preventive checklist

- [x] **Service layer**: N/A — ningun componente importa `firebase/firestore` en estos cambios. `meta.ts` y `useBusinessPageMeta.ts` solo tocan DOM.
- [x] **Duplicated constants**: N/A — no se duplican arrays/objetos.
- [x] **Context-first data**: N/A — no hay lecturas nuevas.
- [x] **Silent .catch**: N/A — no hay bloques `.catch` nuevos.
- [x] **Stale props**: N/A — ningun componente modificado introduce datos mutables via prop.

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/utils/meta.test.ts` (nuevo) | `setMetaTag` crea `<meta property=...>` cuando no existe; actualiza `content` cuando existe uno con mismo `property`; multiples calls con distintos `property` crean entradas separadas; no toca `<meta name=...>` existente; cleanup de `document.head` en `afterEach` | Unitario |
| `src/hooks/__tests__/useBusinessPageMeta.test.ts` (nuevo) | Montar con `business` fijo setea `document.title = "{name} — Modo Mapa"` y 4 meta tags; desmontar restaura el `document.title` previo; el segundo render con los mismos `business.{id,name,category,address}` **no** invoca `document.createElement('meta')` ni re-escribe `document.title` (verificado con spy sobre `document.createElement`) (OBS #4) | Unitario |
| `src/components/business/__tests__/BusinessDetailScreen.test.tsx` (extender) | Al montar `BusinessDetailScreen` sin interaccion previa del usuario, el primer chip **no** recibe focus (verificar que `chipRefs[0].focus` no fue invocado durante el mount — spy sobre `HTMLElement.prototype.focus`) (OBS #3). Al hacer click en un chip distinto, `focus()` si se invoca sobre el chip clickeado. Al presionar ArrowRight desde el chip activo, `focus()` se invoca sobre el chip siguiente. Este test es **bloqueante para merge**: el regreso del bug es silencioso. | Unitario (extender) |
| `src/components/business/__tests__/OpinionesTab.test.tsx` (nuevo) | Renderiza sin la prop `onDirtyChange`; los subtabs "Comentarios" y "Preguntas" togglean via `Tabs`; `onCommentsChange` sigue forward-eado a `BusinessComments` y `BusinessQuestions`. | Unitario |

### Mock strategy

- `meta.test.ts`: sin mocks. Se manipula `document.head` directamente; `afterEach` limpia todos los `<meta property=...>` y `<meta name=...>` tests-creados para aislamiento.
- `useBusinessPageMeta.test.ts`: usa `@testing-library/react` `renderHook`. Spy sobre `document.createElement` (solo se restaura en `afterEach`). Restaura `document.title` en `afterAll`.
- Extension de `BusinessDetailScreen.test.tsx`: se agrega spy sobre `HTMLElement.prototype.focus` con `vi.spyOn(...).mockImplementation(() => {})`. Los mocks existentes de chips via `<Chip>` real de MUI no requieren cambio — la ref se adjunta al root del chip renderizado.
- `OpinionesTab.test.tsx`: mocks de `BusinessComments` y `BusinessQuestions` como stubs (`<div>comments</div>`, `<div>questions</div>`). Verifica props forward-eadas via `vi.fn()` ids.

### Criterios de cobertura

- Nuevo codigo (`meta.ts`, `useBusinessPageMeta.ts`) >= 80% en statements/branches/functions/lines.
- Paths cubiertos en `setMetaTag`: create (query devuelve null) + update (query devuelve el elemento).
- Cobertura global del repo no baja (thresholds 80% en `vitest.config.ts`).

## Analytics

N/A. No se agregan `trackEvent`. Los eventos existentes en `BusinessDetailScreen` (`EVT_BUSINESS_DETAIL_OPENED`, `EVT_BUSINESS_DETAIL_TAB_CHANGED`, `EVT_SUB_TAB_SWITCHED`) siguen disparandose desde el mismo callsite (`handleChipChange`).

---

## Offline

N/A. Este feature no altera data flows, reads ni writes. El comportamiento offline se preserva byte-a-byte.

### Cache strategy

N/A.

### Writes offline

N/A.

### Fallback UI

N/A. `BusinessDetailScreen` conserva su `DetailError` + `StaleBanner` + comportamiento offline existente (mostrar header + chips si `isOffline && error`).

---

## Accesibilidad y UI mobile

| Componente | Elemento | aria-label / role | Min touch target | Error state |
|-----------|----------|------------------|-----------------|-------------|
| `BusinessDetailScreen` (chips) | `<Chip role="tab">` | `role="tab"`, `aria-selected`, `tabIndex={activeChip===chip?0:-1}` | Preservado (MUI `<Chip>` default) | N/A |
| `useBusinessPageMeta` | N/A (hook side-effect) | N/A | N/A | N/A |

### Reglas aplicadas

- El cambio en S2 **mejora** la a11y: al eliminar el foco automatico en mount, el screen reader ya no anuncia el chip "Criterios" al cargar la pagina. El foco inicial cae en el primer elemento enfocable natural (el boton "Volver al mapa"), respetando el flujo de lectura.
- Al cambiar chip via teclado (ArrowRight/Left/Home/End), `handleChipChange` sigue invocandose y ahora es quien mueve el foco al chip activo — se preserva el comportamiento de tab navigation.
- `role="tab"` + `aria-selected` + `tabIndex` dinamico se mantienen sin cambios en la marca de los `<Chip>`.

## Textos y copy

N/A. Sin textos nuevos. Los OG tags preservan la terminologia existente (nombre, categoria, direccion del `Business`).

---

## Decisiones tecnicas

**D1. `setMetaTag` va a `src/utils/meta.ts`, no a un barrel.**

`src/utils/` no tiene archivo barrel (confirmado: cada util se importa por path directo — `../../utils/formatDate`, `../../utils/distance`). Mantener la convencion evita bumpear el count hardcodeado en `src/utils/__tests__/barrel.test.ts` (issue #317) y respeta el patron existente.

**D2. `useBusinessPageMeta` va a `src/hooks/`, no a `src/pages/`.**

Hooks que usan `useEffect` viven en `src/hooks/` por convencion del proyecto (`useActivityReminder`, `useVisitHistory`, `useForceUpdate`, etc.). El archivo `src/pages/BusinessDetailPage.tsx` se reserva para orquestacion de routing + render del componente, no para logica reutilizable.

**D3. `focus()` dentro de `handleChipChange`, no en `useEffect` con flag.**

Alternativas consideradas:

- **(A) `useEffect` + `useRef<boolean>` con flag "interaction-only"** — requiere mantener estado adicional y acoplar el effect al handler. Mas codigo, mas concerns.
- **(B) `useEffect` + skip en primer mount (ref `isFirstMountRef`)** — idem, introduce estado solo para resolver un sintoma (el effect no debe existir). Desestimada.
- **(C) Llamar `focus()` directamente dentro de `handleChipChange`** — elegida. Elimina un `useEffect`, el foco queda co-localizado con la causa (interaccion del usuario). Timing: MUI `<Chip>` tiene ref estable; el nodo ya existe al momento del click/keydown. Si emergiera un issue de timing por re-render del `tabIndex`, el fallback documentado es envolver el `focus()` en `queueMicrotask` o volver a (A). La decision final la valida el test de teclado.

**D4. `onDirtyChange` en `BusinessComments` queda como opcional.**

Aunque hoy no tiene consumidor (ni `OpinionesTab` ni `FeedbackForm` lo invocan sobre `BusinessComments`), el `useEffect` que calcula `isDirty` es barato (deps primitivas) y la prop opcional permite que un futuro feature (ej: dialog de confirmacion al salir sin publicar) la consuma sin reintroducir la logica. Alternativa: eliminar tambien la prop y el effect de `BusinessComments`. Desestimada — el scope del issue es el prop noop de `OpinionesTab`, no un cleanup agresivo de `BusinessComments`. Si se decide limpiar, se abre issue separado.

---

## Hardening de seguridad

Este issue no introduce superficies nuevas de ataque. Los items relevantes:

### Firestore rules requeridas

N/A. Sin cambios en `firestore.rules`.

### Rate limiting

N/A. Sin escrituras nuevas a Firestore.

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| Futuro consumidor pasa user-content sin sanitizar a `setMetaTag` | JSDoc explicito en `setMetaTag` advierte que `content` se setea como atributo (no innerHTML) y que user-generated content debe sanitizarse en el callsite | `src/utils/meta.ts` |
| Inyeccion DOM via `property` | `setMetaTag` usa `document.querySelector` con el valor interpolado en el selector. En este feature los unicos `property` pasados son literales estaticos (`og:title`, `og:description`, `og:url`, `og:type`) del hook. Si un consumidor futuro pasara un `property` dinamico, el JSDoc advierte de sanitizar. Alternativa mas segura: pre-whitelist en el helper. Se difiere hasta que exista un caso real. | `src/utils/meta.ts` |

### Data scraping

N/A. Los meta tags son public-facing por diseño (OpenGraph) — ya eran visibles antes del refactor.

---

## Deuda tecnica: mitigacion incorporada

Consultado pre-specs:

```bash
gh issue list --label security --state open --json number,title
# → [] (0 issues abiertos)
gh issue list --label "tech debt" --state open --json number,title
# → [] (label no aplicado; issues recientes usan "enhancement")
```

Issues relacionados:

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| #318 business-detail-screen post-impl | Este issue es follow-up directo: resuelve los 3 hallazgos del merge audit de #318 que quedaron como deuda | Todo el plan |
| #317 barrel test export count | Verificado: `src/utils/` NO tiene barrel file — `meta.ts` no requiere update de export count | N/A (no aplica) |
| #320, #321 (otros hallazgos de auditoria) | Fuera de scope — no se tocan `functions/src/` ni `useForceUpdate.ts` | N/A |

### Mitigacion incorporada

- S3 elimina un caso canonico de `feedback_no_placeholder_props` (`onDirtyChange={() => {}}`). Mejora cumplimiento de la regla sin crear casos nuevos.
- S1 crea archivos nuevos independientes (no modifica barrels). Compatible con `feedback_never_skip_merge_skill`.
- S2 elimina un `useEffect` de focus management — reduce concerns implicitos de `BusinessDetailScreen`.

---

## Validacion Tecnica

**Arquitecto**: Diego
**Fecha**: 2026-04-23
**Ciclo**: 1
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos

Sin BLOQUEANTES. Sin IMPORTANTES. Una OBSERVACION menor.

### Observaciones (no bloqueantes)

- **OBS Diego #1 — Threshold de functions es 77, no 80**: El specs dice "thresholds 80% en `vitest.config.ts`" (sección Tests). El archivo real tiene `functions: 77`, los otros (statements/branches/lines) sí son 80. No afecta el feature (código nuevo es trivial, va a llegar a 100%).

### Observaciones para el plan

- Seguir patrón `vi.hoisted()` en extension de `BusinessDetailScreen.test.tsx` (per `feedback_vitest_mock_patterns`).
- Pablo debe confirmar que el test de teclado (ArrowRight/Left/Home/End preserva focus en chip activo) esté en la fase pre-merge.

### Claims verificados contra codebase

- `src/utils/meta.ts` y `src/hooks/useBusinessPageMeta.ts` no existen (creación limpia).
- `BusinessDetailPage.tsx` líneas 11-31 confirmadas (setMetaTag + useBusinessPageMeta inline).
- `BusinessDetailScreen.tsx` líneas 116-119 (useEffect focus) y línea 336 (`onDirtyChange={() => {}}`) confirmadas.
- `OpinionesTab.tsx` único consumidor es `BusinessDetailScreen`.
- `FeedbackForm.tsx` tiene su propio `FeedbackSender` interno, NO consume `BusinessComments` (OBS #1 Sofia resuelta).
- `BusinessComments.onDirtyChange?` ya es opcional con optional chaining — compatible con remoción desde `OpinionesTab`.

### Listo para pasar a plan?

Sí.
