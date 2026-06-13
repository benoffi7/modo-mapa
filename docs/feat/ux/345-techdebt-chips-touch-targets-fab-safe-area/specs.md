# Specs: Tech debt ui-ux — chips ad-hoc (R5/R8), touch targets <44px y FAB sin safe-area

**PRD:** [prd.md](prd.md)
**Issue:** #345
**Fecha:** 2026-06-12

---

## Resumen

Deuda técnica de estilo (`sx`) acotada a 8 componentes existentes. No toca Firestore, auth, Cloud Functions, Storage, billing ni offline. No agrega tipos, hooks, servicios, contextos ni estado global. Tres bloques:

- **S1** — Migrar 6 chips ad-hoc al token `CHIP_SMALL_SX` (`src/theme/cards.ts:62`), cerrando Guard #305 R5/R8.
- **S2** — Touch targets >=44x44px (ambos ejes, WCAG 2.5.5) en chips clicables de `FilterChips.tsx` y `BusinessTags.tsx`.
- **S3** — `LocationFAB.tsx` con `bottom: 'calc(24px + env(safe-area-inset-bottom))'`.

El gate de regresión es `node scripts/guards/lib/check-chip-height.mjs` (exit 0). Verificado el 2026-06-12: el guard reporta exit 1 con exactamente las 6 violaciones listadas en S1.

---

## Modelo de datos

No aplica. El feature no lee ni escribe Firestore. No agrega colecciones, campos ni tipos. No se modifican interfaces de `src/types/`.

## Firestore Rules

No aplica. Sin queries nuevas, sin colecciones nuevas, sin campos nuevos. Las tablas de Rules impact, Field whitelist y Cloud Functions del template se omiten por no haber superficie de datos.

## Seed Data

No aplica. No hay cambios de schema.

---

## Archivos afectados

### Nuevos (0)

No se crean archivos. Todos los cambios son ediciones a componentes existentes.

### Modificados (9)

| Archivo | Bloque | Cambio |
|---------|--------|--------|
| `src/components/business/BusinessComments.tsx` | S1 | Chip orden (Recientes/Antiguos/Útiles) → `CHIP_SMALL_SX` + import |
| `src/components/business/BusinessQuestions.tsx` | S1 | Chip "Mejor respuesta" → `{ ...CHIP_SMALL_SX, mb: 0.5 }` + import |
| `src/components/business/QuestionAnswerThread.tsx` | S1 | Chip "Mejor respuesta" → `{ ...CHIP_SMALL_SX, mb: 0.5 }` + import |
| `src/components/home/TrendingBusinessCard.tsx` | S1 | Chip breakdown → `CHIP_SMALL_SX` + import (+ limpieza icono opcional) |
| `src/components/social/VerificationBadge.tsx` | S1 | Chip compact → `{ ...CHIP_SMALL_SX, borderColor, bgcolor }` + import |
| `src/components/user/UserProfileContent.tsx` | S1 | Chip medalla/ranking → `CHIP_SMALL_SX` + import |
| `src/components/search/FilterChips.tsx` | S2 | Touch target 44x44 en `chipSx` helper |
| `src/components/business/BusinessTags.tsx` | S2 | Touch target 44x44 en chip clicable de tag |
| `src/components/map/LocationFAB.tsx` | S3 | `bottom: 'calc(24px + env(safe-area-inset-bottom))'` |

### Tests

| Archivo | Cambio |
|---------|--------|
| `scripts/guards/lib/check-chip-height.mjs` | Sin cambios — se ejecuta como gate de regresión (exit 0 post-fix) |

No se crean tests unitarios de Vitest (ver sección Tests — excepción documentada en `tests.md`).

---

## Componentes

Ningún componente cambia su firma de props, estado ni comportamiento. Solo cambian valores en `sx`. No hay props de acción nuevas, no hay handlers nuevos, no hay datos mutables vía props. La tabla "Mutable prop audit" del template no aplica (no se editan datos vía props).

### Token de referencia

`CHIP_SMALL_SX` (`src/theme/cards.ts:62`) define:

```ts
export const CHIP_SMALL_SX: SxProps<Theme> = {
  height: 24,
  fontSize: '0.75rem',
  '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
  '& .MuiChip-label': { px: 1 },
};
```

Import canónico en los 6 archivos de S1 (todos en `src/components/<dominio>/`, profundidad `../../`; ninguno lo importa hoy):

```ts
import { CHIP_SMALL_SX } from '../../theme/cards';
```

