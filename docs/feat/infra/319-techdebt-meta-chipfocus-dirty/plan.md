# Plan: Tech debt — setMetaTag util + chip focus on mount + noop onDirtyChange

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-23

---

## Merge strategy

Todo el scope de #319 va en un solo PR con 4 commits logicos (ver tabla de commits mas abajo). El PR se mergea via skill `/merge` standalone — no hay dependencias con otros issues abiertos. No requiere orquestacion con otros PRs del batch, ni worktree compartido, ni migration de datos, ni rules deploy.

---

## Fases de implementacion

### Fase 1: Extraer `setMetaTag` y `useBusinessPageMeta`

**Branch:** `feat/319-techdebt-meta-chipfocus-dirty`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/utils/meta.ts` (nuevo) | Crear archivo con `export function setMetaTag(property: string, content: string): void`. JSDoc explicito: el `content` se setea como atributo, no como innerHTML; user-generated content debe sanitizarse en el callsite; helper solo maneja `property=` (OpenGraph), no `name=`. Cuerpo: `document.querySelector<HTMLMetaElement>('meta[property="${property}"]')` → si null crea `document.createElement('meta')` + `setAttribute('property', property)` + `document.head.appendChild(el)`; luego `setAttribute('content', content)`. |
| 2 | `src/hooks/useBusinessPageMeta.ts` (nuevo) | Crear archivo con `export function useBusinessPageMeta(business: Business): void`. Importa `useEffect` de react, `setMetaTag` de `../utils/meta`, y `type { Business }` de `../types`. Cuerpo del effect: guardar `prev = document.title`, setear `document.title = ${business.name} — Modo Mapa`, llamar `setMetaTag` para `og:title`, `og:description`, `og:url`, `og:type` (mismas strings que la implementacion actual). Cleanup: restaurar `document.title = prev`. Deps: `[business.id, business.name, business.category, business.address]`. |
| 3 | `src/pages/BusinessDetailPage.tsx` | Cambios puntuales:<br>- Eliminar la funcion inline `setMetaTag` (lineas 11-19).<br>- Eliminar el hook inline `useBusinessPageMeta` (lineas 21-31).<br>- Agregar `import { useBusinessPageMeta } from '../hooks/useBusinessPageMeta';`.<br>- **Eliminar `import { useEffect } from 'react';`** — este import queda huerfano al mover el hook, y deja TS6133 (`'useEffect' is declared but its value is never read`) que rompe pre-push. Verificar que no haya otros consumidores de `useEffect` en el archivo antes de remover.<br>- El archivo queda con imports de `useParams`, `useSearchParams`, providers, hooks (incluido el nuevo), types y componentes. El resto del archivo sin cambios funcionales. |
| 4 | `src/utils/meta.test.ts` (nuevo) | Tests unitarios de `setMetaTag`: (a) crea `<meta property="og:title">` cuando no existe; (b) actualiza `content` cuando ya existe un `<meta property="og:title">` con valor anterior; (c) multiples `property` distintos coexisten; (d) no toca `<meta name="description">` existente. `afterEach`: barrer `document.head` eliminando `<meta property=...>` y `<meta name=...>` creados en el test. |
| 5 | `src/hooks/__tests__/useBusinessPageMeta.test.ts` (nuevo) | Tests con `renderHook` de `@testing-library/react`: (a) montar con un `business` mock setea `document.title = "{name} — Modo Mapa"` y los 4 OG tags via `setMetaTag`; (b) desmontar restaura `document.title` al valor previo; (c) segundo render con los mismos `business.{id,name,category,address}` NO invoca `document.createElement('meta')` (spy con `vi.spyOn(document, 'createElement')`) ni re-escribe `document.title`. `afterEach`: cleanup de `document.head` + restaurar spies. |

### Fase 2: Chip focus solo en interaccion del usuario

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessDetailScreen.tsx` | Eliminar el bloque `const activeIdx = CHIP_ORDER.indexOf(activeChip); useEffect(() => { chipRefs.current[activeIdx]?.focus(); }, [activeIdx]);` (lineas 116-119). |
| 2 | `src/components/business/BusinessDetailScreen.tsx` | Dentro de `handleChipChange` (linea 163), agregar `chipRefs.current[CHIP_ORDER.indexOf(chip)]?.focus();`. Nota de posicion: la posicion exacta dentro de `handleChipChange` queda a criterio del implementador; la clave es que ocurra **post-`setActiveChip`** (para que cualquier state-derived UI ya este con el chip nuevo seleccionado) y **antes del proximo re-render / antes de devolver el control al event loop** (para evitar flicker de foco). Un orden razonable es `setActiveChip → focus → setSearchParams → trackEvent × 2`, pero si el implementador encuentra que el timing falla en el test de teclado, puede mover la llamada o envolverla en `queueMicrotask` (ver Riesgos). |
| 3 | `src/components/business/BusinessDetailScreen.tsx` | Validar que `useEffect` de `react` sigue siendo necesario en el import: si el `useEffect` de `recordVisit` + `trackEvent(EVT_BUSINESS_DETAIL_OPENED)` (linea 155-161) sigue existiendo, mantener el import. Confirmado: ese effect queda. |
| 4 | `src/components/business/__tests__/BusinessDetailScreen.test.tsx` | Agregar describe-block `describe('chip focus')` con 3 tests: (a) al montar sin `initialTab`, `HTMLElement.prototype.focus` **no** se invoca por los chips durante el render (spy + filter por `this instanceof HTMLElement && this.getAttribute('role') === 'tab'`). Alternativa mas simple: verificar que el primer chip no se convirtio en `document.activeElement` tras el mount. (b) Click en el chip "Precio" dispara `focus()` sobre el elemento clickeado. (c) `fireEvent.keyDown` con `key: 'ArrowRight'` sobre el chip activo dispara `focus()` sobre el siguiente. Cleanup: `spy.mockRestore()` en `afterEach`. |

