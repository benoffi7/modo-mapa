# PRD: Dark mode — VerificationBadge gold invisible + hardcoded hex en HomeScreen y mapa

**Feature:** 307-dark-mode-verification-badge
**Categoria:** ux
**Fecha:** 2026-04-18
**Issue:** #307
**Prioridad:** Media (7 criticos, 2 high, 7 medium, 2 low segun auditor)

---

## Contexto

El proyecto completo la auditoria de dark mode en #246 (hardcoded colors en OfficeMarker/MenuPhotoSection/QuickActions) y establecio el patron de usar tokens del tema (`primary.dark`, `common.white`, `alpha(theme.palette.*)`) en vez de hexadecimales literales. La ejecucion del `/health-check` del 2026-04-18 con el agente `dark-mode-auditor` detecto 18 issues restantes en el codigo nuevo post-tabs v2 (principalmente en `components/home/`, `components/map/` y `components/social/`), con 7 criticos que fallan WCAG en dark mode. El mas impactante: `VerificationBadge` (merged en #201) usa `rgba(255,215,0,0.08)` sobre `#121212`, lo que vuelve el fondo dorado invisible y destruye la jerarquia visual del badge "earned". Este issue completa la auditoria visual para alcanzar paridad light/dark tras la adopcion de tabs.

## Problema

- **VerificationBadge invisible en dark mode (critico)**: `GOLD_BG = 'rgba(255,215,0,0.08)'` sobre `background.default` (`#121212`) tiene contraste insuficiente — el estado "earned" es indistinguible del "not earned", rompiendo el UX de gamificacion. Afecta `BadgesList`, `AchievementsGrid`, `UserProfileModal`.
- **Iconos de categoria con contraste variable (critico)**: `ForYouSection` fuerza `rgba(255,255,255,0.8)` para iconos sobre 7 fondos de categoria distintos (`CATEGORY_COLORS`). El contraste WCAG pasa en restaurant/bar/pizza pero falla en cafe (`#795548`) y bakery (`#ff9800`) bajo dark mode. El `#546e7a` fallback (L47) es hex literal, no tematizado.
- **QuickActions con hex fijos**: `QUICK_ACTION_COLORS` (sorprendeme, favoritos, recientes, visitas) son hex literales (`#00897b`, `#e53935`, `#546e7a`, `#1e88e5`). Iconos forzados a blanco — funciona hoy pero no adaptativo y replica el patron que #246 buscaba eliminar.
- **BusinessMarker no adapta al mapa dark**: marker seleccionado usa `borderColor="#fff"` y `glyphColor="#fff"` fijos. Con Google Maps en dark style, el borde blanco sobresale pero no respeta `background.paper`.
- **MapView overlay con rgba inline**: `bgcolor: (theme) => \`rgba(${theme.palette.mode === 'dark' ? '30,30,30' : '255,255,255'},0.95)\`` en L131 duplica la logica que `alpha(theme.palette.background.paper, 0.95)` resuelve limpiamente.
- **MuiFab shadow no theme-aware**: `theme/index.ts` L62-68 define una sombra fija para FAB, contrastando con el patron de `MuiPaper` (L44-52) que si distingue light/dark. Los FABs del mapa (My Location, view toggle) pierden definicion visual en dark.

## Solucion

### S1. VerificationBadge — gold adaptativo con `alpha()` + `theme.palette.mode`

Reemplazar la constante modulo `GOLD_BG` por una funcion que reciba el theme:

```typescript
import { alpha, useTheme } from '@mui/material/styles';

const GOLD_HEX = '#FFD700';
// Dentro del componente:
const theme = useTheme();
const goldBg = alpha(GOLD_HEX, theme.palette.mode === 'dark' ? 0.16 : 0.08);
```

Se duplica la opacidad en dark para compensar el fondo oscuro. Se conserva `GOLD_BORDER` como hex literal porque es un color semantico de brand (medalla de oro), documentado como excepcion. Aplica tanto al variant `compact` (Chip) como al no-compact (Box con LinearProgress). Tambien reemplazar `'primary.main'` del LinearProgress por `GOLD_HEX` cuando earned para mantener consistencia.

### S2. ForYouSection — iconos theme-aware con `contrast.ts`