Verificado contra consumidores existentes que ya usan ese path desde la misma profundidad: `BusinessHeader.tsx:8`, `UserScoreCard.tsx:19`, `SearchListView.tsx:9`.

---

## S1 — Migrar los 6 chips ad-hoc a `CHIP_SMALL_SX`

Patrón documentado en `patterns.md`: si el chip no necesita override, `sx={CHIP_SMALL_SX}` directo; si lo necesita, spread `sx={{ ...CHIP_SMALL_SX, <override> }}`. El `<` ordinal de cada chip en la tabla es el `sx` ad-hoc actual verificado contra el código (2026-06-12).

| Archivo:línea | `sx` actual | `sx` nuevo | Efecto cosmético |
|---------------|-------------|-----------|------------------|
| `BusinessComments.tsx:269` (chip dentro del `<Chip key={mode}>` que abre en :262) | `{ height: 24, fontSize: '0.7rem' }` | `CHIP_SMALL_SX` | height idéntico (24); fontSize 0.7→0.75rem |
| `BusinessQuestions.tsx:264` (chip que abre en :259) | `{ height: 20, fontSize: '0.65rem', mb: 0.5 }` | `{ ...CHIP_SMALL_SX, mb: 0.5 }` | height 20→24; fontSize 0.65→0.75rem; `mb: 0.5` preservado |
| `QuestionAnswerThread.tsx:130` (chip que abre en :125) | `{ height: 20, fontSize: '0.65rem', mb: 0.5 }` | `{ ...CHIP_SMALL_SX, mb: 0.5 }` | idem anterior (markup duplicado, misma migración) |
| `TrendingBusinessCard.tsx:67` (chip que abre en :61) | `{ fontSize: '0.7rem', height: 24 }` | `CHIP_SMALL_SX` | height idéntico (24); fontSize 0.7→0.75rem |
| `VerificationBadge.tsx:38-44` (chip que abre en :34) | `{ fontSize: '0.75rem', height: 24, borderColor: badge.earned ? GOLD_HEX : undefined, bgcolor: badge.earned ? goldBg : undefined, '& .MuiChip-label': { px: 0.75 } }` | `{ ...CHIP_SMALL_SX, borderColor: badge.earned ? GOLD_HEX : undefined, bgcolor: badge.earned ? goldBg : undefined }` | height/fontSize idénticos; label px 0.75→1; colores de oro preservados |
| `UserProfileContent.tsx:69` (chip que abre en :64) | `{ fontSize: '0.7rem', height: 22 }` | `CHIP_SMALL_SX` | height 22→24; fontSize 0.7→0.75rem |

### Observación #2 de Sofia — icono redundante en TrendingBusinessCard

El `<Icon sx={{ fontSize: 14 }} />` en `TrendingBusinessCard.tsx:63` queda redundante con `'& .MuiChip-icon': { fontSize: 14, ml: 0.5 }` que ya aporta el token. **Decisión de specs:** quitar el `sx={{ fontSize: 14 }}` inline del `<Icon>` (línea 63) en la misma edición — el token ya fija `fontSize: 14` en el slot `.MuiChip-icon`. Limpieza segura (mismo valor, sin diff visual) que evita el override duplicado. Si por algún motivo el wrapper del icono no aplicara el selector del slot, se revierte a dejar el `sx` inline; no es bloqueante.

### Observación #3 de Sofia — diffs cosméticos de fontSize

Las diferencias de `fontSize` (0.7/0.65rem → 0.75rem) y `label px` (0.75 → 1) son crecimientos menores de 1-2px aceptados explícitamente en el PRD. Unifican los chips con el sistema de diseño. No requieren mitigación; se verifican en la revisión visual manual (no se solapan, mantienen legibilidad).

---

## S2 — Touch targets >=44x44px (WCAG 2.5.5)

WCAG 2.5.5 exige área accionable **>=44px en alto y >=44px en ancho**. Los dos contenedores tienen layout distinto, lo que determina la estrategia:

### Observación #1 de Sofia — riesgo de scroll vertical (resuelto en specs)

| Contenedor | Layout del wrapper | Riesgo de `minHeight: 44` |
|-----------|--------------------|--------------------------|
| `FilterChips.tsx` | `display: flex; overflowX: auto` (scroller horizontal, `FilterChips.tsx:24-32`) | **Sí** — aumentar el alto del chip aumenta el alto de la fila scroller; medir |
| `BusinessTags.tsx` | `display: flex; flexWrap: wrap` (`BusinessTags.tsx:172`) | **No** — wrap vertical, sin `overflowX`; `minHeight` solo aumenta el alto de la fila de wrap (mismo comportamiento que el IconButton hermano que ya tiene `minHeight: 44`) |