### Fase 3: Eliminar `onDirtyChange` de `OpinionesTab`

**Audit previo (obligatorio antes de tocar codigo):**

```bash
grep -rn 'onDirtyChange' src/components/business/__tests__/
grep -rn 'onDirtyChange' src/components/business/
```

Objetivo: detectar si `BusinessDetailScreen.test.tsx` u `OpinionesTab.test.tsx` tienen `expect(...).toHaveBeenCalledWith(expect.objectContaining({ onDirtyChange }))` o props spying sobre `onDirtyChange`. Si hay matches en archivos de test, agregarlos al scope de la Fase 3 (actualizar o eliminar los expects segun corresponda). Si hay matches en componentes distintos a `BusinessComments`/`OpinionesTab`/`BusinessDetailScreen`, detener y escalar — podria haber un consumidor no documentado.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/OpinionesTab.tsx` | Eliminar `onDirtyChange: (dirty: boolean) => void;` de la interface `Props` (linea 15). Eliminar `onDirtyChange` del destructuring (linea 24). Eliminar `onDirtyChange={onDirtyChange}` del `<BusinessComments />` forward (linea 45). |
| 2 | `src/components/business/BusinessDetailScreen.tsx` | Eliminar `onDirtyChange={() => {}}` del `<OpinionesTab />` (linea 336). Esta linea deja el componente con `comments`, `regularComments`, `userCommentLikes`, `isLoading`, `onCommentsChange`. |
| 3 | `src/components/business/__tests__/OpinionesTab.test.tsx` (nuevo) | Tests unitarios: (a) renderiza sin tirar warning de TS runtime cuando se le pasan solo las 5 props restantes; (b) click en el tab "Preguntas" oculta el panel de `BusinessComments` y muestra `BusinessQuestions` (verificar via `display` style o via test-ids de los stubs mockeados); (c) `onCommentsChange` se forwardea a `BusinessComments` y a `BusinessQuestions` (los mocks la reciben via `vi.fn()`). Mocks: `BusinessComments` y `BusinessQuestions` stub-eados con `vi.mock`. |
| 4 | `src/components/business/BusinessComments.tsx` | Sin cambios — la prop `onDirtyChange?` queda opcional, el `useEffect` que calcula `isDirty` queda tolerante a `undefined` via optional chaining. |

### Fase 4: Verificacion local

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run test:run` — todos los tests pasan (nuevos + existentes que se extendieron). |
| 2 | N/A | Ejecutar `npm run test:coverage` — cobertura global >= 80%; cobertura de `src/utils/meta.ts` y `src/hooks/useBusinessPageMeta.ts` >= 80%. |
| 3 | N/A | Ejecutar `npx tsc -b` — sin errores de tipo (confirma que la remocion de `onDirtyChange` en `OpinionesTab.Props` y en el callsite de `BusinessDetailScreen` son coherentes). |
| 4 | N/A | Ejecutar `npm run lint` — sin errores. |
| 5 | N/A | Ejecutar `npm run dev:full` (Vite + emuladores) y navegar a `/comercio/{algun_id}`. Verificar manualmente: (a) al cargar la pagina, el foco inicial queda en el boton "Volver al mapa" o en el body, NO en el primer chip; (b) click en un chip cambia el tab y mueve el foco al chip clickeado; (c) Tab + ArrowRight mueve el foco al chip siguiente; (d) `document.title` refleja el nombre del comercio; (e) abrir DevTools y verificar que los 4 `<meta property="og:*">` estan presentes en `<head>`. |

### Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | En la tabla de la seccion `## Utilidades compartidas`, agregar una fila: `| **DOM meta helper** | \`src/utils/meta.ts\` exporta \`setMetaTag(property, content)\` para crear/actualizar meta tags \`property=\` (OpenGraph) en \`<head>\`. Usado por \`useBusinessPageMeta\` en la pagina de detalle de comercio. Disponible para futuras paginas con OG tags (perfil publico, lista publica, etc.). No maneja tags \`name=\` (viewport, description) — genericizar cuando haya caso. |`. |
| 2 | `docs/reference/patterns.md` | En la seccion de hooks de UI (o crear linea en "Datos y estado" si corresponde), agregar `| **\`useBusinessPageMeta\`** | Setea \`document.title\` y 4 meta tags OpenGraph para la pagina de detalle de comercio. Cleanup restaura \`document.title\` al desmontar. Archivo: \`src/hooks/useBusinessPageMeta.ts\`. |` O en su defecto mencionarlo en la fila del DOM meta helper. |
| 3 | `docs/reference/features.md` | No requiere update — no es feature visible al usuario (solo mejora a11y/estructura). |
| 4 | `docs/reference/firestore.md` | No requiere update — sin cambios en Firestore. |
| 5 | `docs/reference/security.md` | No requiere update — sin cambios en rules/rate limits/auth. |
| 6 | `docs/reference/project-reference.md` | Actualizar fecha de ultima modificacion si la convencion del repo lo pide. Sin cambios de version (este issue no bumpea version en el bulk). |
| 7 | `src/components/menu/HelpSection.tsx` | No requiere update — no cambia comportamiento visible al usuario. |

---

## Orden de implementacion

### Commits (4 commits atomicos en un solo PR)

