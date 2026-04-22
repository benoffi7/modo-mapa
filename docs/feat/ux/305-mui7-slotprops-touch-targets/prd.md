# PRD: Tech debt ui-ux — MUI 7 slotProps migration + touch targets + 360px overflow

**Feature:** 305-mui7-slotprops-touch-targets
**Categoria:** ux
**Fecha:** 2026-04-18
**Issue:** #305
**Prioridad:** Media (tech debt surfaced by `/health-check`)

---

## Contexto

El `/health-check` ui-reviewer del 2026-04-18 sobre `new-home` detectó 4 issues High, 4 Medium y varios Low en la capa UI. La mayoría son drift acumulado tras la migración a MUI 7 (APIs deprecated), más algunos anti-patrones de accesibilidad WCAG 2.5.5 (touch targets < 44x44px) y fragilidad de layout en mobile 360px. El proyecto ya adoptó `slotProps` en algunos componentes (ej: `CommentRow.tsx:162`), por lo que existe patrón de referencia.

## Problema

- **MUI 7 deprecations**: 11+ componentes usan `primaryTypographyProps`/`secondaryTypographyProps` deprecated — warnings en consola y riesgo de breakage en futuras minor versions de MUI.
- **Accesibilidad WCAG 2.5.5**: 4 ubicaciones con touch targets < 44x44px (botones de texto con `p: 0`, IconButtons `size="small"` sin padding compensatorio). Falla auditorías a11y.
- **Fragilidad en mobile 360px**: `BusinessHeader` con 4 icon buttons + `h6` sin `noWrap` overflowea; `SearchScreen` superpone `ViewToggle` sobre chips; `StatsCards` trunca silenciosamente.
- **Layout selector fragility**: `TabBar.tsx` usa `.Mui-selected .MuiBox-root` que puede romper con upgrades de MUI internals.
- **setState en render**: `BusinessSheetContent:69-81` llama `setActiveTab` durante render (eslint-disabled) — React 18 strict mode duplica invocaciones.
- **Estilo inconsistente**: chips pelean especificidad de `height` contra `size="small"`, divisores dangling cuando secciones retornan `null`, variant `h5` usado como landmark H1/H2 en Home.

## Solucion

### S1 — Migración MUI 7 slotProps (High #2)

Reemplazar `primaryTypographyProps` y `secondaryTypographyProps` por `slotProps={{ primary: {...}, secondary: {...} }}` en los 11 archivos detectados. El patrón ya está correcto en `src/components/business/CommentRow.tsx:162` (usa `slotProps={{ secondary: { component: 'span', display: 'block' } }}`). Replicar idéntico.

### S2 — Touch targets WCAG 2.5.5 (High #3)

Para cada `IconButton`/`Button` con `p: 0`, `p: 0.25` o `size="small"` sin padding compensatorio, agregar `minWidth: 44, minHeight: 44` al sx (o usar un wrapper Box con padding expansivo). Ubicaciones identificadas por el health-check:

- `TrendingNearYouSection.tsx:93-100,107` — botón "Configurá tu localidad" con `p: 0` y `IconButton` de cierre. Ya corregido el IconButton (`minWidth: 44, minHeight: 44`), falta el Button de texto.
- `RecentSearches.tsx:21-28` — botón "Borrar" ~16px tall con `p: 0`.
- `ActivityDigestSection.tsx:113-123` — botón "Ver todas" con `p: 0`.
- `CommentRow.tsx:174,234,243` — IconButtons `size="small"` sin padding. Ajustar a `size="medium"` o agregar padding explícito.

### S3 — Propio `isFavorite` state (High #1)

`FavoriteButton.tsx:21-35` usa `memo` con derived state pattern (`prevIsFavorite` + `optimistic`). El patrón funciona pero es frágil (setState during render). Refactor: usar `useEffect` para sincronizar `prevIsFavorite` con props cuando cambia, o eliminar el patrón derived si el parent (`BusinessSheetContent`) ya maneja optimistic. Evaluar si el `memo` sigue siendo necesario dado que el parent ya pasa props estables vía `useBusinessData`.

### S4 — TabBar FAB layout stability (High #4)

`TabBar.tsx:82-89` usa selector CSS `.Mui-selected .MuiBox-root` que depende del markup interno de MUI. Cambiar a `className` custom o usar `classes` prop de `BottomNavigationAction`. Alternativa: extraer el FAB a un componente separado con state controlado (hover/active via useState o componente dedicado).