**Decisión de estrategia por contenedor:**

#### `FilterChips.tsx` — `minHeight`/`minWidth` directo en el `chipSx` helper

El contenedor es un scroller horizontal de una sola fila; no hay otras filas debajo que se desplacen. Aumentar el alto del chip a 44 **aumenta el alto de la fila scroller** pero NO introduce scroll vertical: el scroller solo tiene `overflowX: auto` (no `overflowY`), y la fila crece para acomodar su contenido más alto. El padre (`SearchScreen.tsx:155`) ya posiciona la fila de filtros como un bloque de altura natural. Por lo tanto la opción (a) del PRD es segura aquí.

Cambio en el helper compartido `chipSx(isActive)`:

```ts
const chipSx = (isActive: boolean) => ({
  bgcolor: isActive ? undefined : 'background.paper',
  boxShadow: 1,
  flexShrink: 0,
  minHeight: 44,
  minWidth: 44,
  '&:hover, &.MuiChip-clickable:hover': {
    boxShadow: 2,
    bgcolor: isActive ? undefined : 'background.paper',
  },
});
```

Aplica automáticamente a los chips de tag y de precio (ambos usan `sx={chipSx(isActive)}`). El `label` con padding lateral de MUI ya garantiza ancho >=44 para los labels existentes; `minWidth: 44` cubre el caso de label corto. **Verificación visual obligatoria:** confirmar en DevTools 360px que la fila de filtros no se solapa con el contenido inferior (mapa/lista) ni recorta los chips. Si la fila crece más de lo aceptable, fallback a opción (b): mantener alto visual ~32 y usar pseudo-elemento táctil (`'&::before': { content: '""', position: 'absolute', inset: '-6px 0', minHeight: 44 }`) — documentado como plan B, no se aplica por defecto.

#### `BusinessTags.tsx` — `minHeight`/`minWidth` en el chip clicable

El chip usa `size="small"` (alto ~24) y es clicable (`onClick={handleToggleTag}`, `BusinessTags.tsx:190`). El contenedor es `flexWrap: wrap` (sin `overflowX`), así que `minHeight: 44` no introduce scroll horizontal ni vertical no deseado: la fila de wrap crece, igual que ya lo hace por el IconButton hermano de 44x44 (`BusinessTags.tsx:202`).

```tsx
sx={{ opacity: isVisible ? 1 : 0.6, borderRadius: 1, minHeight: 44, minWidth: 44 }}
```

Se preservan `opacity` y `borderRadius: 1` actuales. El `size="small"` se mantiene (densidad visual del header); `minHeight`/`minWidth` expanden el área accionable sin agrandar el `fontSize` del label. El IconButton hermano ya tiene el mismo umbral, así que la fila ya está dimensionada para 44px de alto — el cambio no rompe la densidad existente.

**Nota:** el chip de `BusinessTags.tsx:194` NO dispara el guard `check-chip-height.mjs` (no tiene `height:` ad-hoc), y `minHeight`/`minWidth` no son `height`, por lo que no reintroduce violación. Idem para `FilterChips` (`minHeight`/`minWidth` ≠ `height`).

---

## S3 — FAB con safe-area-inset-bottom

`LocationFAB.tsx:16`: cambiar `bottom: 24` por `bottom: 'calc(24px + env(safe-area-inset-bottom))'`. Patrón idéntico al ya usado en `BusinessSheet.tsx:105` y `BusinessDetailScreen.tsx:292`. El FAB se renderiza en `SearchScreen.tsx` sobre el mapa con `position: absolute`; el fix evita que el home indicator (iPhone X+) lo tape. El `aria-label="Mi ubicación"` (`LocationFAB.tsx:11`) se preserva.

```tsx
sx={{
  position: 'absolute',
  bottom: 'calc(24px + env(safe-area-inset-bottom))',
  right: 16,
  // ...resto sin cambios
}}
```

---

## Hooks

No aplica. No se crean ni modifican hooks. `LocationFAB` sigue usando `useUserLocation` sin cambios.

## Servicios

No aplica. No se crean ni modifican servicios. Sin operaciones Firestore.

## Cloud Functions

No aplica.

## Integración

Los cambios son internos a cada componente. Ningún consumidor cambia: las firmas de props de `VerificationBadge`, `UserProfileContent`, `TrendingBusinessCard`, `FilterChips`, `BusinessTags`, `LocationFAB`, `BusinessComments`, `BusinessQuestions` y `QuestionAnswerThread` permanecen idénticas.

