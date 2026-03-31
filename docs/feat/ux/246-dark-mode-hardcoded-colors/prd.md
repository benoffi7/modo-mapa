# PRD: Dark mode: fix hardcoded colors en OfficeMarker y MenuPhotoSection

**Feature:** 246-dark-mode-hardcoded-colors
**Categoria:** ux
**Fecha:** 2026-03-29
**Issue:** #246
**Prioridad:** Baja

---

## Contexto

El proyecto implemento dark mode completo con `ColorModeContext` + `useColorMode` hook y un theme playground en `/dev/theme`. Sin embargo, una auditoria visual detecto que tres componentes tienen colores hardcodeados que no se adaptan al modo oscuro: `OfficeMarker.tsx` usa hexadecimales fijos para background/border/text, `MenuPhotoSection.tsx` usa `rgba()` fijos para overlays, y `QuickActions.tsx` usa `#fff` hardcodeado. Estos colores se ven bien en light mode pero rompen el contraste o la coherencia visual en dark mode.

## Problema

- **OfficeMarker.tsx (critico)**: El marcador del mapa usa `backgroundColor: '#1565c0'` (deberia ser `primary.dark`), `border: '#fff'` (deberia ser `background.paper`), `boxShadow` con rgba fija, y `color: '#fff'` (deberia ser `common.white` o token de tema). En dark mode, el borde blanco y la sombra fija rompen la coherencia visual.
- **MenuPhotoSection.tsx (moderado)**: Los overlays de las fotos usan `bgcolor: rgba(0,0,0,0.55)` y `hover: rgba(0,0,0,0.75)` hardcodeados. En dark mode, estos overlays no contrastan correctamente con el fondo oscuro.
- **QuickActions.tsx (menor)**: Usa `color: '#fff'` hardcodeado en dos lugares. Deberia usar `common.white` del tema para consistencia.

## Solucion

### S1. Reemplazar colores hardcodeados en OfficeMarker.tsx

- L17: `backgroundColor: '#1565c0'` a `backgroundColor: 'primary.dark'` (MUI shorthand)
- L18: `border: '2px solid #fff'` a `border: (theme) => '2px solid ' + theme.palette.background.paper`
- L19: `boxShadow` con rgba fija a token de sombra adaptativo usando `theme.shadows` o un valor que respete el modo
- L22: `color: '#fff'` a `color: 'common.white'`

Referencia de patron: el proyecto usa MUI 7 con `sx` prop y shorthand strings para colores del tema (`'primary.main'`, `'text.secondary'`). Ver `design-system.md` para tokens disponibles.

### S2. Reemplazar overlays hardcodeados en MenuPhotoSection.tsx

- L91: `bgcolor: 'rgba(0,0,0,0.55)'` a un token de overlay del tema. MUI 7 no tiene un token nativo de overlay, pero se puede usar `alpha(theme.palette.common.black, 0.55)` de `@mui/material/styles` o definir un token custom en el tema.
- L93: hover rgba similar.

### S3. Reemplazar colores en QuickActions.tsx

- L164, L193: `color: '#fff'` a `color: 'common.white'`

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Reemplazar 4 colores hardcodeados en OfficeMarker.tsx | Must | S |
| Reemplazar 2 overlays hardcodeados en MenuPhotoSection.tsx | Must | S |
| Reemplazar 2 colores hardcodeados en QuickActions.tsx | Should | S |
| Verificar contraste WCAG AA en ambos modos (usar contrast.ts) | Should | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Auditoria completa de colores hardcodeados en todo el proyecto (solo los tres componentes del issue)
- Crear tokens de overlay custom en el tema MUI (usar utilidades existentes como `alpha()`)
- Cambiar el diseno visual de los marcadores o overlays
- Modificar el theme playground

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/map/OfficeMarker.tsx` | Visual / Manual | Verificar que el marcador se ve correctamente en light y dark mode |
| `src/components/menu/MenuPhotoSection.tsx` | Visual / Manual | Verificar que los overlays tienen contraste correcto en ambos modos |
| `src/components/business/QuickActions.tsx` | Visual / Manual | Verificar que los iconos/texto son visibles en ambos modos |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

Nota: estos cambios son puramente visuales (estilos CSS-in-JS). No requieren tests unitarios. La verificacion es visual en ambos modos usando el toggle de dark mode en SettingsPanel.

---

## Seguridad

- [x] No hay surface areas de seguridad — cambios puramente visuales
- [x] No se introduce `dangerouslySetInnerHTML` ni HTML dinamico
- [x] No hay inputs de usuario involucrados

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A — cambios puramente visuales | Ninguna |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Dark mode toggle (implementado) | Precedente | El toggle funciona; este issue corrige componentes que no lo respetan |
| #196 Accesibilidad | Relacionado | Los colores hardcodeados pueden violar WCAG AA en dark mode |

### Mitigacion incorporada

- Se eliminan los ultimos colores hardcodeados conocidos que rompen dark mode
- Se mejora accesibilidad de contraste en modo oscuro

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] Reads de Firestore: N/A (solo estilos)
- [x] Writes: N/A
- [x] APIs externas: N/A
- [x] UI: el dark mode toggle funciona offline (localStorage)
- [x] Datos criticos: N/A

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature modifica estilos inline en 3 componentes existentes. No hay cambios estructurales.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (N/A - solo estilos)
- [x] Componentes nuevos son reutilizables (N/A - no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (N/A)
- [x] Si el feature necesita estado global: N/A
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo cambios de estilos inline |
| Estado global | = | Sin cambios |
| Firebase coupling | = | Sin cambios |
| Organizacion por dominio | = | Sin cambios |

---

## Success Criteria

1. OfficeMarker se renderiza correctamente en light mode y dark mode, con colores del tema en vez de hardcodeados
2. MenuPhotoSection overlays tienen contraste adecuado en ambos modos (verificable visualmente)
3. QuickActions usa tokens del tema en vez de `#fff` hardcodeado
4. Ningun color hexadecimal hardcodeado queda en los tres archivos modificados (verificable con grep)
5. El contraste cumple WCAG AA (ratio >= 4.5:1 para texto, >= 3:1 para elementos graficos) en ambos modos