### S5 — setState during render fix (Medium #8)

`BusinessSheetContent.tsx:69-81` tiene dos patrones de setState in render con eslint-disable. Opciones:

1. Mover a `useEffect([initialTab, businessId])` (cambio visual: primer render muestra tab anterior, re-render con tab correcto).
2. Usar `useState` lazy initializer y `useMemo` para computar activeTab deriva de inputs.
3. Aceptar patrón actual pero documentar con comentario en el componente.

Preferencia: opción 1 (más correcto, el visual flash es mínimo dado que el sheet tiene skeleton loader).

### S6 — Empty state consistency (Medium #5)

Unificar fallbacks de secciones en Home: `ForYouSection.tsx:37`, `TrendingNearYouSection.tsx:69`, `RecentSearches.tsx:13` retornan `null` lo que causa que `homeSections.ts:22-26` renderice dividers huérfanos. Soluciones:

1. Ajustar `homeSections.ts` para detectar secciones vacías y omitir el divider siguiente (requiere API para que cada sección reporte "vacía").
2. Secciones vacías renderizan `<Box sx={{ display: 'none' }} data-empty />` y el registry filtra.
3. Opción más simple: cada sección que pueda ser vacía renderiza un placeholder mínimo con la misma altura del divider (no recomendado).

Preferencia: opción 1 — agregar `hideDividerWhenEmpty?: boolean` en interface + `useEmptyState(id, isEmpty)` context que las secciones reportan al mount/unmount. Alternativa simpler: cada sección retorna `<></>` (Fragment) en lugar de `null` y el parent usa `React.Children.toArray().filter(Boolean)`.

También uniformar loading: spinner vs Skeleton. Estandarizar en Skeleton para secciones con layout conocido (TrendingNearYouSection usa spinner, ActivityDigestSection usa Skeleton — preferir Skeleton consistente).

### S7 — 360px overflow fixes (Medium #6)

- `BusinessHeader.tsx:21-48`: agregar `noWrap` + `sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}` al `Typography variant="h6"` del nombre. Los 4 icon buttons (~160px) + nombre sin wrap causan overflow en 360px.
- `SearchScreen.tsx:73-80`: el `ViewToggle` está absolute-positioned sobre los chips. Reorganizar: mover el toggle a un row separado debajo de los chips, o usar flex justify-space-between para que chips y toggle compartan el mismo row.
- `StatsCards.tsx`: el silent truncation en `:46` — agregar `noWrap` o usar tooltip para valores largos.

### S8 — Chip height consistency (Medium #7)

Chips con `size="small"` y `sx={{ height: XX }}` pelean especificidad. Según memory `feedback_mui_chip_padding.md`, cambiar el `size` prop en lugar de forzar height. Ubicaciones:

- `BusinessHeader.tsx:30,38` — `height: 24` + `size="small"`.
- `TrendingBusinessCard.tsx:67` — `height: 24` + `size="small"`.
- `SearchListView.tsx:35` — `height: 20` + `size="small"`.
- `AddToListDialog.tsx:168` — `height: 18` + `size="small"`.

Solución: crear constante `CHIP_SMALL_SX` en `src/theme/cards.ts` o usar theme override para ajustar el default de `size="small"` a la altura deseada. Alternativa: dejar height pero unificar en un valor único (ej: 24px) y eliminar overrides de `height: 18/20`.

### S9 — Low priority polish

- `GreetingHeader.tsx:22`: cambiar `variant="h5"` a `variant="h1"` o `component="h1" variant="h5"` para landmark semántico.
- `ProfileScreen.tsx:72`: agregar `component="header"` al Toolbar.
- `LocationFAB.tsx:15-17`, `OfficeFAB.tsx:22-24`: reemplazar raw px por `theme.spacing()` y sincronizar `bottom` con `TAB_BAR_HEIGHT + spacing(3)`.
- `FollowTagChip.tsx:21`: cambiar `borderRadius: 1` (8px) a `2` (16px) según convention del proyecto.
- `BusinessSheet.tsx` drag handle: agregar `onKeyDown` para Enter/Space (keyboard accessibility).
- Usos de `fontSize: 0.75rem` hardcodeado: reemplazar por `variant="caption"` (muchas ubicaciones, TBD audit).

### UX flow

Todos los cambios son de corrección — no hay nuevos flujos de usuario. El impacto visible:

