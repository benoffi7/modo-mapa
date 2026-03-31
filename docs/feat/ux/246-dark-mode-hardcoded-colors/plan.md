# Plan: Dark mode — fix hardcoded colors

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Fix colores hardcodeados

**Branch:** `fix/246-dark-mode-hardcoded-colors`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/map/OfficeMarker.tsx` | Importar `Box` de `@mui/material` y `alpha` de `@mui/material/styles`. Convertir `<div style={...}>` a `<Box sx={...}>`. Reemplazar `backgroundColor: '#1565c0'` por `bgcolor: 'primary.dark'`, `border: '3px solid #fff'` por `border: (theme) => \`3px solid ${theme.palette.background.paper}\``, `boxShadow` por version con `alpha(theme.palette.common.black, 0.3)`, `color: '#fff'` (icono) por `color: 'common.white'`. |
| 2 | `src/components/business/MenuPhotoSection.tsx` | Importar `alpha` de `@mui/material/styles`. Reemplazar `bgcolor: 'rgba(0,0,0,0.55)'` por `bgcolor: (theme) => alpha(theme.palette.common.black, 0.55)` en light, `alpha(theme.palette.common.white, 0.15)` en dark (usando `theme.palette.mode`). Mismo patron para `'&:hover' bgcolor` con 0.75/0.25. |
| 3 | `src/components/home/QuickActions.tsx` | Reemplazar L164 `color: '#fff'` por `color: 'common.white'`. Reemplazar L193 `color: '#fff'` por `color: 'common.white'`. |
| 4 | Tests existentes | Ejecutar `npm run test:run` para verificar que `OfficeMarker.test.tsx` y el resto de tests pasan sin cambios. |
| 5 | Lint | Ejecutar `npx lint-staged` o `npx eslint` en los 3 archivos modificados para verificar sin errores. |

### Fase 2: Verificacion visual

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Verificar visualmente OfficeMarker en light y dark mode (toggle en SettingsPanel > Apariencia). |
| 2 | N/A | Verificar visualmente MenuPhotoSection overlay en ambos modos. |
| 3 | N/A | Verificar visualmente QuickActions iconos en ambos modos. |
| 4 | N/A | Ejecutar `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components/map/OfficeMarker.tsx src/components/business/MenuPhotoSection.tsx src/components/home/QuickActions.tsx` para verificar que no quedan hex hardcodeados en los tres archivos. |

### Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar nota en seccion "Dark mode" sobre el patron de overlay adaptativo con `alpha()` + `theme.palette.mode`. |

---

## Orden de implementacion

1. `OfficeMarker.tsx` — componente mas critico segun PRD, sin dependencias
2. `MenuPhotoSection.tsx` — segundo en prioridad, patron de overlay adaptativo
3. `QuickActions.tsx` — cambio menor, solo reemplazo de token
4. Tests + lint
5. Verificacion visual
6. Documentacion

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Supera 400? |
|---------|----------------|------------------|-------------|
| `OfficeMarker.tsx` | 26 | 30 | No |
| `MenuPhotoSection.tsx` | 155 | 160 | No |
| `QuickActions.tsx` | 212 | 212 | No |

## Riesgos

1. **Overlay invisible en fotos muy claras (dark mode):** El overlay `alpha(common.white, 0.15)` podria ser invisible sobre fotos claras. Mitigacion: verificar visualmente con fotos de distintos tonos. Si es insuficiente, subir a 0.20.
2. **OfficeMarker renderiza sobre Google Maps:** El `Box` de MUI debe renderizar identico al `div` dentro del `AdvancedMarker`. Mitigacion: `Box` renderiza un `div` por defecto, no deberia haber diferencia funcional. Verificar en mapa.
3. **`alpha()` import size:** Importar `alpha` agrega una dependencia a `@mui/material/styles`. Mitigacion: ya se usa en `ScoreSparkline.tsx`, no es nueva; tree-shaking elimina lo no usado.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No hay archivos nuevos (solo modificaciones)
- [x] Logica de negocio en hooks/services, no en componentes (N/A, solo estilos)
- [x] No se toca ningun archivo con deuda tecnica sin incluir fix (la deuda de service layer de MenuPhotoSection es #243, fuera de scope)
- [x] Ningun archivo resultante supera 400 lineas

## Criterios de done

- [ ] Los 4 colores hardcodeados de OfficeMarker reemplazados por tokens del tema
- [ ] Los 2 overlays de MenuPhotoSection usan `alpha()` con adaptacion por modo
- [ ] Los 2 `#fff` de QuickActions reemplazados por `'common.white'`
- [ ] `grep` confirma cero hex hardcodeados en los 3 archivos
- [ ] Tests existentes pasan sin cambios
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Verificacion visual en light y dark mode
- [ ] Docs actualizados (patterns.md)
