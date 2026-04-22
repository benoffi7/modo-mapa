# Specs: Dark mode — VerificationBadge + HomeScreen + mapa

**Issue:** #307
**PRD:** [prd.md](prd.md)
**Plan:** [plan.md](plan.md)
**Fecha:** 2026-04-18

---

## Resumen tecnico

Convertir 7 puntos de hex hardcoded y `rgba()` fijos a tokens del tema MUI 7 usando `alpha()` + `theme.palette.mode` + `useTheme()`. Completar `src/utils/contrast.ts` con helpers WCAG AA usados por los nuevos call-sites y por los tests.

Archivos tocados: 8 source + 1 test + 2 docs.

| # | Archivo | Tipo de cambio | Lineas afectadas |
|---|---------|----------------|------------------|
| 1 | `src/utils/contrast.ts` | Agregar funciones | +~20 |
| 2 | `src/utils/contrast.test.ts` | Agregar tests | +~25 |
| 3 | `src/components/social/VerificationBadge.tsx` | Modificar constantes + sx | ~10 |
| 4 | `src/components/home/ForYouSection.tsx` | Refactor iconos + fallback | ~15 |
| 5 | `src/components/home/QuickActions.tsx` | Iconos adaptativos + import de constants | ~6 |
| 6 | `src/constants/business.ts` | Exportar `QUICK_ACTION_COLORS` | +~10 |
| 7 | `src/components/map/BusinessMarker.tsx` | useTheme + border/glyph | ~6 |
| 8 | `src/components/map/MapView.tsx` | alpha() en overlay | ~2 |
| 9 | `src/theme/index.ts` | MuiFab shadow mode-aware | ~6 |
| 10 | `docs/reference/patterns.md` | Documentar patron | +~8 |
| 11 | `docs/reference/design-system.md` | Agregar contrast.ts helpers | +~10 |

---

## Detalle por archivo

### 1. `src/utils/contrast.ts`

Extender el archivo sin romper APIs existentes (`relativeLuminance`, `getContrastText`). Agregar:

```typescript
/**
 * Calcula el ratio de contraste WCAG 2.0 entre dos colores hex.
 * @see https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 * @returns Ratio entre 1.0 (identicos) y 21.0 (negro vs blanco).
 */
export function getContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Verifica si dos colores cumplen WCAG AA.
 * @param isLargeText Text >= 18pt normal o 14pt bold. Default false.
 * @returns true si ratio >= 4.5 (normal) o >= 3.0 (large/UI).
 */
export function meetsWCAG_AA(fgHex: string, bgHex: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(fgHex, bgHex);
  return ratio >= (isLargeText ? 3.0 : 4.5);
}
```

Mantener `relativeLuminance` y `getContrastText` tal como estan.

### 2. `src/utils/contrast.test.ts`

Agregar bloques de test para los nuevos helpers. Casos canonicos:

- `getContrastRatio('#ffffff', '#000000')` = 21 (maximo teorico)
- `getContrastRatio('#000000', '#000000')` = 1 (identicos)
- `getContrastRatio('#FFD700', '#000000')` ≈ 13.87
- `getContrastRatio('#FFD700', '#ffffff')` ≈ 1.51 (falla WCAG)
- `getContrastRatio('#FFD700', '#121212')` ≈ 12.3 (pasa WCAG AA como UI component)
- `meetsWCAG_AA('#ffffff', '#000000')` = true
- `meetsWCAG_AA('#FFD700', '#ffffff')` = false (ratio 1.51 < 4.5)
- `meetsWCAG_AA('#FFD700', '#ffffff', true)` = false (ratio 1.51 < 3.0)
- `meetsWCAG_AA('#1e88e5', '#ffffff')` = true (texto blanco sobre blue)

### 3. `src/components/social/VerificationBadge.tsx`

Antes (L14-17):

```typescript
const GOLD_BORDER = '#FFD700';
const GOLD_BG = 'rgba(255, 215, 0, 0.08)';
const GREY_BORDER = 'divider';
```

Despues:

```typescript
import { alpha, useTheme } from '@mui/material/styles';

const GOLD_HEX = '#FFD700'; // brand color, semantic (medalla de oro)
const GREY_BORDER = 'divider';

export default function VerificationBadge({ badge, compact = false }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const goldBg = alpha(GOLD_HEX, isDark ? 0.16 : 0.08);
  // resto del componente
}
```

Reemplazar referencias:

- L35, L51 (`borderColor: badge.earned ? GOLD_BORDER : ...`) → `GOLD_HEX`
- L36, L52 (`bgcolor: badge.earned ? GOLD_BG : ...`) → `goldBg`
- L78 (`bgcolor: badge.earned ? GOLD_BORDER : 'primary.main'`) → `GOLD_HEX` (ya es hex fijo)

No se cambia `GREY_BORDER` (usa token `'divider'` que ya es mode-aware).

### 4. `src/components/home/ForYouSection.tsx`

Refactor de `CATEGORY_ICONS` de record estatico a funcion contextual. Importar `getContrastText`:

```typescript
import { getContrastText } from '../../utils/contrast';

function getCategoryIcon(category: BusinessCategory | string, bgHex: string): React.ReactElement {
  const color = getContrastText(bgHex);
  const sx = { fontSize: 32, color };
  switch (category) {
    case 'restaurant': return <RestaurantIcon sx={sx} />;
    case 'cafe': return <LocalCafeIcon sx={sx} />;
    case 'bakery': return <BakeryDiningIcon sx={sx} />;
    case 'bar': return <SportsBarIcon sx={sx} />;
    case 'fastfood': return <FastfoodIcon sx={sx} />;
    case 'icecream': return <IcecreamIcon sx={sx} />;
    case 'pizza': return <LocalPizzaIcon sx={sx} />;
    default: return <RestaurantIcon sx={sx} />;
  }
}
```

Reemplazar L47 (`bgColor = CATEGORY_COLORS[cat] ?? '#546e7a'`) por `useTheme` + token secundario:

```typescript
import { useTheme } from '@mui/material/styles';

export default function ForYouSection() {
  const theme = useTheme();
  const fallbackBg = theme.palette.grey[600];
  // ...
  const bgColor = CATEGORY_COLORS[cat] ?? fallbackBg;
  const icon = getCategoryIcon(cat, bgColor);
}
```

### 5. `src/constants/business.ts`

Agregar nueva constante con referencia de brand. Estas son paletas semanticas (no dependen del modo), validas para ambos modos porque el icon color se calcula dinamicamente con `getContrastText`:

```typescript
/**
 * Colores semanticos para acciones rapidas (HomeScreen > QuickActions).
 * Validos en ambos modos: el color del icono se calcula con getContrastText.
 */
export const QUICK_ACTION_COLORS: Record<string, string> = {
  sorprendeme: '#00897b',
  favoritos: '#e53935',
  recientes: '#546e7a',
  visitas: '#1e88e5',
};
```

### 6. `src/components/home/QuickActions.tsx`

Eliminar const local `QUICK_ACTION_COLORS` (L56-61) e importar de `constants/business`. La funcion `getSlotColor` se mantiene identica.

Reemplazar L165 y L194 `color: 'common.white'` por color dinamico:

```typescript
import { getContrastText } from '../../utils/contrast';

// Dentro del map de slots:
const slotColor = getSlotColor(slot);
const iconColor = getContrastText(slotColor);
// ...
<Box sx={{ color: iconColor, display: 'flex' }}>{slot.icon}</Box>
```

Tambien en el dialog (L194) aplicar el mismo `iconColor`. Esto cambia el icono a negro sobre `#ffb300` (amber) si se agregara a la paleta — ninguno de los 4 colores actuales (`#00897b`, `#e53935`, `#546e7a`, `#1e88e5`) cruza el threshold de 0.179 de luminancia, por lo que todos siguen produciendo `#fff`. Es un no-op visible hoy, pero a prueba de futuro.

### 7. `src/components/map/BusinessMarker.tsx`

Importar `useTheme` de `@mui/material/styles`. Usar `background.paper` para border y glyph:

```typescript
import { useTheme } from '@mui/material/styles';

const BusinessMarker = memo(function BusinessMarker({ business, isSelected, onClick, averageRating }: Props) {
  const theme = useTheme();
  const color = CATEGORY_COLORS[business.category] || CATEGORY_COLORS.restaurant;
  const contrastColor = theme.palette.background.paper;
  // ...
  <Pin
    background={color}
    borderColor={isSelected ? contrastColor : color}
    glyphColor={contrastColor}
    scale={isSelected ? 1.3 : 1}
  />
});
```

Verificar compatibilidad: `theme.palette.background.paper` resuelve a `'#ffffff'` en light y `'#1e1e1e'` en dark (definido en `theme/index.ts`). Son strings hex validos para la API `Pin` de `@vis.gl/react-google-maps`.

Nota `memo`: el theme no cambia en cada render, pero `useTheme()` subscribe al context. El memo sigue siendo valido ya que las props (business, isSelected, onClick, averageRating) siguen siendo la comparacion shallow — el theme cambia solo cuando toggle dark mode (remount aceptable).