1. **Touch targets más grandes**: botones de texto en Home ("Borrar", "Ver todas", "Configurá tu localidad") pasan de ~16-20px alto a 44px alto. Puede ajustar espaciado entre elementos.
2. **Typography dentro de ListItemText sin warnings**: comportamiento visual idéntico, sólo remueve deprecations.
3. **BusinessHeader con nombres largos**: se truncan con ellipsis en lugar de overflowear.
4. **Home sin dividers huérfanos**: secciones vacías no muestran líneas separadoras (mejor estética).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: Migración slotProps (11 archivos) | Alta | S |
| S2: Touch targets WCAG (4 archivos) | Alta | S |
| S3: FavoriteButton derived state refactor | Alta | S |
| S4: TabBar FAB selector stability | Alta | S |
| S5: setState during render fix | Media | S |
| S6: Empty state + divider fix | Media | M |
| S7: 360px overflow fixes | Media | S |
| S8: Chip height unification | Media | S |
| S9: Low priority polish (opcional) | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Redesign completo de HomeScreen (solo fixes).
- Cambios en la paleta de colores o design tokens.
- Migración de otras deprecations de MUI 7 no listadas en el health-check.
- Nuevos componentes o features.
- Refactor de BusinessSheet a desktop-ready (ya cubierto por Shell/Content pattern).
- Cambios en theme playground o constants dashboard.

---

## Tests

