# Plan: Tech debt ui-ux — chips ad-hoc (R5/R8), touch targets <44px y FAB sin safe-area

**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)
**Issue:** #345
**Fecha:** 2026-06-12

---

## Estrategia

Deuda técnica de UI agrupada en 3 bloques (S1/S2/S3). Una sola rama desde `new-home`. Sin worktree: los 9 archivos son independientes entre sí (ningún archivo se toca en más de un bloque). Riesgo bajo: solo `sx`/posición, sin lógica, sin Firestore, sin tests nuevos. El gate de regresión es el guard `check-chip-height.mjs` (exit 0).

**Branch:** `fix/345-chips-touch-targets-fab-safe-area`

---

## Estimación de tamaño de archivos

| Archivo | Líneas actuales (aprox) | Δ | ¿>400? |
|---------|------------------------|---|--------|
| `BusinessComments.tsx` | ~290 | +1 import, ±0 | No |
| `BusinessQuestions.tsx` | ~280 | +1 import | No |
| `QuestionAnswerThread.tsx` | ~150 | +1 import | No |
| `TrendingBusinessCard.tsx` | ~80 | +1 import, -1 (icono) | No |
| `VerificationBadge.tsx` | ~90 | +1 import, neto -3 (sx más corto) | No |
| `UserProfileContent.tsx` | ~200 | +1 import | No |
| `FilterChips.tsx` | 71 | +2 (minHeight/minWidth) | No |
| `BusinessTags.tsx` | ~230 | ±0 (mismo `sx`, +2 props) | No |
| `LocationFAB.tsx` | 33 | ±0 | No |

Ningún archivo se acerca a 400 líneas. Sin decomposición necesaria.

---

## Fases de implementación

### Fase 1: S1 — Migrar los 6 chips a `CHIP_SMALL_SX` (Alta)