### Preventive checklist

- [x] **Service layer**: ningún componente importa `firebase/firestore` (solo se agrega import de `theme/cards`).
- [x] **Duplicated constants**: no se definen arrays/objetos nuevos; se consolida en el token existente `CHIP_SMALL_SX`.
- [x] **Context-first data**: no hay `getDoc` nuevo; no se lee data.
- [x] **Silent .catch**: no se agregan `.catch`.
- [x] **Stale props**: no hay componente que reciba props y mute esa data.

## Tests

El proyecto no tiene cobertura de tests de layout/estilo visual (componentes "puramente visuales sin lógica" — excepción documentada en `tests.md`). Estos cambios son solo `sx`/posición: no introducen lógica condicional, validación de input ni side effects. No se agregan tests unitarios de Vitest.

| Archivo test | Qué testear | Tipo |
|-------------|-------------|------|
| `scripts/guards/lib/check-chip-height.mjs` | Ejecutar post-fix → exit 0 (las 6 violaciones de S1 cerradas) | Guard (regresión, existente) |

El gate de regresión efectivo es el guard, no un test unitario. `tsc` y `npm run guards` deben pasar sin errores ni nuevas violaciones.

## Analytics

No aplica. No se agregan `trackEvent`/`logEvent`. El `trackEvent('verification_badge_tooltip', ...)` existente en `VerificationBadge.tsx:28` se preserva sin cambios. Los `trackEvent` de filtro en `FilterChips.tsx:41,60` se preservan sin cambios.

---

## Offline

Sin impacto. Ningún cambio involucra lectura/escritura de Firestore, APIs externas ni estado dependiente de conectividad. Las tablas de cache, writes offline y fallback UI del template no aplican.

---

## Accesibilidad y UI mobile

Este feature **mejora** la accesibilidad mobile (es su objetivo: touch targets WCAG 2.5.5 + safe-area).

| Componente | Elemento | aria-label | Min touch target | Error state |
|-----------|----------|------------|-----------------|-------------|
| `FilterChips` | Chip tag/precio (clicable) | N/A (Chip con label de texto visible) | 44x44 (S2) | N/A (data estática local) |
| `BusinessTags` | Chip tag (clicable) | N/A (label visible); IconButton hermano ya tiene `aria-label` dinámico | 44x44 (S2) | N/A |
| `LocationFAB` | Fab | `"Mi ubicación"` (ya presente, se preserva) | Fab `size="medium"` (48px) | N/A |

### Reglas

- Todo `<IconButton>` → no se agregan IconButtons.
- No se introduce `<Typography onClick>`, `<Box onClick>` ni `<Avatar onClick>`.
- Touch targets: S2 garantiza 44x44 en ambos ejes en los chips clicables (no se usa `p: 0.25` ni `width: 32`).
- Componentes con fetch: sin cambios en estados de error.
- `<img>` con URL dinámica: N/A.

## Textos y copy

Sin textos nuevos. Los existentes ("Mi ubicación", "Mejor respuesta", "Recientes/Antiguos/Útiles", labels de tags/precio/medallas) se preservan sin cambios. No hay tabla de copy nueva.

### Reglas de copy

- [x] Sin strings nuevos visibles al usuario.
- [x] Tildes y voseo: sin cambios (no se toca copy).
- [x] Terminología: sin cambios.

---

## Decisiones técnicas