Según `docs/reference/tests.md`, solo `FavoriteButton` requiere tests nuevos (lógica de estado). El resto son cambios visuales que se validan manualmente + no rompen tests existentes.

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/business/FavoriteButton.test.tsx` (nuevo o ampliado) | Component | Optimistic state sync cuando `isFavorite` prop cambia, memo behavior, toggle con error rollback |

### Criterios de testing

- Cobertura >= 80% del código nuevo/modificado (FavoriteButton).
- Tests existentes no rompen (CommentRow, EditorsDialog, etc).
- `npm run test:run` pasa en CI sin warnings nuevos.
- `npm run build` no genera warnings MUI 7 deprecation en stdout.
- Visual regression manual en mobile 360px (Chrome DevTools device mode).

---

## Seguridad

No aplica — cambios de UI puros sin escrituras a Firestore, sin nuevos endpoints, sin inputs de usuario.

### Vectores de ataque automatizado

No aplica.

### Checklist mínimo

- [ ] Sin nuevos imports de `firebase/*` en componentes modificados.
- [ ] Sin nuevos strings user-facing sin tildes (audit manual).

---

## Deuda tecnica y seguridad

**Issues consultados:**

```bash
gh issue list --label security --state open --json number,title  # vacío
gh issue list --label "tech debt" --state open --json number,title  # vacío
```

Los issues abiertos relevantes (todos etiquetados `enhancement`) son otros health-check outputs: #300-#311.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #306 (architecture: prop-drilling + sabanas + console.error) | Separado pero complementario — no solapa archivos directamente | Coordinar merge order para evitar conflictos en HomeScreen |
| #307 (dark-mode: VerificationBadge gold + hardcoded hex) | Separado — no solapa con este feature | Independiente |
| #309 (copy: tildes + voseo) | Independiente | Independiente |
| #290 (ya cerrado) accessibility touch-targets | Este feature extiende el trabajo de #290 con las ubicaciones restantes | Referenciar commit de #290 como patrón |

### Mitigacion incorporada

- Al actualizar `BusinessSheetContent` (S5), aprovechar para documentar el pattern `useRef` para tracking de business changes en `docs/reference/patterns.md`.
- Al unificar chip heights (S8), documentar la constante `CHIP_SMALL_SX` en design-system.md.
- El fix de `setState during render` elimina 2 eslint-disable, mejorando la señal del linter.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] FavoriteButton: `toggleFavorite` ya tiene try/catch con toast error y rollback de optimistic — mantener.
- [ ] No hay `setState` después de operaciones async sin guard de unmount — el componente está memoizado y no tiene cleanup necesario más allá de resetear optimistic on prop change.
- [ ] No se crean nuevas funciones exportadas no usadas.
- [ ] Archivos modificados no superan 300 lineas (warn) ni 400 lineas (blocker) — ninguno de los archivos está cerca.
- [ ] `logger.error` se mantiene fuera de condicionales DEV en `FavoriteButton`.

### Checklist de observabilidad

- [ ] No se agregan triggers Cloud Function — N/A.
- [ ] No se agregan services con queries Firestore — N/A.
- [ ] No se agregan `trackEvent` nuevos — los existentes se mantienen.

### Checklist offline

- [ ] FavoriteButton ya usa `withOfflineSupport` — mantener sin tocar.
- [ ] No se agregan formularios nuevos.
- [ ] Error handlers mantienen `toast.error` en todos los environments.

### Checklist de documentacion

- [ ] `homeSections.ts` no cambia de estructura (solo lógica de filtrado si se opta por S6 opción 1).
- [ ] No se agregan analytics events nuevos.
- [ ] No se agregan tipos nuevos.
- [ ] `docs/reference/patterns.md` actualizar si S8 introduce `CHIP_SMALL_SX`.
- [ ] `docs/reference/features.md` NO cambia (fixes transparentes).
- [ ] `docs/reference/firestore.md` NO cambia.

---

## Offline

No aplica — cambios son puramente UI. FavoriteButton ya tiene soporte offline (`withOfflineSupport`) que se mantiene intacto.

### Data flows

| Operacion | Tipo | Estrategia offline | Fallback UI |
|-----------|------|--------------------|-------------|
| N/A | — | — | — |

### Checklist offline

- [x] Reads de Firestore: no se modifican.
- [x] Writes: FavoriteButton sigue usando `withOfflineSupport` existente.
- [x] APIs externas: no se tocan.
- [x] UI: OfflineIndicator sigue funcionando.
- [x] Datos criticos: cache de lectura inalterado.

### Esfuerzo offline adicional: S (cero)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services — no se mueve logica.
- [x] Componentes nuevos no se agregan (solo se refactoran existentes).
- [x] No se agregan useState de lógica de negocio a AppShell o SideMenu.
- [x] Props explícitas — FavoriteButton ya las tiene.
- [x] No hay noop callbacks — se mantienen handlers reales.
- [x] Sin nuevos imports de `firebase/*` en components/.
- [x] Archivos en `src/hooks/` no se tocan.
- [x] Ningún archivo supera 400 lineas.
- [x] Converters no se modifican.
- [x] Archivos modificados permanecen en su carpeta de dominio (business/, home/, search/, profile/, lists/, admin/).
- [x] No se crean nuevos contextos.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Cambios locales, sin nuevos cross-imports |
| Estado global | = | Sin nuevos contextos |
| Firebase coupling | = | Sin nuevos imports de Firebase en components |
| Organizacion por dominio | = | Archivos se mantienen en su folder |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] Todo `<IconButton>` tiene `aria-label` descriptivo — validar en los modificados.
- [x] Elementos interactivos usan semántica correcta (`<Button>`, `<IconButton>`).
- [x] Touch targets ≥ 44x44px en mobile — ESTE ES EL CORE DEL FEATURE (S2).
- [x] Componentes con carga de datos tienen error state — FavoriteButton ya lo tiene.
- [x] Imágenes con URLs dinámicas tienen `onError` fallback — no se tocan.
- [x] Formularios tienen labels visibles — AddToListDialog ya los tiene.
- [x] GreetingHeader usa `component="h1"` para landmark semántico (S9).
- [x] ProfileScreen Toolbar usa `component="header"` (S9).

### Checklist de copy

- [x] Todos los textos existentes se mantienen con tildes correctas.
- [x] Tono voseo consistente ("Configurá", "Buscá") — se mantiene.
- [x] Terminología "comercios" — se mantiene.
- [x] No se agregan strings nuevos reutilizables — N/A.
- [x] Mensajes de error existentes siguen siendo accionables.

---

## Success Criteria

1. `npm run build` no emite warnings de MUI 7 `primaryTypographyProps`/`secondaryTypographyProps` deprecation.
2. Lighthouse Accessibility score en HomeScreen + BusinessSheet en mobile 360px >= 95 (target gates que fallaban: touch targets).
3. Visual regression manual en Chrome DevTools mobile 360px: HomeScreen no muestra dividers huérfanos, BusinessHeader trunca nombres largos sin overflow, ViewToggle no se superpone a chips.
4. `FavoriteButton` sigue funcionando correctamente: optimistic state se limpia cuando prop `isFavorite` cambia; toast de error + rollback en caso de fallo de red.
5. Cero eslint-disable nuevos; idealmente los 2 existentes en `BusinessSheetContent.tsx:69-81` se eliminan (S5).
