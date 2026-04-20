# Guard: UI/UX invariants (#305)

Regresiones bloqueadas tras el fix del tech debt UI/UX auditado en el `/health-check` del 2026-04-18. Este guard condensa las invariantes que deben mantenerse vivas — cualquier violacion en PRs futuros se considera regresion.

**PRD origen:** [docs/feat/ux/305-mui7-slotprops-touch-targets/prd.md](../../feat/ux/305-mui7-slotprops-touch-targets/prd.md)
**Specs:** [docs/feat/ux/305-mui7-slotprops-touch-targets/specs.md](../../feat/ux/305-mui7-slotprops-touch-targets/specs.md)
**Issue:** #305

---

## Reglas

1. **MUI 7 slotProps (no legacy typography props).** Nunca uses `primaryTypographyProps` ni `secondaryTypographyProps` en `ListItemText`. Migrar a `slotProps={{ primary: {...}, secondary: {...} }}`. Referencia canonica: `src/components/business/CommentRow.tsx` (uso de `slotProps={{ secondary: { component: 'span', display: 'block' } }}`). Para props simples (`fontSize`, `fontWeight`) anidar en `sx` dentro del slot.

2. **Touch targets WCAG 2.5.5 — minimo 44x44px.** Todo elemento interactivo (`Button variant="text"`, `IconButton`, chips clicables) tiene que alcanzar 44x44px. `p: 0` o `p: 0.25` en botones de UI mobile es bug. Patrones aceptados:
    - `IconButton` sin `size="small"` (default = 48px).
    - `IconButton size="small"` + `sx={{ minWidth: 44, minHeight: 44 }}` si se usa icono chico por motivos visuales.
    - `Button variant="text" sx={{ minWidth: 44, minHeight: 44 }}`.

3. **TabBar center FAB es un componente dedicado y nombrado.** No usar selectores tipo `.Mui-selected .MuiBox-root` para aplicar estilos al FAB central del `TabBar`. El FAB debe ser un componente nombrado (ej: `SearchFab`) que lee el estado activo via hook/context y aplica sus propios estilos. Depender del markup interno de MUI es fragil frente a upgrades.

4. **No `setState` durante render.** Cualquier mutacion de estado durante render es prohibida. Usar `useEffect` con deps explicitas. **No se permiten `// eslint-disable-next-line react-hooks/rules-of-hooks`** ni `react-hooks/exhaustive-deps` para tapar setState in render. Si el efecto produce un flash visual, usar skeleton/suspense boundary para taparlo.

5. **Chip overrides via `size` prop, no via `sx` height.** MUI `Chip` con `size="small"` tiene altura propia; pelear especificidad con `sx={{ height: 20 }}` genera bugs de padding (ver memory `feedback_mui_chip_padding.md`). Usar la constante canonica `CHIP_SMALL_SX` de `src/theme/cards.ts` o ajustar `size` + theme override. Valores ad-hoc de `height: 18/20/22/24` en chips estan prohibidos.

6. **360px overflow — fixed-width children deben respetar el contenedor.** Componentes con multiples hijos de ancho fijo (ej: `BusinessHeader` con 4 icon buttons + titulo) tienen que dimensionarse para 360px de viewport minimo:
    - `Typography` al lado de iconos/botones necesita `noWrap` + `overflow: 'hidden'` + `textOverflow: 'ellipsis'`.
    - `ViewToggle` y similares no deben usar `position: absolute` sobre chips scrollables — usar flex row con `gap`.
    - Valores numericos en `StatsCards` y similares truncan con `noWrap` o tooltip, nunca silenciosamente.

---

## Patrones de deteccion

Corridas rapidas para validar que el guard se cumple. Si alguna devuelve matches sin justificacion documentada en el PR, es regresion.

### Regla 1 — slotProps

```bash
grep -rn "primaryTypographyProps\|secondaryTypographyProps" src/ --include="*.tsx"
```

Debe retornar **vacio** post-#305. Cualquier match nuevo bloquea merge.

### Regla 2 — Touch targets

```bash
grep -rn "p: 0" src/components/ --include="*.tsx"
```

Revision manual requerida: cada match tiene que estar en contenedor no-interactivo (Box, Paper decorativo). Si el elemento es `Button`/`IconButton`/clickable row, falla.

```bash
grep -rn "size=\"small\"" src/components/ --include="*.tsx" | grep -i "iconbutton\|button"
```

Cada `size="small"` en boton interactivo tiene que tener `minWidth: 44, minHeight: 44` en su `sx` o un wrapper con padding compensatorio.

### Regla 3 — TabBar FAB selector

```bash
grep -rn "\.Mui-selected .MuiBox-root\|& .MuiBox-root" src/components/layout/ --include="*.tsx"
```

Debe retornar **vacio**. TabBar usa componente dedicado.

### Regla 4 — setState in render / eslint-disable

```bash
grep -rn "eslint-disable.*react-hooks" src/components/
```

Flag cada ocurrencia. Revisar PR asociado y justificar por que no se puede mover a `useEffect`. Preferencia fuerte: 0 ocurrencias.

### Regla 5 — Chip height ad-hoc

```bash
grep -rn "height: 2[0-4]" src/components/ --include="*.tsx" | grep -i chip
```

```bash
grep -rn "height: 1[8-9]" src/components/ --include="*.tsx" | grep -i chip
```

Debe retornar **vacio**. Usar `CHIP_SMALL_SX` desde `src/theme/cards.ts`.

### Regla 6 — 360px overflow

Revision manual en Chrome DevTools mobile 360x640:

- `HomeScreen` scroll sin cortes horizontales.
- `BusinessHeader` con nombre largo trunca con ellipsis.
- `SearchScreen` chips + `ViewToggle` no se superponen.
- `StatsCards` valores largos truncan con `noWrap`.

Grep auxiliar para typography sin `noWrap` cerca de iconos:

```bash
grep -rn "variant=\"h6\"" src/components/business/ --include="*.tsx"
```

Cada match validar que tiene `noWrap` si comparte row con icon buttons.

---

## Relacionado

- PRD: [docs/feat/ux/305-mui7-slotprops-touch-targets/prd.md](../../feat/ux/305-mui7-slotprops-touch-targets/prd.md)
- Specs: [docs/feat/ux/305-mui7-slotprops-touch-targets/specs.md](../../feat/ux/305-mui7-slotprops-touch-targets/specs.md)
- Plan: [docs/feat/ux/305-mui7-slotprops-touch-targets/plan.md](../../feat/ux/305-mui7-slotprops-touch-targets/plan.md)
- Memory: `feedback_mui_chip_padding.md`
- Issue anterior relacionado: #290 (accessibility touch-targets — este feature extiende el trabajo).
- Design system: `src/theme/cards.ts` (constante `CHIP_SMALL_SX`).
- Reviewer agent: [.claude/agents/ui-reviewer.md](../../../.claude/agents/ui-reviewer.md) (seccion `Regression checks (#305)`).
