# Guard: Dark mode invariants (#307)

Regression guard para preservar las invariantes de dark mode introducidas
por el issue #307 (VerificationBadge gold adaptativo + eliminacion de hex
hardcoded en HomeScreen y mapa + shadow mode-aware del FAB). Cada vez que
se agregue un componente que use colores custom, el auditor debe verificar
estas reglas antes de aprobar el merge.

## Contexto

Antes de #307 habia 18 puntos activos de drift de dark mode (7 criticos)
en componentes nuevos introducidos tras la auditoria #246: hex literales
en `sx` fuera de `theme/`/`constants/`, tints blancos fijos
(`rgba(255,255,255,0.X)`) sobre fondos que cambian entre modos, y un
`MuiFab` shadow que no distinguia light/dark. El fix canonico es usar
`alpha(theme.palette.*, ...)` sobre tokens del tema, `useTheme()` para
branchear por `theme.palette.mode`, y los helpers WCAG de
`src/utils/contrast.ts` (`getContrastRatio`, `meetsWCAG_AA`) para decidir
color de foreground sobre un background conocido.

## Reglas

1. **Sin hex en `sx`.** No deben existir literales hex / `rgb(...)` /
   `rgba(...)` en las props `color:` o `bgcolor:` de objetos `sx` fuera
   de `src/theme/`, `src/constants/` y
   `src/components/lists/ColorPicker.tsx` (user palette, documentada como
   excepcion). El valor correcto es un token (`text.primary`,
   `background.paper`, `divider`) o `alpha(theme.palette.X, n)`.
2. **Tints semi-transparentes mode-aware.** Cualquier tint colocado sobre
   un background del tema (badges, overlays, highlights) debe usar
   `alpha(color, theme.palette.mode === 'dark' ? darkValue : lightValue)`
   con opacidades distintas por modo — nunca un alpha fijo. Canonical:
   `VerificationBadge` duplica la opacidad del gold de 0.08 (light) a
   0.16 (dark) para mantenerse visible sobre `#121212`.
3. **Paletas de constantes como tuplas `[light, dark]`.** Constantes en
   `src/constants/` que definen paletas visuales que deben cambiar entre
   modos deben exportar tuplas `[light, dark]` y el componente elige el
   indice segun `theme.palette.mode`. Referencia canonica:
   `src/components/social/UserScoreCard.tsx:22-27` (`BAR_COLOR_PAIRS`).
   Paletas semanticas que no dependen del modo (ej: `CATEGORY_COLORS`,
   `QUICK_ACTION_COLORS`) pueden seguir siendo `Record<string, string>`
   siempre y cuando el foreground se calcule con `getContrastText`.
4. **`MuiFab` shadow mode-aware.** El override de `MuiFab` en
   `src/theme/index.ts` debe branchear por `isLight` (espejo del patron
   de `MuiPaper`). Shadow mas intensa en dark (`rgba(0,0,0,0.6)`) que en
   light (`rgba(0,0,0,0.3)`) para preservar percepcion de elevacion sobre
   `background.default` oscuro.
5. **Contraste via `utils/contrast.ts`.** Toda decision de color de
   foreground sobre un background conocido debe usar los helpers de
   `src/utils/contrast.ts` (`getContrastText`, `getContrastRatio`,
   `meetsWCAG_AA`). Prohibido asumir `rgba(255,255,255,alpha)` o
   `color: 'common.white'` sobre paletas de categoria / acciones, porque
   pueden fallar WCAG para colores claros (ej: amber, yellow).

## Patrones de deteccion

Comandos que el auditor ejecuta para verificar el estado actual:

```bash
# Regla 1: hex literales en sx.color / sx.bgcolor / sx.backgroundColor
# fuera de theme/, constants/ y ColorPicker. Output esperado: vacio.
grep -rEn "(color|bgcolor|backgroundColor): *['\"\`]#[0-9a-fA-F]" \
  src/components/ --include="*.tsx" \
  | grep -v ColorPicker \
  | grep -v test
```

```bash
# Regla 2: tints blancos fijos (rgba(255,...)). Cualquier match debe
# convertirse en alpha(theme.palette.common.white, X) o alpha() sobre
# un token de fondo. Output esperado: vacio (o justificado).
grep -rn "rgba(255" src/components/ --include="*.tsx"
```

```bash
# Regla 4: el override de MuiFab debe branchear por mode === 'dark'
# (o por la variable isLight de getDesignTokens). Output esperado:
# lineas que incluyan 'isLight' o "mode === 'dark'" cerca del MuiFab.
grep -n "MuiFab" src/theme/index.ts
```

Si alguna de las invariantes falla, el auditor debe reportar
**DARK MODE REGRESSION** con archivo:linea y abrir un follow-up.

## Relacionados

- PRD: [`docs/feat/ux/307-dark-mode-verification-badge/prd.md`](../../feat/ux/307-dark-mode-verification-badge/prd.md)
- Specs: [`docs/feat/ux/307-dark-mode-verification-badge/specs.md`](../../feat/ux/307-dark-mode-verification-badge/specs.md)
- Auditor: [`.claude/agents/dark-mode-auditor.md`](../../../.claude/agents/dark-mode-auditor.md)
- Helpers: `src/utils/contrast.ts` (`relativeLuminance`,
  `getContrastText`, `getContrastRatio`, `meetsWCAG_AA`)
- Referencia canonica de tuplas `[light, dark]`:
  `src/components/social/UserScoreCard.tsx:22-27`
- Issue antecesor con mismo patron: #246