1. **`minHeight`/`minWidth` directo (opción a del PRD) en ambos contenedores de S2.** Tras verificar el layout: `FilterChips` es scroller `overflowX: auto` sin `overflowY` (crecer en alto no introduce scroll vertical) y `BusinessTags` es `flexWrap: wrap` sin `overflowX` (su IconButton hermano ya impone 44px de alto). El wrapper táctil / pseudo-elemento (opción b) queda documentado como plan B solo si la verificación visual en 360px muestra solapamiento. Se elige (a) por simplicidad y consistencia con el umbral 44x44 ya presente en el repo (`BusinessTags.tsx:202`).
2. **`minHeight`/`minWidth` no reintroducen el guard.** El guard `check-chip-height.mjs` detecta `height:` literal en el tag del Chip; `minHeight`/`minWidth` son propiedades distintas y no disparan la regla. Confirmado leyendo el regex del guard (`/\bheight\s*:/` matchea `minHeight`? No — `\bheight` requiere word boundary; en `minHeight` el `n` precede a `height` y no hay boundary entre `n` y `h`, por lo que `\bheight` NO matchea `minHeight`). Verificado: el guard no reporta `minHeight`/`minWidth`.
3. **Limpieza del icono en TrendingBusinessCard (obs #2).** Se quita el `sx={{ fontSize: 14 }}` inline porque el token ya lo provee vía `.MuiChip-icon`. Misma medida visual, menos override.
4. **No se deduplica "Mejor respuesta".** `BusinessQuestions.tsx` y `QuestionAnswerThread.tsx` tienen markup idéntico; extraer un componente común es refactor aparte (Out of Scope del PRD). Se migran ambos por separado.

---

## Hardening de seguridad

No aplica. El feature no introduce ninguna superficie nueva (sin Firestore, sin callables, sin Storage, sin inputs de usuario, sin `dangerouslySetInnerHTML`/`eval`). Las tablas de Firestore rules, rate limiting y vectores de ataque del template no aplican — confirmado en la sección Seguridad del PRD.

| Aspecto | Estado |
|---------|--------|
| Escritura a Firestore | Ninguna |
| Lectura de datos nueva | Ninguna |
| Inputs de usuario nuevos | Ninguno |
| Secretos/API keys/emails hardcodeados | Revisar diff antes de commit (repo público) — no se agregan |

---

## Deuda técnica: mitigación incorporada

Consulta de issues (2026-06-09, según PRD): los tech-debt usan label `enhancement` (no `tech debt`/`security`). Este feature **es** la mitigación de deuda técnica de #345.

| Issue | Qué se resuelve | Paso del plan |
|-------|----------------|---------------|
| #305 Guard R5/R8 (chips ad-hoc) | Cerrar las 6 violaciones de `height`/`fontSize` ad-hoc migrando a `CHIP_SMALL_SX` | Fase 1 |
| #326 (introdujo `CHIP_SMALL_SX`) | Completar la adopción del token en los 6 chips que quedaron fuera del barrido original | Fase 1 |
| #196 / #319 (accesibilidad WCAG) | Touch targets >=44x44px en `FilterChips` y `BusinessTags` | Fase 2 |

No se agrava deuda existente: los 9 archivos quedan por debajo de 400 líneas, sin nuevos imports de Firebase, en sus carpetas de dominio correctas.

---

## Validación Tecnica

**Arquitecto**: Diego
**Fecha**: (pendiente — sello de Diego)
**Estado**: (pendiente — sello de Diego)

---

## Revisión Técnica (Gate Diego)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Revisor:** Diego (solution architect)

**Observaciones:**
- Cobertura PRD→specs completa. Las 3 preguntas críticas quedaron verificadas contra el código: (a) FilterChips vive en una fila flotante `position:absolute` (SearchScreen:155) de altura natural sin `overflowY`, e internamente solo tiene `overflowX:auto` → `minHeight:44` crece la fila sin scroll vertical; BusinessTags es `flexWrap:wrap` con IconButton hermano que ya impone 44px (`:202`); (b) ejecuté el regex del guard `\bheight\s*:` contra `minHeight:44` → `false`, confirma que minHeight/minWidth NO reintroducen el guard; (c) el guard reporta exit 1 con exactamente las 6 violaciones listadas, y reemplazar el `height:` literal por `CHIP_SMALL_SX` deja exit 0. Token, import path (`../../theme/cards`, precedente en BusinessHeader/UserScoreCard/SearchListView) y patrón safe-area (BusinessSheet:105, BusinessDetailScreen:292) verificados.
- OBSERVACION 1 (para el plan): la "verificación visual obligatoria a 360px" de S2/FilterChips no es automatizable (no hay E2E de layout). El plan debe dejar ese check como paso manual explícito y tener el plan B (pseudo-elemento táctil) listo por si la fila se solapa con el ViewToggle hermano o recorta chips — la fila comparte ancho con ViewToggle vía `gap:1` y `minWidth:0`.
- OBSERVACION 2 (cosmética, no bloquea): la migración de VerificationBadge descarta `'& .MuiChip-label':{px:0.75}` quedándose con el `px:1` del token; coherente con el diff cosmético aceptado en el PRD. La limpieza del `<Icon sx={{fontSize:14}}>` en TrendingBusinessCard:63 es opcional y reversible como dice el specs — el slot `.MuiChip-icon` del token aplica al icono pasado vía prop `icon=`, así que el inline es redundante.
- Sin tests unitarios nuevos: correcto por excepción de tests.md (cambios solo `sx`). El gate de regresión efectivo es `node scripts/guards/lib/check-chip-height.mjs` (exit 0) + `tsc` + `npm run guards`. HABILITADO para pasar a plan (Pablo).