| # | Commit message | Pasos incluidos | Scope | Mergeable intermedio |
|---|---------------|-----------------|-------|---------------------|
| 1 | `refactor: extract setMetaTag util + useBusinessPageMeta hook from BusinessDetailPage` | Fase 1 Pasos 1+2+3 (crear `meta.ts`, crear `useBusinessPageMeta.ts`, actualizar `BusinessDetailPage.tsx` con el import + remocion de `useEffect`) + Fase 1 Pasos 4-5 (tests del util y el hook) | Extraccion atomica de util+hook+consumer. **Los 3 pasos de codigo deben ir en UN commit** porque dejar 1 o 2 de los 3 aplicados rompe el build (import inexistente o funcion duplicada). Los tests pueden ir en el mismo commit o en un commit follow-up inmediato — recomendado: mismo commit. | Si (build pasa, feature intacta). |
| 2 | `refactor(a11y): move chip focus from effect to handleChipChange` | Fase 2 Pasos 1+2+3 (eliminar effect + mover focus al handler + verificar import de `useEffect`) + Fase 2 Paso 4 (tests de chip focus — **bloqueante para merge**) | Chip focus refactor atomico. | Si (feature sigue funcional, test bloqueante debe pasar antes de commit). |
| 3 | `refactor: remove noop onDirtyChange prop from OpinionesTab` | Fase 3 audit previo + Fase 3 Pasos 1+2 (remocion de la prop de `OpinionesTab.Props` + callsite en `BusinessDetailScreen`) + Fase 3 Paso 3 (tests nuevos de `OpinionesTab`) | Eliminacion de prop noop. TypeScript fuerza coherencia. | Si. |
| 4 | `docs: update patterns.md for setMetaTag + useBusinessPageMeta` | Fase final Pasos 1-7 (patterns.md, verificacion de sidebar, resto `N/A`) | Documentacion. | Si. |

**Nota sobre Fase 4 (verificacion local):** no es un commit — es la ejecucion de `test:run` + `tsc` + `lint` + `dev:full` antes de push. Se corre **entre el commit 3 y el commit 4** para confirmar que los 3 commits de codigo estan sanos; o bien, se corre despues de cada commit individualmente (recomendado para reducir radio de falla).

### Secuencia

1. Commit 1 (Fase 1 completa: pasos 1-5). Verificar build + tests locales.
2. Commit 2 (Fase 2 completa: pasos 1-4). Verificar build + tests locales + test bloqueante de chip focus.
3. Audit previo Fase 3 (grep de `onDirtyChange`). Si surge nuevo scope, actualizar este plan antes de commitear.
4. Commit 3 (Fase 3 completa: pasos 1-3). Verificar build + tests locales.
5. Fase 4 — verificacion local integral (`npm run test:run` + `npm run test:coverage` + `npx tsc -b` + `npm run lint` + `npm run dev:full` con checklist manual).
6. Commit 4 (Fase final: docs). Verificar que `_sidebar.md` ya contiene las entradas de #319 (no requiere cambio).
7. `git push` → PR via gh → skill `/merge`.

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Timing del `focus()` post-`setActiveChip`: el `<Chip>` podria aun no haber re-renderizado con el nuevo `tabIndex` cuando se llama `focus()`. MUI `<Chip>` suele tener ref estable por lo que el nodo ya existe, pero si aparece flakiness en el test de teclado, el foco no se aplica o se pierde. | Si el test de keyboard falla: (a) envolver `focus()` en `queueMicrotask(() => chipRefs.current[...]?.focus())` para esperar al commit de React, o (b) mantener el `useEffect` con un `useRef<boolean>` `interactionRef` que se setea `true` dentro de `handleChipChange` y se consume+resetea en el effect. Ambos fallbacks estan documentados en specs.md "Decisiones tecnicas D3". |
| Tests existentes en `BusinessDetailScreen.test.tsx` rompen por cambio de orden de operaciones en `handleChipChange` (focus agregado entre `setActiveChip` y `setSearchParams`). | Los tests existentes usan spies sobre `setSearchParams` y `trackEvent` — no sobre `focus()`. Agregar `vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {})` en el `beforeEach` del archivo si algun test mockeado se rompe (improbable — los mocks de chips son el `<Chip>` real de MUI, cuyo `focus` es no-op en jsdom sin foco real). |
| `document.title` leak entre tests de `useBusinessPageMeta`: un test setea el title y el siguiente lo lee. | Restaurar `document.title` en `afterEach` del archivo de tests, o usar `renderHook` que auto-desmonta y dispara el cleanup del effect (que ya restaura el title previo). |