### 8. `src/components/map/MapView.tsx`

Reemplazar L131 inline rgba con `alpha()`:

Antes:

```typescript
bgcolor: (theme) => `rgba(${theme.palette.mode === 'dark' ? '30,30,30' : '255,255,255'},0.95)`,
```

Despues:

```typescript
import { alpha } from '@mui/material/styles';
// ...
bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
```

### 9. `src/theme/index.ts`

Actualizar `MuiFab.styleOverrides.root` para respetar `isLight` (espejo de `MuiPaper`):

Antes (L62-68):

```typescript
MuiFab: {
  styleOverrides: {
    root: {
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    },
  },
},
```

Despues:

```typescript
MuiFab: {
  styleOverrides: {
    root: {
      boxShadow: isLight
        ? '0 1px 4px rgba(0,0,0,0.3)'
        : '0 1px 4px rgba(0,0,0,0.6)',
    },
  },
},
```

`isLight` ya esta declarado al inicio de `getDesignTokens`.

### 10. `docs/reference/patterns.md`

En la seccion "Dark mode", agregar row:

```markdown
| **Brand colors adaptativos** | Para colores de brand/semantica (ej: gold de badges, colores de categoria), usar `alpha(HEX, theme.palette.mode === 'dark' ? X : Y)` con opacidades distintas por modo. Ejemplo: `VerificationBadge` duplica la opacidad del fondo dorado (0.08 → 0.16) en dark para compensar el `background.default` oscuro. |
```

### 11. `docs/reference/design-system.md`

En la seccion final (tokens), agregar:

```markdown
## Contrast helpers (`utils/contrast.ts`)

- `relativeLuminance(hex)` — luminancia relativa WCAG 2.0
- `getContrastText(bgHex)` — devuelve `'#fff'` o `'#000'` segun contraste
- `getContrastRatio(fgHex, bgHex)` — ratio de contraste 1.0-21.0
- `meetsWCAG_AA(fg, bg, isLargeText?)` — true si ratio cumple AA

Ejemplo:

\`\`\`typescript
import { getContrastText, meetsWCAG_AA } from '../../utils/contrast';
const iconColor = getContrastText(categoryBg); // auto-selecciona fg
if (!meetsWCAG_AA(fg, bg)) logger.warn('contraste insuficiente');
\`\`\`
```

---

## Mutable prop audit

No aplica — ningun componente recibe props que se modifican.

## Firestore rules field whitelist

No aplica — no hay escrituras a Firestore.

## Contratos de API / tipos

Se exporta una nueva funcion en `constants/business.ts`:

```typescript
export const QUICK_ACTION_COLORS: Record<string, string>;
```

Se exportan dos nuevas funciones en `utils/contrast.ts`:

```typescript
export function getContrastRatio(fgHex: string, bgHex: string): number;
export function meetsWCAG_AA(fgHex: string, bgHex: string, isLargeText?: boolean): boolean;
```

No hay breaking changes.

## Testing

- `contrast.test.ts`: agregar describe blocks para `getContrastRatio` y `meetsWCAG_AA` con los casos descritos en #2 arriba.
- Smoke test visual manual: toggle dark mode en Settings, recorrer HomeScreen (ForYouSection + QuickActions), perfil de usuario (BadgesList via `UserProfileSheet`), tab Buscar (marker seleccionado + filtro sin resultados), mapa FABs.
- Cobertura esperada: 100% en `contrast.ts` (es util pura).
- Cobertura global: no debe bajar del 80% (threshold CI).

## Riesgos

| Riesgo | Mitigacion |
|--------|------------|
| `Pin` de `@vis.gl/react-google-maps` no acepta colores no-hex | Usar `theme.palette.background.paper` que siempre resuelve a hex en este tema (verificado: `'#ffffff'` / `'#1e1e1e'`). |
| `getContrastText` cambia el color de iconos de QuickActions en algunos slots | Verificado: los 4 colores actuales tienen luminancia < 0.179, todos producen `#fff`. No-op visual hoy. |
| Regresion visual en light mode | Smoke test visual en las 5 tabs antes de merge. |
| Performance impact por `useTheme()` en BusinessMarker (40 markers) | Minimo: `useTheme` lee context, no introduce subscribers nuevos. El memo shallow sigue aplicando. |
| Extension de `contrast.ts` rompe import existente | APIs existentes (`relativeLuminance`, `getContrastText`) se preservan intactas. |
