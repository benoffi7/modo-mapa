# Plan: Dark mode — VerificationBadge + HomeScreen + mapa

**Issue:** #307
**PRD:** [prd.md](prd.md)
**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-18

---

## Estrategia

Feature puramente visual con tests unitarios para la util `contrast.ts`. Un solo PR (no worktree, tamano S/M, cambios acoplados por el uso compartido de `contrast.ts`). Base branch: `new-home`.

Los pasos se agrupan en 3 fases logicas:

1. **Fundaciones**: extender `contrast.ts` + tests + promover constants.
2. **Componentes**: aplicar tokens del tema en los 7 puntos detectados.
3. **Docs + verificacion**: actualizar referencias + smoke test manual en dark y light.

---

## Pasos

### Fase 1 — Fundaciones

#### Paso 1.1 — Extender `src/utils/contrast.ts`

Agregar `getContrastRatio` y `meetsWCAG_AA` siguiendo el spec. Mantener `relativeLuminance` y `getContrastText` sin tocar.

Verificacion:

```bash
npx tsc --noEmit
```

#### Paso 1.2 — Agregar tests a `src/utils/contrast.test.ts`

Casos canonicos: white/black = 21, black/black = 1, gold/black ≈ 13.87, gold/white ≈ 1.51. Tests para `meetsWCAG_AA` con `isLargeText` true/false.

Verificacion:

```bash
npx vitest run src/utils/contrast.test.ts
```

Esperado: los 15+ tests (originales + nuevos) pasan, cobertura 100% en `contrast.ts`.

#### Paso 1.3 — Agregar `QUICK_ACTION_COLORS` a `src/constants/business.ts`

Copiar el objeto desde `QuickActions.tsx` con comentario explicando que son brand colors (no mode-aware) usados con `getContrastText` para el icono.

Verificacion:

```bash
npx eslint src/constants/business.ts
```

### Fase 2 — Componentes

#### Paso 2.1 — VerificationBadge: gold adaptativo

Modificar `src/components/social/VerificationBadge.tsx`:

- Eliminar `GOLD_BG` constante modulo.
- Importar `alpha` y `useTheme`.
- Dentro del componente: computar `goldBg = alpha(GOLD_HEX, isDark ? 0.16 : 0.08)`.
- Renombrar `GOLD_BORDER` → `GOLD_HEX` (mas descriptivo del uso multiple).
- Reemplazar `GOLD_BORDER` por `GOLD_HEX` en los 3 call-sites (bordercolor, bgcolor, LinearProgress bar).

Verificacion:

```bash
npx tsc --noEmit
npx eslint src/components/social/VerificationBadge.tsx
```

#### Paso 2.2 — ForYouSection: iconos con `getContrastText` + fallback tematizado

Modificar `src/components/home/ForYouSection.tsx`:

- Importar `getContrastText` de `../../utils/contrast` y `useTheme` de `@mui/material/styles`.
- Reemplazar `CATEGORY_ICONS` (const record) por funcion `getCategoryIcon(category, bgHex)`.
- Agregar `const theme = useTheme()` en el componente.
- Reemplazar `'#546e7a'` (L47) por `theme.palette.grey[600]`.
- Usar `getCategoryIcon(cat, bgColor)` en el map.

Verificacion:

```bash
npx tsc --noEmit
npx eslint src/components/home/ForYouSection.tsx
```

#### Paso 2.3 — QuickActions: iconos adaptativos + import de constants

Modificar `src/components/home/QuickActions.tsx`:

- Eliminar const local `QUICK_ACTION_COLORS` (L56-61).
- Importar `QUICK_ACTION_COLORS` de `'../../constants/business'`.
- Importar `getContrastText` de `'../../utils/contrast'`.
- Dentro del map de slots: `const slotColor = getSlotColor(slot); const iconColor = getContrastText(slotColor);`.
- Reemplazar `color: 'common.white'` por `color: iconColor` en los 2 call-sites (L165, L194).