**Rollback:** `git revert` del commit correspondiente es suficiente — no hay migration de datos ni rules deploy. Los 4 commits son independientes entre si a nivel git (aunque el commit 3 depende de los cambios del commit 2 para que tsc compile, el revert restaura al estado pre-merge sin efectos colaterales en produccion). Si se detecta regresion en un commit especifico (ej: test de chip focus flakea post-merge), `git revert <sha>` + redeploy es el camino.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (archivos nuevos solo tocan DOM).
- [x] Archivos nuevos en carpeta de dominio correcta: util DOM en `src/utils/`, hook con `useEffect` en `src/hooks/`. Nada en `components/menu/`.
- [x] Logica de negocio no aumenta — el DOM helper y el hook reducen logica de `BusinessDetailPage`.
- [x] No se toca archivo con deuda tecnica conocida que requiera fix agregado (grep de `gh issue list --label "tech debt"` → 0 resultados).
- [x] Ningun archivo resultante supera 400 lineas: `meta.ts` ~25 lineas, `useBusinessPageMeta.ts` ~20 lineas, `BusinessDetailPage.tsx` reducido a ~30 lineas, `BusinessDetailScreen.tsx` queda con neto -3 lineas, `OpinionesTab.tsx` neto -3 lineas.

## Guardrails de seguridad

- [x] Toda coleccion nueva tiene `hasOnly()` — N/A (sin colecciones nuevas).
- [x] Todo campo string tiene `.size() <= N` — N/A.
- [x] Todo campo list tiene `.size() <= N` — N/A.
- [x] Admin writes validan campos — N/A.
- [x] Counter decrements en triggers usan `Math.max(0, ...)` — N/A.
- [x] Rate limits llaman `snap.ref.delete()` — N/A.
- [x] Toda coleccion escribible tiene Cloud Function trigger con rate limit — N/A.
- [x] No hay secrets commited — los archivos nuevos no cargan env vars.
- [x] `getCountFromServer` → N/A.
- [x] `setMetaTag` documenta en JSDoc el riesgo de pasar user-content sin sanitizar — cubierto en specs.

## Guardrails de observabilidad