**Branch:** `fix/345-chips-touch-targets-fab-safe-area`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/BusinessComments.tsx` | Agregar `import { CHIP_SMALL_SX } from '../../theme/cards';`. En el Chip que abre en :262, reemplazar `sx={{ height: 24, fontSize: '0.7rem' }}` (:269) por `sx={CHIP_SMALL_SX}`. |
| 2 | `src/components/business/BusinessQuestions.tsx` | Agregar import. Reemplazar `sx={{ height: 20, fontSize: '0.65rem', mb: 0.5 }}` (:264) por `sx={{ ...CHIP_SMALL_SX, mb: 0.5 }}`. |
| 3 | `src/components/business/QuestionAnswerThread.tsx` | Agregar import. Reemplazar `sx={{ height: 20, fontSize: '0.65rem', mb: 0.5 }}` (:130) por `sx={{ ...CHIP_SMALL_SX, mb: 0.5 }}`. |
| 4 | `src/components/home/TrendingBusinessCard.tsx` | Agregar import. Reemplazar `sx={{ fontSize: '0.7rem', height: 24 }}` (:67) por `sx={CHIP_SMALL_SX}`. Quitar `sx={{ fontSize: 14 }}` del `<Icon>` (:63) → `<Icon />` (obs #2: el token ya fija `fontSize: 14` en `.MuiChip-icon`). |
| 5 | `src/components/social/VerificationBadge.tsx` | Agregar import. Reemplazar el `sx` ad-hoc (:38-44) por `sx={{ ...CHIP_SMALL_SX, borderColor: badge.earned ? GOLD_HEX : undefined, bgcolor: badge.earned ? goldBg : undefined }}`. Se eliminan `height`, `fontSize` y `'& .MuiChip-label': { px: 0.75 }` (el token aporta `px: 1`). |
| 6 | `src/components/user/UserProfileContent.tsx` | Agregar import. Reemplazar `sx={{ fontSize: '0.7rem', height: 22 }}` (:69) por `sx={CHIP_SMALL_SX}`. |
| 7 | — | Correr `node scripts/guards/lib/check-chip-height.mjs` → debe salir **exit 0** (las 6 violaciones cerradas). |
| 8 | — | Correr `npx tsc --noEmit` → sin errores por los imports nuevos. |

**Commit:** `fix(#345): migrate 6 ad-hoc chips to CHIP_SMALL_SX (R5/R8)`.

### Fase 2: S2 — Touch targets 44x44 (Media)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/search/FilterChips.tsx` | En el helper `chipSx(isActive)` agregar `minHeight: 44, minWidth: 44`. Aplica a chips de tag y precio (ambos ya usan `sx={chipSx(isActive)}`). |
| 2 | `src/components/business/BusinessTags.tsx` | En el chip clicable (:194) reemplazar `sx={{ opacity: isVisible ? 1 : 0.6, borderRadius: 1 }}` por `sx={{ opacity: isVisible ? 1 : 0.6, borderRadius: 1, minHeight: 44, minWidth: 44 }}`. |
| 3 | — | Verificación visual DevTools 360px: fila de filtros de `FilterChips` no se solapa con el contenido inferior ni recorta chips; chips de `BusinessTags` mantienen densidad del header. Si `FilterChips` muestra solapamiento → aplicar plan B (pseudo-elemento táctil, ver specs). |
| 4 | — | Re-correr `node scripts/guards/lib/check-chip-height.mjs` → sigue exit 0 (`minHeight`/`minWidth` no disparan el guard; verificado: `/\bheight\s*:/` no matchea `minHeight`). |

**Commit:** `fix(#345): enforce 44x44 touch targets in FilterChips + BusinessTags (WCAG 2.5.5)`.

### Fase 3: S3 — FAB safe-area (Media)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/map/LocationFAB.tsx` | Reemplazar `bottom: 24` (:16) por `bottom: 'calc(24px + env(safe-area-inset-bottom))'`. Preservar `aria-label`, `position: absolute`, `right: 16`, `zIndex` y demás `sx`. |
| 2 | — | Verificación visual en emulador con notch: el FAB queda por encima del home indicator. |

**Commit:** `fix(#345): LocationFAB respects safe-area-inset-bottom`.

### Fase 4: Verificación + build

| Paso | Comando | Criterio |
|------|---------|----------|
| 1 | `node scripts/guards/lib/check-chip-height.mjs` | exit 0 |
| 2 | `npm run guards` | sin nuevas violaciones |
| 3 | `npx tsc --noEmit` (o `npm run build`) | sin errores |
| 4 | `npm run lint` | sin errores nuevos |
| 5 | `npm run test:run` | tests existentes no rompen |

### Fase 5: Documentación (obligatoria)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Confirmar nota de `CHIP_SMALL_SX` (ya documenta spread): agregar que la adopción se completó en los 6 chips restantes (#345). Sin cambio de patrón. |
| 2 | `docs/_sidebar.md` | Agregar entradas PRD/Specs/Plan de #345 bajo categoría **UX**. |

Filas no aplicables eliminadas: `security.md` (no toca rules/auth/storage), `firestore.md` (no toca datos), `features.md` (no es feature de usuario, es deuda de estilo), `project-reference.md` (sin cambio de funcionalidad), `HelpSection.tsx` (sin cambio visible de comportamiento).

---

## Orden de implementación

1. **Fase 1 (S1)** — 6 chips a `CHIP_SMALL_SX`. Es el bloque que cierra el guard (Success Criteria #1). Hacer primero para validar el gate.
2. **Fase 2 (S2)** — touch targets. Independiente de S1 (archivos distintos).
3. **Fase 3 (S3)** — FAB safe-area. Independiente.
4. **Fase 4** — verificación cruzada (guard + tsc + lint + tests).
5. **Fase 5** — docs + sidebar.

Las 3 fases de código son paralelizables (sin archivos compartidos), pero el orden propuesto valida el gate primero.

## Riesgos

1. **`FilterChips` scroller crece en alto con `minHeight: 44`.** Mitigación: el scroller solo tiene `overflowX: auto` (no `overflowY`), así que crece sin scroll vertical; verificación visual en 360px en Fase 2 paso 3; plan B (pseudo-elemento táctil) documentado en specs si hay solapamiento.
2. **Diffs cosméticos de fontSize (obs #3).** Crecimientos de 1-2px aceptados en el PRD; se confirman en la revisión visual (legibilidad, sin solapamiento).
3. **Limpieza del icono en TrendingBusinessCard (obs #2).** Si el slot `.MuiChip-icon` no aplicara `fontSize: 14`, revertir a dejar el `sx` inline del `<Icon>`. No bloqueante.

## Guardrails de modularidad

- [x] Ningún componente nuevo importa `firebase/firestore` (solo `theme/cards`).
- [x] Archivos nuevos: ninguno; los 9 modificados están en su carpeta de dominio correcta.
- [x] Lógica de negocio: no se agrega (solo `sx`).
- [x] Se toca deuda técnica (#345) — el fix ES el plan; no se agrava deuda.
- [x] Ningún archivo resultante supera 400 líneas (ver tabla de estimación).

## Guardrails de seguridad

- [x] No hay colección nueva, callable, rule ni rate limit (no aplica `hasOnly`/`affectedKeys`).
- [x] No hay secrets, admin emails ni credenciales en el diff (revisar antes de commit — repo público).
- [x] No se usa `getCountFromServer`.

## Guardrails de observabilidad

- [x] No hay CF trigger nuevo (no aplica `trackFunctionTiming`).
- [x] No hay service nuevo con queries (no aplica `measureAsync`).
- [x] No hay `trackEvent` nuevo; los existentes se preservan.
- [x] No se agrega `logger.error` dentro de `if (import.meta.env.DEV)`.

## Guardrails de accesibilidad y UI

- [x] No se agregan `<IconButton>` (los existentes con `aria-label` se preservan).
- [x] No hay `<Typography onClick>`.
- [x] Touch targets: S2 garantiza 44x44 en ambos ejes; no se usa `p: 0.25` ni `width: 32`.
- [x] Componentes con fetch: sin cambios en error state.
- [x] `<img>` dinámica: N/A.
- [x] httpsCallable: ninguno.

## Guardrails de copy

- [x] Sin textos nuevos.
- [x] Tildes/voseo: sin cambios de copy.
- [x] Terminología consistente: sin cambios.

## Criterios de done

- [ ] `node scripts/guards/lib/check-chip-height.mjs` retorna exit 0 (las 6 violaciones de S1 cerradas).
- [ ] Chips clicables de `FilterChips` y `BusinessTags` tienen área táctil >=44x44px sin romper densidad ni introducir scroll vertical.
- [ ] `LocationFAB` usa `bottom: 'calc(24px + env(safe-area-inset-bottom))'`.
- [ ] `npx tsc --noEmit`, `npm run guards` y `npm run lint` pasan sin errores ni nuevas violaciones.
- [ ] `npm run test:run` no rompe tests existentes.
- [ ] Verificación visual manual en mobile/emulador con notch (chips no se solapan, FAB alcanzable).
- [ ] `docs/reference/patterns.md` y `docs/_sidebar.md` actualizados.

---

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 1

**Observaciones para el implementador:**

1. **Ratchet de baseline atado al commit de S1 (IMPORTANTE).** `.guards-baseline.json` tiene `305/R5-chip-height-adhoc: 6`. Al cerrar las 6 violaciones (Fase 1), el merge skill (Phase 0a/0a-bis) exige `npm run guards:baseline` + `git add .guards-baseline.json` y commitear el baseline EN EL MISMO COMMIT que el codigo de S1. El plan define el gate como "guard exit 0" pero no agenda el ratchet; el implementador debe incluir `.guards-baseline.json` en el commit de Fase 1 (no en commit/rama aparte), si no la reduccion 6->0 no queda lockeada.

2. **Orden atomico S1 -> guard exit 0 -> ratchet -> commit (IMPORTANTE).** Aplicar los 6 archivos, confirmar guard exit 0, recien entonces ratchear baseline y commitear todo junto. El ratchet depende de que S1 ya este aplicado.

3. **Verificacion visual 360px: dueno y solapamiento con ViewToggle (OBSERVACION).** Diego marco que la fila de FilterChips comparte ancho con el ViewToggle hermano via `gap:1` y `minWidth:0`. El check manual a 360px (Fase 2 paso 3) lo ejecuta luna ANTES de cerrar S2 — no hay E2E que lo capture, no se difiere al merge. Verificar explicitamente solapamiento/recorte contra ViewToggle, no solo "contenido inferior". Plan B (pseudo-elemento tactil) aplicable en la misma Fase 2 si se detecta solapamiento.

4. **Estimacion por fase (OBSERVACION).** El plan no asigna S/M/L por bloque. Reparto coherente con el "S" total del PRD: Fase 1 = M (6 archivos + ratchet, el grueso), Fase 2/3/4/5 = S. Ningun bloque introduce logica, tests ni datos.

**Nota:** El plan es solido en orden de fases, granularidad (1 commit logico por bloque), file ownership (9 archivos sin overlap entre S1/S2/S3, una sola rama) y risk staging (cambios reversibles, sin schema/rules/datos). Rama `fix/345`: el merge skill corre TODAS las guards 1a-1p + auditoria reducida (security/architecture/performance), no solo guard+tsc — el plan ya las contempla en Fase 4. Sin BLOQUEANTES. Las 4 observaciones no impiden implementar; el ratchet (#1/#2) lo refuerza el propio merge skill aunque el plan no lo agende.

**Listo para pasar a implementacion:** Si, con observaciones.