Verificacion:

```bash
npx tsc --noEmit
npx eslint src/components/home/QuickActions.tsx
```

#### Paso 2.4 — BusinessMarker: border/glyph con `background.paper`

Modificar `src/components/map/BusinessMarker.tsx`:

- Importar `useTheme` de `@mui/material/styles`.
- Dentro del memo: `const theme = useTheme(); const contrastColor = theme.palette.background.paper;`.
- Reemplazar `borderColor={isSelected ? '#fff' : color}` por `borderColor={isSelected ? contrastColor : color}`.
- Reemplazar `glyphColor="#fff"` por `glyphColor={contrastColor}`.

Verificacion:

```bash
npx tsc --noEmit
npx eslint src/components/map/BusinessMarker.tsx
```

#### Paso 2.5 — MapView: overlay con `alpha()`

Modificar `src/components/map/MapView.tsx`:

- Importar `alpha` de `@mui/material/styles`.
- Reemplazar L131 inline rgba por `alpha(theme.palette.background.paper, 0.95)`.

Verificacion:

```bash
npx tsc --noEmit
npx eslint src/components/map/MapView.tsx
```

#### Paso 2.6 — MuiFab shadow mode-aware

Modificar `src/theme/index.ts` — ajustar `MuiFab.styleOverrides.root` para usar `isLight` ternario (patron identico a `MuiPaper`).

Verificacion:

```bash
npx tsc --noEmit
npx eslint src/theme/index.ts
```

### Fase 3 — Docs + smoke test

#### Paso 3.1 — Actualizar `docs/reference/patterns.md`

Agregar row en la seccion "Dark mode": patron de `alpha(HEX, mode === 'dark' ? X : Y)` para brand colors adaptativos.

#### Paso 3.2 — Actualizar `docs/reference/design-system.md`

Agregar seccion "Contrast helpers (`utils/contrast.ts`)" con las 4 funciones exportadas y ejemplo de uso.

#### Paso 3.3 — Smoke test visual

Ejecutar `npm run dev:full`. En el navegador:

1. **Light mode**: abrir HomeScreen → verificar QuickActions, ForYouSection legibles. Abrir tab Perfil → click en avatar de usuario con badges → verificar VerificationBadges en `UserProfileSheet`. Abrir tab Buscar → seleccionar un marker → verificar border/glyph visibles. Buscar "xxxxx" para disparar overlay "No se encontraron comercios" → legible.
2. **Dark mode**: toggle en Settings > Apariencia. Repetir los mismos flujos.
3. **Criterio**: en ambos modos, VerificationBadge "earned" es visualmente distinto de "not earned" (fondo dorado perceptible). Iconos visibles sobre todos los colores de categoria/accion. FABs del mapa con sombra visible en dark.

### Fase 4 — Validacion automatizada

#### Paso 4.1 — Lint completo

```bash
npm run lint
```

Esperado: 0 errores, 0 warnings nuevos.

#### Paso 4.2 — Type check completo

```bash
npm run typecheck
```

#### Paso 4.3 — Tests completos

```bash
npm run test:run
```

Esperado: todos los tests pasan (215+ existentes + nuevos casos en `contrast.test.ts`).

#### Paso 4.4 — Coverage check

```bash
npm run test:coverage
```

Esperado: global >= 80% (enforced por CI). `contrast.ts` debe estar al 100%.

#### Paso 4.5 — Pre-staging gate

```bash
./scripts/pre-staging-check.sh
```

Verifica: sin `.catch(() => {})`, sin `logger.error` dentro de `if (DEV)`, etc.

### Fase 5 — Commit + PR

#### Paso 5.1 — Commit unico