- [x] Todo CF trigger nuevo tiene `trackFunctionTiming` — N/A (sin CF).
- [x] Todo service nuevo con queries Firestore tiene `measureAsync` — N/A.
- [x] Todo `trackEvent` nuevo esta registrado en `GA4_EVENT_NAMES` — N/A.
- [x] Todo `trackEvent` nuevo tiene feature card en `ga4FeatureDefinitions.ts` — N/A.
- [x] `logger.error` NUNCA dentro de `if (import.meta.env.DEV)` — N/A (sin catch blocks nuevos).

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` tiene `aria-label` — sin IconButtons nuevos; los existentes en `BusinessDetailScreen` ya tienen aria-label.
- [x] No hay `<Typography onClick>` — N/A.
- [x] Touch targets minimo 44x44px — sin cambios en los chips; mantienen dimensiones MUI default.
- [x] Componentes con fetch tienen error state con retry — `DetailError` existente se preserva.
- [x] `<img>` con URL dinamica tienen `onError` fallback — N/A (sin imagenes nuevas).
- [x] httpsCallable en componentes user-facing tienen guard offline — N/A.
- [x] **Mejora a11y confirmada**: al remover el `useEffect` de focus-on-mount, screen readers ya no son interrumpidos con el anuncio del chip "Criterios" al cargar la pagina.

## Guardrails de copy

- [x] Todos los textos nuevos usan voseo — N/A (sin textos nuevos).
- [x] Tildes correctas — N/A.
- [x] Terminologia consistente — N/A.
- [x] Strings reutilizables en `src/constants/messages/` — N/A (los strings existentes de OG tags se preservan byte-a-byte).

## Criterios de done

- [ ] `src/utils/meta.ts` existe y exporta `setMetaTag` con JSDoc + tests >= 80% cobertura.
- [ ] `src/hooks/useBusinessPageMeta.ts` existe con el hook movido, importado desde `BusinessDetailPage` y con tests.
- [ ] `BusinessDetailPage.tsx` ya no contiene `setMetaTag` ni `useBusinessPageMeta` inline.
- [ ] `BusinessDetailScreen.tsx` no tiene el `useEffect(() => { chipRefs.current[activeIdx]?.focus(); }, [activeIdx])`. El foco se mueve solo dentro de `handleChipChange`.
- [ ] Test nuevo en `BusinessDetailScreen.test.tsx` verifica: al montar sin interaccion previa, el primer chip **no** recibe focus. Test de teclado (ArrowRight) verifica que el foco sigue al chip activo post-interaccion.
- [ ] `OpinionesTab.Props` no declara `onDirtyChange`. `BusinessDetailScreen` no pasa `onDirtyChange={() => {}}`.
- [ ] `BusinessComments` sigue aceptando `onDirtyChange?` opcional (sin cambios).
- [ ] `npm run test:run` pasa en local.
- [ ] `npm run test:coverage` no baja del 80% global.
- [ ] `npx tsc -b` sin errores.
- [ ] `npm run lint` sin errores.
- [ ] Verificacion manual con `npm run dev:full`: foco inicial NO en chip, click/keyboard mueve foco correctamente, `document.title` y meta tags presentes.
- [ ] `docs/reference/patterns.md` actualizado con mencion de `src/utils/meta.ts` y `useBusinessPageMeta`.
- [ ] `docs/_sidebar.md` — verificado: ya contiene las entradas para #319 (lineas 155-157), pre-existentes de un commit previo del batch. **No requiere cambio en este PR**; solo confirmar al hacer diff del branch.

---

## Validacion de Plan

**Delivery Lead**: Pablo
**Fecha**: 2026-04-23
**Estado**: VALIDADO (Ciclo 2)

### Historial de ciclos

- **Ciclo 1**: NO VALIDADO. Pablo reporto 1 BLOQUEANTE (granularidad de commits en Fase 1) y 4 IMPORTANTES (import huerfano de `useEffect`, justificacion de posicion de `focus()`, falta de audit previo de tests en Fase 3, falta de merge strategy explicito, criterio de done de `_sidebar.md` inconsistente) + 1 OBS (rollback).
- **Ciclo 2**: VALIDADO tras aplicar los fixes abajo.

### Hallazgos cerrados en esta iteracion

- **BLOQUEANTE #1 (granularidad de commits Fase 1)** → resuelto en la nueva tabla "Commits" al inicio de "Orden de implementacion". Fase 1 pasos 1+2+3 van explicitamente en un unico commit atomico ("refactor: extract setMetaTag util + useBusinessPageMeta hook from BusinessDetailPage"). La tabla define 4 commits (extraccion, chip focus, onDirtyChange, docs).
- **IMPORTANTE #1 (`useEffect` import huerfano Paso 3)** → resuelto: elevado a sub-bullet explicito en Fase 1 Paso 3, con nota de que deja TS6133 que rompe pre-push.
- **IMPORTANTE #2 (posicion de `focus()` Paso 2 Fase 2)** → resuelto: justificacion reescrita. Se deja a criterio del implementador; lo invariante es que ocurra post-`setActiveChip` y antes del proximo re-render.
- **IMPORTANTE #3 (audit previo de tests Fase 3)** → resuelto: agregado bloque "Audit previo" antes de la tabla de pasos de Fase 3, con `grep -rn 'onDirtyChange' src/components/business/__tests__/` obligatorio.
- **IMPORTANTE #4 (merge strategy explicito)** → resuelto: agregada seccion "Merge strategy" al tope del documento. PR standalone via skill `/merge`, sin dependencias con otros issues.
- **IMPORTANTE #5 (criterio de done de `_sidebar.md`)** → resuelto: el criterio ahora dice "verificado: ya contiene entradas para #319 (lineas 155-157), pre-existentes del batch, no requiere cambio". Convertido de TODO a verificacion.
- **OBS #1 (rollback)** → resuelto: linea agregada al final de la tabla de Riesgos, explicando que `git revert` del commit correspondiente es suficiente (sin migration/rules deploy).

### Observaciones abiertas para manu

Ninguna. Listo para implementacion.

---

_(Historico del Ciclo 1 disponible en thread de validacion con Pablo; no se reproduce aca por concision.)_