Extender `src/utils/contrast.ts` para exponer un helper `getOnColor(bgHex)` que devuelva `'#fff'` o `'#000'` segun el contraste contra el fondo de categoria. Refactorizar `CATEGORY_ICONS` a una funcion que recibe el color de fondo:

```typescript
function getCategoryIcon(category: BusinessCategory, bgHex: string) {
  const iconColor = getContrastText(bgHex);
  const sx = { fontSize: 32, color: iconColor };
  switch (category) { /* ... */ }
}
```

Reemplazar el fallback `'#546e7a'` (L47) por el token del tema `theme.palette.text.secondary` o `theme.palette.grey[600]`. Reutilizar la funcion en `QuickActions` para los iconos (ver S3).

### S3. QuickActions — promover hex a constantes centralizadas + iconos adaptativos

Mover `QUICK_ACTION_COLORS` a `src/constants/business.ts` junto a `CATEGORY_COLORS` (ambos son paletas semanticas). Dejar el hex como brand color (documentado en comentario) pero eliminar el hardcode de `color: 'common.white'` del Box interno (L165). Usar `getContrastText(getSlotColor(slot))` para elegir icono oscuro sobre fondos claros (ej: amber/yellow) y claro sobre oscuros. Mismo tratamiento en el dialog de edicion (L194).

### S4. BusinessMarker — border/glyph adaptativo al theme

Aprovechar que el marker ya esta en un componente React, importar `useTheme` y reemplazar:

```typescript
const theme = useTheme();
const contrastColor = theme.palette.background.paper; // '#fff' light / '#1e1e1e' dark
<Pin
  background={color}
  borderColor={isSelected ? contrastColor : color}
  glyphColor={contrastColor}
  scale={isSelected ? 1.3 : 1}
/>
```

Nota: `Pin` es un componente de `@vis.gl/react-google-maps` que acepta strings hex. Verificar que acepta cualquier formato de color CSS valido (no solo `#rrggbb`). El theme token se resuelve a hex antes de pasarse.

### S5. MapView overlay — `alpha(background.paper, 0.95)`

Reemplazar la cadena literal rgba por el token del tema:

```typescript
bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
```

Import `alpha` desde `@mui/material/styles`.

### S6. MuiFab shadow mode-aware (tema global)

Espejar el patron de `MuiPaper` en `theme/index.ts`:

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

### S7. Extender `contrast.ts` con helper reutilizable

Actualmente `contrast.ts` solo exporta `relativeLuminance` y `getContrastText`. Agregar:

- `getContrastRatio(fgHex: string, bgHex: string): number` — usado por la auditoria WCAG.
- `meetsWCAG_AA(fgHex: string, bgHex: string): boolean` — helper para el test harness.

Estos ya estaban mencionados en `patterns.md` como existentes pero no estan implementados hoy (bug documentado). Implementacion canonica segun WCAG 2.0.

### S8. ESLint rule custom (opcional, registrado como follow-up)

La recomendacion del auditor de introducir una regla ESLint que prohiba hex literales en `sx` fuera de `theme/`, `constants/` y `ColorPicker.tsx` se deja fuera de scope de este PRD por ser de alcance mayor. Se crea issue aparte y se documenta en la seccion "Out of Scope".

### UX y flujo