```bash
git add \
  src/utils/contrast.ts \
  src/utils/contrast.test.ts \
  src/constants/business.ts \
  src/components/social/VerificationBadge.tsx \
  src/components/home/ForYouSection.tsx \
  src/components/home/QuickActions.tsx \
  src/components/map/BusinessMarker.tsx \
  src/components/map/MapView.tsx \
  src/theme/index.ts \
  docs/reference/patterns.md \
  docs/reference/design-system.md \
  docs/feat/ux/307-dark-mode-verification-badge/ \
  docs/_sidebar.md

git commit -m "$(cat <<'EOF'
feat(#307): dark mode — VerificationBadge gold + hex en home y mapa

Elimina 7 puntos de hex hardcoded y rgba() fijos detectados por
dark-mode-auditor. Completa utils/contrast.ts con getContrastRatio
y meetsWCAG_AA. VerificationBadge ahora usa alpha() con opacidad
dependiente del mode (0.08 light / 0.16 dark). ForYouSection y
QuickActions calculan color de icono con getContrastText segun el
fondo de categoria/accion. BusinessMarker y MapView overlay usan
theme.palette.background.paper en vez de #fff/rgba fijos. MuiFab
shadow ahora es mode-aware (espejo de MuiPaper).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### Paso 5.2 — Push + PR contra `new-home`

```bash
git push -u origin HEAD
gh pr create --base new-home --title "feat(#307): dark mode — VerificationBadge + home + mapa" --body "$(cat <<'EOF'
## Summary
- VerificationBadge gold invisible en dark: `alpha()` con opacidad adaptativa (0.08 → 0.16)
- ForYouSection + QuickActions: iconos con `getContrastText` sobre fondo de categoria/accion
- BusinessMarker + MapView: tokens del tema (`background.paper`) en vez de `#fff`/rgba fijos
- MuiFab shadow mode-aware (mirrors MuiPaper)
- `utils/contrast.ts` completo: `getContrastRatio` + `meetsWCAG_AA`

Closes #307

## Test plan
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa sin warnings nuevos
- [ ] `npm run test:coverage` global >= 80%, `contrast.ts` al 100%
- [ ] Smoke visual light mode: HomeScreen, perfil con badges, marker seleccionado, overlay "sin resultados"
- [ ] Smoke visual dark mode: mismos flujos, VerificationBadge "earned" perceptible
- [ ] FAB shadow visible en dark

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Checklist final

- [ ] Paso 1.1 — `contrast.ts` extendido
- [ ] Paso 1.2 — `contrast.test.ts` con tests nuevos pasando
- [ ] Paso 1.3 — `QUICK_ACTION_COLORS` en `constants/business.ts`
- [ ] Paso 2.1 — VerificationBadge con gold adaptativo
- [ ] Paso 2.2 — ForYouSection con iconos adaptativos
- [ ] Paso 2.3 — QuickActions importa de constants + iconos adaptativos
- [ ] Paso 2.4 — BusinessMarker con `background.paper`
- [ ] Paso 2.5 — MapView con `alpha()`
- [ ] Paso 2.6 — MuiFab mode-aware
- [ ] Paso 3.1 — `patterns.md` documenta patron
- [ ] Paso 3.2 — `design-system.md` agrega contrast helpers
- [ ] Paso 3.3 — Smoke test visual en light + dark
- [ ] Paso 4.1-4.5 — Validaciones automatizadas
- [ ] Paso 5.1 — Commit unico
- [ ] Paso 5.2 — PR contra `new-home`

---

## Rollback

Si surge regresion:

1. Revert del commit via `git revert <sha>`.
2. `contrast.ts` conserva sus funciones originales intactas, no hay breaking changes.
3. Tests existentes (los 11 de `contrast.test.ts`) siguen pasando tras revert.

## Deployment notes

- No hay cambios en Firestore rules.
- No hay cambios en Cloud Functions.
- No hay nuevos analytics events.
- No hay nuevas dependencias npm.
- Cambio 100% frontend, visible al siguiente deploy.
