# PRD: Tech debt ui-ux — chips ad-hoc (R5/R8), touch targets <44px y FAB sin safe-area

**Feature:** 345-techdebt-chips-touch-targets-fab-safe-area
**Categoria:** ux
**Fecha:** 2026-06-09
**Issue:** #345
**Prioridad:** Media (severidad MEDIUM en el reporte /health-check)

---

## Contexto

El guard `scripts/guards/lib/check-chip-height.mjs` (multiline-aware) reporta **6 chips** que evaden el token de diseño `CHIP_SMALL_SX` (introducido en #326) usando `height`/`fontSize` ad-hoc, más superficies con touch targets bajo el mínimo WCAG 2.5.5 (44x44px) y un FAB que no respeta `env(safe-area-inset-bottom)`. Son violaciones de las reglas R5/R8 del Guard #305 y observaciones de accesibilidad mobile que ya tienen patrón canónico establecido en el proyecto (`CHIP_SMALL_SX` en `theme/cards.ts`, `pb: 'calc(24px + env(safe-area-inset-bottom))'` en BusinessSheet/BusinessDetailScreen).

Output del guard al 2026-06-10 (6 violaciones en 6 archivos):

- `src/components/business/BusinessComments.tsx:262`
- `src/components/business/BusinessQuestions.tsx:259` (chip "Mejor respuesta" — DUPLICADO de QuestionAnswerThread)
- `src/components/business/QuestionAnswerThread.tsx:125`
- `src/components/home/TrendingBusinessCard.tsx:61`
- `src/components/social/VerificationBadge.tsx:34`
- `src/components/user/UserProfileContent.tsx:64`

## Problema

- **Seis** chips definen `height`/`fontSize` inline en vez de usar `CHIP_SMALL_SX`, lo que reabre el Guard #305 R5/R8 y desincroniza la altura de chips chicos con el resto de la app: `BusinessComments.tsx:262`, `BusinessQuestions.tsx:259`, `QuestionAnswerThread.tsx:125`, `TrendingBusinessCard.tsx:61`, `VerificationBadge.tsx:34`, `UserProfileContent.tsx:64`. El chip "Mejor respuesta" está **duplicado** en `BusinessQuestions.tsx:259` y `QuestionAnswerThread.tsx:125` (markup idéntico, `sx={{ height: 20, fontSize: '0.65rem', mb: 0.5 }}`). Todos evadieron el grep canónico single-line por estar `<Chip` y `height:` en líneas separadas; el detector multiline-aware los detecta.
- Chips clicables en `FilterChips.tsx` (filtros de tags y precio) y `BusinessTags.tsx:186-195` no garantizan touch target de 44x44px en mobile, violando WCAG 2.5.5 (target size). Son elementos de uso frecuente (filtrado del mapa, etiquetado de comercios).
- `LocationFAB.tsx` posiciona el FAB con `bottom: 24` fijo, sin sumar `env(safe-area-inset-bottom)`. En dispositivos con home indicator (iPhone X+) el FAB puede quedar parcialmente tapado, dificultando el tap de "Mi ubicación".

## Solucion

Migración de deuda técnica acotada a 8 archivos de componente (6 para los chips de S1 + `FilterChips`/`BusinessTags` para S2 + `LocationFAB` para S3), sin lógica de negocio nueva. El detector multilínea recomendado por el issue (`scripts/guards/lib/check-chip-height.mjs`) **ya existe** y es multiline-aware: este feature corrige las **6 violaciones** que el detector endurecido reporta, cerrando el loop audit → guard.

### S1 — Migrar los 6 chips ad-hoc a `CHIP_SMALL_SX` (R5/R8)

El token canónico (`src/theme/cards.ts`) define: `height: 24`, `fontSize: '0.75rem'`, `'& .MuiChip-icon': { fontSize: 14, ml: 0.5 }`, `'& .MuiChip-label': { px: 1 }`. Cada migración hace spread del token y preserva únicamente los overrides específicos del caso. En los 6 archivos hay que **agregar el import** `import { CHIP_SMALL_SX } from '../../theme/cards';` (los 6 están en `src/components/<dominio>/`, profundidad relativa `../../`; ninguno lo importa hoy).

- **`BusinessComments.tsx:262` (chips de orden "Recientes/Antiguos/Útiles")**: reemplazar `sx={{ height: 24, fontSize: '0.7rem' }}` por `sx={CHIP_SMALL_SX}`. El token mantiene `height: 24` (idéntico) y unifica `fontSize` a `0.75rem` (vs `0.7rem`, diferencia cosmética menor aceptable). Sin overrides necesarios.
- **`BusinessQuestions.tsx:259` (chip "Mejor respuesta" — DUPLICADO de QuestionAnswerThread)**: reemplazar `sx={{ height: 20, fontSize: '0.65rem', mb: 0.5 }}` por `sx={{ ...CHIP_SMALL_SX, mb: 0.5 }}`. El token sube `height` 20→24 y `fontSize` 0.65rem→0.75rem; `mb: 0.5` se preserva como override válido. **Markup idéntico** al de `QuestionAnswerThread.tsx:125` — misma migración en ambos (no se deduplica el componente en este PRD; ver Out of Scope).
- **`QuestionAnswerThread.tsx:125` (chip "Mejor respuesta")**: misma migración que el anterior — `sx={{ height: 20, fontSize: '0.65rem', mb: 0.5 }}` → `sx={{ ...CHIP_SMALL_SX, mb: 0.5 }}`.
- **`TrendingBusinessCard.tsx:61` (chips de breakdown con icono)**: reemplazar `sx={{ fontSize: '0.7rem', height: 24 }}` por `sx={CHIP_SMALL_SX}`. El token incluye `'& .MuiChip-icon': { fontSize: 14, ml: 0.5 }`, coherente con el `<Icon sx={{ fontSize: 14 }} />` ya presente (queda redundante pero no conflictivo; opcionalmente quitar el `sx` inline del icono en specs). Sin overrides necesarios.
- **`VerificationBadge.tsx:34` (rama `compact`, líneas 38-44)**: reemplazar el `sx` ad-hoc (`fontSize: '0.75rem', height: 24, borderColor, bgcolor, '& .MuiChip-label': { px: 0.75 }`) por `sx={{ ...CHIP_SMALL_SX, borderColor: badge.earned ? GOLD_HEX : undefined, bgcolor: badge.earned ? goldBg : undefined }}`. El token ya provee `height: 24`, `fontSize: '0.75rem'` y `'& .MuiChip-label': { px: 1 }` (vs `px: 0.75` actual — diferencia cosmética menor, aceptable). Se preservan los overrides de color de la medalla de oro (`borderColor`, `bgcolor`) específicos del badge.
- **`UserProfileContent.tsx:64` (chip de medalla/ranking)**: reemplazar `sx={{ fontSize: '0.7rem', height: 22 }}` por `sx={CHIP_SMALL_SX}`. El token sube `height` 22→24 y unifica `fontSize` 0.7rem→0.75rem. Sin overrides necesarios.
- Patrón aplicado: convención documentada en patterns.md — "Si un chip necesita override puntual, hacer spread: `sx={{ ...CHIP_SMALL_SX, mb: 0.5 }}`"; si no, `sx={CHIP_SMALL_SX}` directo.

### S2 — Touch targets >=44x44px en chips clicables (WCAG 2.5.5)

WCAG 2.5.5 (Target Size, Level AAA) exige que el área accionable sea **>=44px en ambos ejes** (44x44). El criterio de este feature es por lo tanto bidimensional: el target efectivo debe medir >=44px de alto **y** >=44px de ancho. Como los chips de filtro/tag son pequeños (alto ~24-32px) y de ancho variable según el label, la solución debe garantizar ambos mínimos sin agrandar visualmente el chip (densidad del header/scroller).

- **`FilterChips.tsx`**: los chips de tag y precio usan `size` default de MUI (~32px de alto). Para alcanzar 44x44 de target mínimo sin agrandar visualmente todos los chips, las opciones (a evaluar en specs) son: (a) `minHeight: 44, minWidth: 44` en el `chipSx` helper compartido — garantiza ambos ejes pero altera el alto visual; (b) mantener el alto visual y expandir el área táctil con padding/pseudo-elemento (`::before` con `min(44px)`) o un wrapper táctil de 44x44 envolviendo el chip. El criterio es: el área accionable efectiva debe ser **>=44px en alto y >=44px en ancho**. La decisión concreta queda para specs.
- **`BusinessTags.tsx:186-195`**: el `<Chip size="small">` (target ~24px de alto) es clicable (`onClick={handleToggleTag}`). El `IconButton` hermano ya tiene `minWidth: 44, minHeight: 44` (línea 202), pero el chip no. Aplicar el mismo mínimo de touch target bidimensional al chip clicable. Nota: este chip usa `size="small"` deliberadamente por densidad visual en el header de comercio; la solución debe expandir el target en ambos ejes sin romper la densidad — se define en specs (padding/wrapper táctil vs `minHeight`/`minWidth`).
- Patrón aplicado: el proyecto ya usa `minWidth: 44, minHeight: 44` en IconButtons (ej. `BusinessTags.tsx:202`) — el umbral 44x44 bidimensional ya existe en el repo. Se reutiliza el mismo umbral en ambos ejes.
- **Riesgo a validar en specs** (observación de la pre-revisión): si los chips viven en un contenedor con `overflowX: auto`, un `minHeight: 44` no debe introducir scroll vertical no deseado; medir antes de elegir la estrategia.

### S3 — FAB con safe-area-inset-bottom

- **`LocationFAB.tsx:14-24`**: cambiar `bottom: 24` por `bottom: 'calc(24px + env(safe-area-inset-bottom))'`. Patrón idéntico al ya usado en `BusinessSheet.tsx:105` y `BusinessDetailScreen.tsx:292` (`pb: 'calc(24px + env(safe-area-inset-bottom))'`). El FAB se renderiza en `SearchScreen.tsx:162` sobre el mapa; el fix evita que el home indicator lo tape en dispositivos notch.

### UX / interacción

- Sin cambios de flujo ni de navegación. Los chips "Mejor respuesta" (20→24px), la medalla de ranking (22→24px) y el resto crecen levemente en alto para unificarse con el sistema. Los chips de filtro y tags ganan área táctil 44x44 sin (idealmente) cambiar su apariencia visual. El FAB de ubicación se mueve hacia arriba lo justo para no superponerse con el home indicator.
- Verificación visual manual en mobile real o emulador con notch (no hay cobertura E2E de layout en el proyecto).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: migrar `BusinessComments.tsx:262` a CHIP_SMALL_SX | Alta | S |
| S1: migrar `BusinessQuestions.tsx:259` (Mejor respuesta) a CHIP_SMALL_SX | Alta | S |
| S1: migrar `QuestionAnswerThread.tsx:125` (Mejor respuesta) a CHIP_SMALL_SX | Alta | S |
| S1: migrar `TrendingBusinessCard.tsx:61` a CHIP_SMALL_SX | Alta | S |
| S1: migrar `VerificationBadge.tsx:34` (compact) a CHIP_SMALL_SX | Alta | S |
| S1: migrar `UserProfileContent.tsx:64` a CHIP_SMALL_SX | Alta | S |
| S2: touch target >=44x44px en `FilterChips.tsx` (tag + precio) | Media | S |
| S2: touch target >=44x44px en chip clicable de `BusinessTags.tsx` | Media | S |
| S3: `LocationFAB.tsx` safe-area-inset-bottom | Media | S |
| Verificar que `check-chip-height.mjs` reporta 0 violaciones post-fix (las 6 cerradas) | Alta | S |

**Esfuerzo total estimado:** S (6 chips en 6 archivos para S1 + 3 archivos para S2/S3)

---

## Out of Scope

- Crear o endurecer el detector de chips ad-hoc — `scripts/guards/lib/check-chip-height.mjs` ya es multiline-aware (cubre el caso `<Chip` + `height:` en líneas separadas). El issue lo recomienda como "endurecer detector" pero ya está implementado; este PRD solo corrige las 6 violaciones que el guard reporta.
- Deduplicar el chip "Mejor respuesta" entre `BusinessQuestions.tsx` y `QuestionAnswerThread.tsx` en un componente compartido — se migran ambos por separado a `CHIP_SMALL_SX`; extraer un componente común es refactor aparte (no requerido para cerrar el guard).
- Auditoría exhaustiva de touch targets en toda la app — solo se corrigen las 2 superficies citadas en el issue (`FilterChips`, `BusinessTags`).
- Rediseño visual de chips, badges o del FAB más allá de los ajustes mínimos de altura/área táctil/posición.
- Cambios en lógica de filtrado, etiquetado, verificación o geolocalización.

---

## Tests

El proyecto no tiene cobertura de tests de layout/estilo visual (los componentes son mayormente "visual, sin lógica" — excepción de la política de tests.md). Estos cambios son puramente de estilo (`sx`) y no introducen lógica condicional nueva, validación de input ni side effects. Caen bajo la **excepción documentada en tests.md**: "Componentes puramente visuales sin lógica".

El gate de regresión es el guard `check-chip-height.mjs`, no un test unitario.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `scripts/guards/lib/check-chip-height.mjs` | Guard (existente) | Ejecutar `node scripts/guards/lib/check-chip-height.mjs` post-fix → debe salir con código 0 (las 6 violaciones cerradas). Es el test de regresión efectivo. |

No se agregan tests unitarios de Vitest: ninguno de los 6 componentes de chips tiene test existente ni introduce lógica testeable (son cambios de `sx`). Si specs decide expandir touch target con un wrapper con `role`/handler, evaluar ahí si amerita un test de accesibilidad (improbable — no hay infra de a11y testing automatizado en el repo).

### Criterios de testing

- `node scripts/guards/lib/check-chip-height.mjs` retorna exit 0 (0 violaciones) tras S1 — las 6 violaciones actuales cerradas.
- `npm run guards` (o el runner que invoca `checks.mjs`) pasa sin nuevas violaciones.
- Build TypeScript (`tsc`) sin errores tras agregar el import de `CHIP_SMALL_SX` en los 6 archivos.
- Verificación visual manual: chips no se solapan, FAB visible sobre home indicator.

---

## Seguridad

Este feature no toca Firestore, Cloud Functions, Storage, auth, ni inputs de usuario. No escribe ni lee datos. No expone superficie nueva. No agrega colecciones ni callables. La sección de seguridad estándar (Firestore rules, rate limit, moderación) **no aplica**.

- [x] Sin escritura a Firestore (solo cambios de `sx` en componentes)
- [x] Sin lectura de datos nueva (no permite scraping)
- [x] Sin inputs de usuario nuevos
- [x] Sin `dangerouslySetInnerHTML`, `eval`, ni `Function`
- [x] Sin secretos, API keys ni emails hardcodeados (revisar diff antes de commit — repo público)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| Ninguna superficie nueva | N/A — cambios solo de estilo visual | N/A |

El feature no expone ninguna superficie atacable por bots/scripts. No hay endpoints, escrituras ni lecturas nuevas.

---

## Deuda tecnica y seguridad

Consulta de issues abiertos (2026-06-09): no hay issues con label `security` ni `tech debt` (los tech-debt usan label `enhancement`). Issues abiertos relacionados por dominio: #346 (copy), #347 (perf), #348/#349 (admin/docs), #344 (offline). Ninguno colisiona con los archivos de este feature.

Este feature **es en sí mismo** la mitigación de deuda técnica (#345). Cierra el loop audit → guard: el guard `check-chip-height.mjs` ya fue endurecido (multiline-aware) y este PRD elimina las 6 violaciones que reporta.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #305 Guard R5/R8 (chips ad-hoc) | mitiga | Cerrar las 6 violaciones de `height`/`fontSize` ad-hoc migrando a `CHIP_SMALL_SX` |
| #326 (introdujo `CHIP_SMALL_SX` y `SearchFab`) | mitiga | Completa la adopción del token en los 6 chips que quedaron fuera del barrido original |
| #196 / #319 (accesibilidad WCAG) | mitiga | Touch targets >=44x44px alinean con el trabajo de accesibilidad previo |

### Mitigacion incorporada

- Cerrar Guard #305 R5/R8 en los 6 chips (`BusinessComments`, `BusinessQuestions`, `QuestionAnswerThread`, `TrendingBusinessCard`, `VerificationBadge`, `UserProfileContent`) migrando a `CHIP_SMALL_SX` (paso S1 del plan).
- Cerrar observaciones WCAG 2.5.5 (44x44) en `FilterChips.tsx` y `BusinessTags.tsx` (paso S2).
- Cerrar observación safe-area en `LocationFAB.tsx` (paso S3).
- Confirmar que el guard endurecido reporta 0 violaciones (paso de verificación).

---

## Robustez del codigo

Los componentes no hacen operaciones async nuevas en este feature (solo cambian `sx`). El checklist de hooks async no aplica a los cambios. Igualmente se verifica que no se rompa nada existente.

### Checklist de hooks async

- [x] No se agregan `useEffect` con `await` ni handlers async nuevos
- [x] No hay `setState` post-async nuevo
- [x] No se exportan funciones nuevas
- [x] No se crean archivos en `src/hooks/`
- [x] No se agregan constantes de localStorage
- [x] Archivos modificados siguen bajo 300 líneas
- [x] No se agrega `logger.error` dentro de `if (import.meta.env.DEV)`

### Checklist de observabilidad

- [x] No hay Cloud Function trigger nuevo
- [x] No hay service nuevo con queries Firestore
- [x] No hay `trackEvent` nuevo (el `trackEvent` existente en `VerificationBadge` se preserva sin cambios)

### Checklist offline

- [x] No hay formularios/dialogs que escriban a Firestore
- [x] No se agregan error handlers nuevos

### Checklist de documentacion

- [x] No hay secciones nuevas de HomeScreen
- [x] No hay analytics events nuevos
- [x] No hay tipos nuevos
- [ ] `docs/reference/patterns.md`: confirmar que la nota de `CHIP_SMALL_SX` sigue vigente (ya documenta el patrón de spread — no requiere cambios salvo mencionar que la adopción se completó en los 6 chips restantes)
- [x] `docs/reference/features.md`: sin cambios (no es feature de usuario, es deuda técnica de estilo)
- [x] `docs/reference/firestore.md`: sin cambios (no toca datos)

---

## Offline

Sin impacto offline. Ninguno de los cambios involucra lectura ni escritura de Firestore, APIs externas ni estado que dependa de conectividad. Los chips de filtro operan sobre data estática local (`PREDEFINED_TAGS`, `PRICE_CHIPS`). El badge de verificación se calcula client-side con cache (sin writes). El FAB de ubicación usa la Geolocation API del browser (ya manejada por `useUserLocation`, fuera de scope).

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Render de chips/FAB | N/A (solo estilo) | N/A | N/A |

### Checklist offline

- [x] Reads de Firestore: ninguno nuevo
- [x] Writes: ninguno
- [x] APIs externas: ninguna nueva (Geolocation ya manejada fuera de scope)
- [x] UI: no requiere indicador offline nuevo
- [x] Datos críticos: N/A

### Esfuerzo offline adicional: S (nulo)

---

## Modularizacion y % monolitico

Cambios contenidos en componentes de dominio ya existentes (`business/`, `home/`, `social/`, `user/`, `search/`, `map/`), todos en su carpeta correcta. No se agrega estado global, no se tocan AppShell/SideMenu, no se crean contextos. La importación de `CHIP_SMALL_SX` desde `theme/cards` es un import de token de diseño (permitido en componentes). Reduce el acoplamiento al consolidar estilos ad-hoc en el token compartido en 6 chips más.

### Checklist modularizacion

- [x] Lógica de negocio en hooks/services — no se agrega lógica
- [x] Componentes siguen siendo reutilizables
- [x] No se agregan useState a AppShell/SideMenu
- [x] Props explícitas — sin cambios de props
- [x] Cada prop de acción tiene handler real — sin props nuevas
- [x] Ningún componente importa de `firebase/firestore`, `firebase/functions`, `firebase/storage` (solo `theme/cards`)
- [x] No se crean archivos en `src/hooks/`
- [x] Ningún archivo supera 400 líneas
- [x] No se crean converters
- [x] Archivos en carpeta de dominio correcta (NO en `components/menu/`)
- [x] No se necesita estado global nuevo

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Reemplaza `sx` ad-hoc (incl. el duplicado "Mejor respuesta") por token compartido `CHIP_SMALL_SX` en 6 chips |
| Estado global | = | No se toca estado global |
| Firebase coupling | = | No hay imports de Firebase nuevos |
| Organizacion por dominio | = | Archivos ya en carpetas de dominio correctas |

---

## Accesibilidad y UI mobile

Este feature **mejora** la accesibilidad mobile: es su objetivo principal (touch targets WCAG 2.5.5 44x44 + safe-area).

### Checklist de accesibilidad

- [x] `LocationFAB` ya tiene `aria-label="Mi ubicación"` (se preserva)
- [x] Chips de `FilterChips` usan `<Chip onClick>` (semántica MUI clickable correcta)
- [x] Chip de `BusinessTags` usa `<Chip onClick>` (semántica correcta); su IconButton hermano ya tiene `aria-label` dinámico
- [x] **Touch targets >=44x44px (ambos ejes)**: objetivo central de S2 — `FilterChips` y `BusinessTags` chip clicable
- [x] `IconButton` con `p: 0.25` — no aplica (no se introduce)
- [x] Componentes con carga de datos: sin cambios en estados de error
- [x] Imágenes dinámicas: N/A
- [x] Formularios: N/A

### Checklist de copy

- [x] Sin textos nuevos. Los existentes ("Mi ubicación", "Mejor respuesta", "Recientes/Antiguos/Útiles", labels de tags/precio/medallas) se preservan sin cambios.
- [x] Tono y terminología: sin cambios de copy
- [x] Strings reutilizables: N/A
- [x] Mensajes de error: sin cambios

---

## Success Criteria

1. `node scripts/guards/lib/check-chip-height.mjs` retorna exit **0 violaciones**: los **6 chips** (`BusinessComments.tsx:262`, `BusinessQuestions.tsx:259`, `QuestionAnswerThread.tsx:125`, `TrendingBusinessCard.tsx:61`, `VerificationBadge.tsx:34`, `UserProfileContent.tsx:64`) usan `CHIP_SMALL_SX` (con overrides puntuales vía spread donde corresponde — `mb: 0.5` en los chips "Mejor respuesta", colores de oro en `VerificationBadge`).
2. Los chips clicables de `FilterChips.tsx` (tag + precio) y el chip clicable de `BusinessTags.tsx` tienen un área táctil efectiva **>=44px en ambos ejes (44x44, WCAG 2.5.5)**, sin romper la densidad visual del header de comercio ni introducir scroll vertical en contenedores con `overflowX: auto`.
3. `LocationFAB` usa `bottom: 'calc(24px + env(safe-area-inset-bottom))'` y queda visible sobre el home indicator en dispositivos con notch.
4. `tsc` y `npm run guards` pasan sin errores ni nuevas violaciones; no se rompe ningún test existente.
5. Verificación visual manual en mobile/emulador con notch confirma que chips no se solapan y el FAB es alcanzable.

---

## Validacion Funcional

**Analista**: Sofia (gate formal pendiente)
**Fecha**: 2026-06-09
**Estado**: PENDIENTE DE GATE

> Nota para el orquestador: este PRD fue redactado por el agente prd-writer ejecutándose como subagente, sin capacidad de spawnear el subagente `sofia`. El gate funcional de Sofia debe correrse desde el orquestador antes de pasar a specs/plan. La pre-revisión interna aplicada (checklist funcional) no detectó BLOQUEANTES: el scope es acotado (8 archivos, solo `sx`/posición), los criterios de aceptación son medibles (guard exit 0 sobre los 6 chips, >=44x44 ambos ejes, `calc(...)` presente) y la decisión de diseño abierta de S2 (minHeight/minWidth vs wrapper táctil) está correctamente delegada a specs con criterio cuantitativo. Una observación menor abierta: confirmar en specs que `minHeight: 44` en chips dentro de contenedores con `overflowX: auto` no introduce scroll vertical no deseado.


## Validacion Funcional (Gate Sofia)

**Estado:** NO VALIDADO
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** BLOQUEANTE: el guard check-chip-height.mjs reporta 6 violaciones (BusinessComments, BusinessQuestions, QuestionAnswerThread, TrendingBusinessCard, VerificationBadge, UserProfileContent), el PRD cubre 2 → SC#1 (guard exit 0) inalcanzable. Touch target solo mide eje vertical (WCAG pide 44x44). En reconciliacion via prd-writer.

### Reconciliacion (prd-writer, 2026-06-12) — pendiente re-gate

Se aplicaron los siguientes cambios para resolver los 2 BLOQUEANTES; el veredicto final lo emite Sofia en el re-gate.

- **BLOQUEANTE 1 (SC#1 inalcanzable):** S1 ampliada de 2 a **6 chips**, cubriendo las 6 violaciones que reporta el guard (confirmadas con `node scripts/guards/lib/check-chip-height.mjs`, exit 1). Cada chip tiene su migración concreta a `CHIP_SMALL_SX` por archivo (con el `sx` ad-hoc actual verificado contra el código y los overrides puntuales preservados). Se documenta el chip "Mejor respuesta" DUPLICADO en `BusinessQuestions.tsx:259` y `QuestionAnswerThread.tsx:125` (misma migración en ambos; deduplicación marcada Out of Scope). Tabla de Scope, Success Criteria, Tests, Mitigacion y conteos actualizados de "2 chips/4 archivos" a "6 chips/6 archivos" (S1) + 3 archivos (S2/S3).
- **BLOQUEANTE 2 (touch target solo eje vertical):** S2 y SC#2 corregidos para exigir área táctil **>=44px en ambos ejes (44x44, WCAG 2.5.5)**. Se reformuló el criterio como bidimensional (alto y ancho) y se referenció el umbral 44x44 ya presente en `BusinessTags.tsx:202`.

**Estado de la reconciliacion:** reconciliado, pendiente re-gate de Sofia (Ciclo 2). No estampar veredicto hasta que Sofia revise.

### Re-gate Ciclo 2 (Sofia, 2026-06-12)
**Estado:** VALIDADO CON OBSERVACIONES
**Observaciones:** Los 2 BLOQUEANTES del Ciclo 1 quedaron cerrados y verificados contra el codigo:
- BLOQUEANTE 1 (SC#1 inalcanzable) → CERRADO. El guard `check-chip-height.mjs` reporta exit 1 con exactamente las 6 violaciones (`BusinessComments.tsx:262`, `BusinessQuestions.tsx:259`, `QuestionAnswerThread.tsx:125`, `TrendingBusinessCard.tsx:61`, `VerificationBadge.tsx:34`, `UserProfileContent.tsx:64`) y S1 ahora cubre las 6 con migracion concreta por archivo. El token `CHIP_SMALL_SX` (`src/theme/cards.ts:62`) coincide con lo descrito (`height: 24`, `fontSize: '0.75rem'`, icon `fontSize:14,ml:0.5`, label `px:1`); los overrides puntuales (`mb: 0.5`, colores de oro) son coherentes. Duplicado "Mejor respuesta" documentado y deduplicacion correctamente fuera de scope. SC#1 (guard exit 0) es alcanzable.
- BLOQUEANTE 2 (touch target solo eje vertical) → CERRADO. S2 y SC#2 exigen ahora >=44px en ambos ejes (44x44, WCAG 2.5.5). Umbral 44x44 ya presente en `BusinessTags.tsx:202` (verificado); decision de estrategia (minHeight/minWidth vs wrapper/padding tactil) delegada a specs con criterio cuantitativo.

Observaciones abiertas (no bloquean — para tener en cuenta en specs):
1. Riesgo de scroll vertical: confirmar en specs que expandir el target a 44px en chips dentro de contenedores con `overflowX: auto` (FilterChips) no introduzca scroll vertical no deseado. Ya esta marcado en S2.
2. `TrendingBusinessCard.tsx:61`: el `sx={{ fontSize: 14 }}` inline del `<Icon>` queda redundante con el `'& .MuiChip-icon'` del token; el PRD lo deja como limpieza opcional en specs — OK.
3. Diferencias cosmeticas menores de fontSize (0.7/0.65rem → 0.75rem) y label px (0.75 → 1) aceptadas explicitamente en el PRD — OK, no bloquean.

Completitud, coherencia con el proyecto (voseo, patrones de safe-area de BusinessSheet/BusinessDetailScreen, token CHIP_SMALL_SX), testabilidad (guard exit 0 + tsc + npm run guards + verificacion visual con notch) y casos edge: correctos para deuda tecnica de estilo sin Firestore/auth/billing. HABILITADO para pasar a specs+plan.