- Sin cambios funcionales — solo ajustes de estilos CSS-in-JS.
- Verificacion visual: toggle dark mode en SettingsPanel > Apariencia, abrir perfil de usuario con badges, HomeScreen (ForYouSection + QuickActions), mapa con marker seleccionado, filtrar con busqueda vacia para disparar el overlay "No se encontraron comercios".
- Medicion objetiva con `contrast.ts`: todos los pares `fg/bg` nuevos deben alcanzar `meetsWCAG_AA` = `true` para texto (ratio >= 4.5) o componentes UI (ratio >= 3.0).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| VerificationBadge — alpha() + mode-aware gold (S1) | Must | S |
| ForYouSection — iconos con `getContrastText` + fallback tematizado (S2) | Must | S |
| QuickActions — promover hex a constants + iconos adaptativos (S3) | Should | S |
| BusinessMarker — border/glyph con `background.paper` (S4) | Must | S |
| MapView — overlay con `alpha()` (S5) | Must | XS |
| MuiFab shadow mode-aware (S6) | Should | XS |
| `contrast.ts` — agregar `getContrastRatio` + `meetsWCAG_AA` (S7) | Must (dep S2,S3) | S |
| Tests: `contrast.test.ts` actualizado con nuevos helpers | Must | S |
| Verificacion visual manual en light + dark | Must | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- ESLint rule custom que prohiba hex literales en `sx` (se registra como issue follow-up porque requiere setup de plugin custom y ajuste del config, y puede romper CI hasta refactorizar admin charts).
- Hex literales en `components/admin/*` (FeaturesPanel, FirebaseUsage, TrendsPanel, ga4FeatureDefinitions) — son colores semanticos de charts Recharts y el panel admin ya esta documentado como excepcion (`ColorPicker.tsx` patron).
- `LIST_COLORS` en `ColorPicker.tsx` — explicitamente documentados como validos en ambos modos por el auditor (user-picked palette con valores altos de luminosidad).
- Refactor mayor del theme (tokens custom para overlays, palettes extendidas). Se mantiene el uso de `alpha()` sobre tokens existentes.
- Cambio de la paleta `CATEGORY_COLORS` — se mantienen los hex actuales y se resuelve el contraste via `getContrastText`.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/contrast.ts` | Unit | `getContrastRatio`, `meetsWCAG_AA` (ratios conocidos WCAG: white/black=21, gold/black=13.87, gold/white=1.51) |
| `src/utils/__tests__/contrast.test.ts` | Unit | Actualizar tests existentes + agregar casos para nuevos helpers |
| `src/components/social/VerificationBadge.tsx` | Visual | Render en light + dark, earned vs not earned, variant compact y no-compact |
| `src/components/home/ForYouSection.tsx` | Visual | Iconos visibles sobre 7 categorias en light + dark |
| `src/components/home/QuickActions.tsx` | Visual | Iconos visibles sobre 4 colores de accion en light + dark |
| `src/components/map/BusinessMarker.tsx` | Visual | Marker seleccionado en mapa light y dark (si Google Maps soporta dark style) |
| `src/theme/index.ts` | Visual | FAB shadow visible en dark mode |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo en `contrast.ts`
- Tests de validacion con ratios WCAG conocidos (white/black, gold/black)
- Todos los paths condicionales cubiertos (theme.palette.mode === 'dark' vs 'light')
- Side effects verificados: no se introducen analytics events ni cambios en Firestore
- Verificacion manual con toggle de dark mode en ambos flujos completos

---

## Seguridad

Este feature solo modifica estilos CSS-in-JS y una utilidad pura de calculo de contraste. No hay superficies nuevas de seguridad.

- [x] No hay inputs de usuario nuevos
- [x] No se introduce `dangerouslySetInnerHTML` ni HTML dinamico
- [x] No se agregan escrituras a Firestore
- [x] No se agregan endpoints callable
- [x] No se modifican Firestore rules

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A — cambios puramente visuales | Ninguna |

---

## Deuda tecnica y seguridad

Antes de escribir esta seccion se consultaron issues abiertos de security/tech-debt: no hay issues abiertos con esas labels al 2026-04-18 (solo #168 bloqueado por Vite 8 peer deps). El unico issue relacionado cerrado recientemente es #246 que abordo la misma familia de problemas en otros 3 componentes.

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #246 (cerrado) | Mismo patron, otros componentes | Reutilizar patron: `alpha()`, tokens de tema, `contrast.ts` |
| #201 (cerrado) | Introdujo VerificationBadge con GOLD_BG hardcodeado | Fixear como parte de este feature |
| #294 (cerrado) | `logger.error` en DEV guard | No relacionado directamente — pero reforzar checklist |

### Mitigacion incorporada

- Se elimina el patron de `rgba()` fijos introducido antes de consolidar la utilidad de `alpha()` de MUI.
- Se completa `contrast.ts` con los helpers que `patterns.md` ya documentaba como existentes (bug de documentacion corregido de paso).
- Se promueven hex de `QuickActions` a `constants/business.ts` para dejar el codigo mas cerca del patron de "constantes centralizadas" que marca la arquitectura.

---

## Robustez del codigo

### Checklist de hooks async

- [x] No se introducen hooks async nuevos — cambios son estilistas puros.
- [x] `useTheme()` se usa en VerificationBadge y BusinessMarker (sync, no requiere cleanup).
- [x] `logger.error` dentro de `VerificationBadge.handleTooltipOpen` (no aplica) — ya esta correctamente ubicado fuera de `if (DEV)`.
- [x] Ningun archivo nuevo supera 300 lineas.
- [x] Archivos en `src/hooks/` no aplica.

### Checklist de observabilidad

- [x] No se introducen Cloud Functions ni services nuevos.
- [x] `trackEvent('verification_badge_tooltip', ...)` existente se mantiene sin cambios.
- [x] No se agregan analytics events nuevos.

### Checklist offline

- [x] No hay operaciones async nuevas que requieran offline handling.
- [x] No se escriben datos a Firestore.

### Checklist de documentacion

- [x] No se agregan secciones a HomeScreen — solo se modifican las existentes.
- [x] No se agregan analytics events nuevos.
- [x] No se agregan tipos nuevos.
- [ ] `docs/reference/patterns.md` actualizar: documentar el patron `alpha(HEX, theme.palette.mode === 'dark' ? X : Y)` como estandar para brand colors adaptativos.
- [ ] `docs/reference/design-system.md` actualizar: agregar referencia a `contrast.ts` helpers con ejemplos.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A — cambios puramente visuales | N/A | N/A |

### Checklist offline

- [x] No aplica — no hay reads ni writes nuevos.

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica en hooks/utils (`contrast.ts`) — no se agrega a componentes de layout.
- [x] Componentes ya estan aislados (VerificationBadge, ForYouSection, QuickActions, BusinessMarker, MapView).
- [x] No se agregan useState a layout.
- [x] Props explicitas — no hay cambios de contratos.
- [x] Sin handlers noop.
- [x] Ningun componente nuevo importa de `firebase/firestore`.
- [x] No se agregan archivos en `src/hooks/`.
- [x] Ningun archivo nuevo.
- [x] No se agregan converters.
- [x] No se agregan archivos a `components/menu/`.
- [x] No se crean contextos nuevos.
- [x] Ningun archivo modificado supera 400 lineas.

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Misma estructura, solo cambian estilos |
| Estado global | = | Usa `useTheme` (context existente), no agrega estado |
| Firebase coupling | = | No cambia |
| Organizacion por dominio | + | Promueve `QUICK_ACTION_COLORS` a `constants/business.ts` (centralizacion) |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] Contraste WCAG AA verificado en light + dark para todos los cambios (ratio >= 4.5 para texto, >= 3.0 para UI components).
- [x] IconButtons ya tienen `aria-label` (no se modifican).
- [x] Touch targets no se modifican.
- [x] No se cambian tamanos de texto.
- [x] VerificationBadge Tooltip conserva `onOpen` para analytics.
- [x] FAB shadow mejorada facilita percepcion de elevacion en dark (accesibilidad visual).

### Checklist de copy

- [x] No se modifican textos user-facing.
- [x] Tildes/voseo preservados en los archivos modificados.

---

## Success Criteria

1. **VerificationBadge "earned" visible en dark mode**: el fondo dorado con opacidad 0.16 debe ser perceptible sobre `#121212`, alcanzando ratio WCAG AA >= 3.0 contra el fondo (componente UI, no texto).
2. **Iconos de categoria y acciones rapidas legibles en ambos modos**: los 7 iconos de categoria en `ForYouSection` y los 8 slots de `QuickActions` mantienen ratio WCAG AA >= 4.5 tanto en light como en dark.
3. **`contrast.ts` completo**: `getContrastRatio` y `meetsWCAG_AA` exportados, cubiertos por tests con ratios conocidos (white/black = 21, gold/white = 1.51, gold/black = 13.87), cobertura 100%.
4. **Theme tokens reemplazan hex literales** en los 7 archivos identificados: ningun `color: '#...'` o `bgcolor: '#...'` fuera de `theme/`, `constants/`, `ColorPicker.tsx` y admin charts.
5. **Cero regresiones visuales en light mode**: smoke test en las 5 tabs (Inicio, Social, Buscar, Listas, Perfil) verifica que la apariencia light es identica a la actual.
