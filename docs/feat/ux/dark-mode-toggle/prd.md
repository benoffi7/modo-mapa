# PRD: Agregar toggle de dark mode en la UI

**Feature:** dark-mode-toggle
**Categoria:** ux
**Fecha:** 2026-03-29
**Issue:** #231
**Prioridad:** Media

---

## Contexto

La infraestructura de dark mode esta completa desde hace varias versiones: `ColorModeContext` con provider, `useColorMode` hook, `getDesignTokens(mode)` en `src/theme/index.ts`, persistencia en localStorage, respeto de `prefers-color-scheme`, y tracking de analytics via `setUserProperty('theme', mode)`. Sin embargo, no existe ningun punto de entrada en la UI para que el usuario active o desactive el modo oscuro manualmente. El patterns.md ya documenta que el toggle deberia estar en "SideMenu footer".

## Problema

- Los usuarios no pueden cambiar entre modo claro y oscuro sin modificar la preferencia del sistema operativo, lo cual muchos no saben hacer o no quieren cambiar globalmente.
- La infraestructura de dark mode (context, hook, tema, persistencia, analytics) esta implementada pero inutilizable para el usuario final.
- No se ha verificado que todos los componentes se rendericen correctamente en dark mode, lo que puede generar problemas de contraste y legibilidad.

## Solucion

### S1: Toggle en SettingsPanel (seccion Apariencia)

Agregar una nueva seccion "Apariencia" en `SettingsPanel` con un toggle para dark mode. Siguiendo el patron existente de `SettingRow`, el toggle consumira `useColorMode()` del `ColorModeContext` existente.

**Ubicacion en UI:** SettingsPanel, entre la seccion "Ubicacion" y "Privacidad". Nueva seccion con `Typography variant="overline"` titulada "Apariencia".

**Interaccion:** Un `SettingRow` con label "Modo oscuro", description "Cambia el tema visual de la app", checked cuando `mode === 'dark'`, y `onChange` que llama a `toggleColorMode()`.

El toggle ya persiste en localStorage y trackea analytics gracias al `ColorModeContext` existente. No se necesita logica adicional.

### S2: Indicador visual en ProfileScreen (opcional)

Si el usuario accede desde `ProfileScreen`, el icono del modo actual (sol/luna) puede mostrarse como referencia visual junto al toggle.

### S3: Audit visual de componentes en dark mode

Revisar los componentes principales de la app en modo oscuro para detectar problemas de contraste, bordes invisibles, o textos ilegibles. Usar `contrast.ts` (WCAG 2.0) para validar combinaciones criticas. Los componentes a auditar como minimo:

- BusinessSheet (tabs Info/Opiniones)
- SideMenu (header, secciones, footer)
- SettingsPanel
- Dialogs (EmailPasswordDialog, ChangePasswordDialog, DeleteAccountDialog)
- Mapa (marcadores, info window)
- Notificaciones (drawer, badges)
- Onboarding (BenefitsDialog, checklist)

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Seccion "Apariencia" con toggle dark mode en SettingsPanel | Alta | S |
| Consumir `useColorMode()` en el toggle | Alta | S |
| Audit visual de componentes principales en dark mode | Alta | M |
| Fixes de contraste/estilos detectados en audit | Alta | M |
| Icono sol/luna en el toggle (visual feedback) | Baja | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Modo "auto" que siga la preferencia del sistema (ya funciona como default inicial; no se agrega un tercer estado al toggle)
- Temas custom mas alla de light/dark
- Dark mode en el admin panel (`/admin`) -- se puede hacer en un issue separado
- Refactor del sistema de tokens de tema (ya funciona con `getDesignTokens`)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/profile/SettingsPanel.tsx` | Component | Que la seccion Apariencia se renderiza, toggle cambia mode |
| `src/context/ColorModeContext.tsx` | Context | Toggle persiste en localStorage, respeta prefers-color-scheme, analytics tracking |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)

Nota: `ColorModeContext` esta marcado como pendiente de tests en el inventario. Este feature es una buena oportunidad para agregar tests del contexto completo, no solo del toggle nuevo.

---

## Seguridad

Este feature no introduce nuevas superficies de ataque. No hay escrituras a Firestore, no hay inputs de texto libre, y no hay nuevos endpoints.

- [x] No se agregan colecciones ni campos nuevos a Firestore
- [x] No hay inputs de usuario que requieran validacion
- [x] Datos persistidos en localStorage (ya existente, solo `color-mode` key)

### Vectores de ataque automatizado

No aplica. Este feature es 100% client-side, sin interaccion con backend.

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A | N/A |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| N/A (0 issues abiertos de security/tech debt) | -- | -- |

### Deuda tecnica identificada

- `ColorModeContext.tsx` no tiene tests (marcado como pendiente en `tests.md`). Este feature es la oportunidad para agregar cobertura.
- `useColorMode.ts` esta marcado como "simple wrapper" y baja prioridad para tests, pero un test basico del context que lo incluya es razonable.

### Mitigacion incorporada

- Agregar tests de `ColorModeContext` como parte del feature (reduce deuda de tests pendientes).

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Toggle dark mode | write (localStorage) | Funciona 100% offline (localStorage es local) | Ninguno necesario |
| Leer preferencia inicial | read (localStorage + matchMedia) | Funciona 100% offline | Ninguno necesario |

### Checklist offline

- [x] Reads de Firestore: N/A (no usa Firestore)
- [x] Writes: N/A (solo localStorage, funciona offline)
- [x] APIs externas: N/A
- [x] UI: N/A (funciona completamente offline)
- [x] Datos criticos: localStorage siempre disponible

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout) -- usa `useColorMode()` hook existente
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout -- reutiliza `SettingRow` existente
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado -- `toggleColorMode` del context
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta -- modificacion en `profile/SettingsPanel.tsx`
- [x] Si el feature necesita estado global, evaluar si un contexto existente lo cubre -- usa `ColorModeContext` existente
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Modifica SettingsPanel existente, no agrega imports cruzados |
| Estado global | = | Usa contexto existente (`ColorModeContext`), no crea estado nuevo |
| Firebase coupling | = | No toca Firebase SDK |
| Organizacion por dominio | = | Cambio en `profile/SettingsPanel.tsx`, ubicacion correcta |

---

## Success Criteria

1. El usuario puede activar/desactivar dark mode desde SettingsPanel sin salir de la app
2. La preferencia persiste entre sesiones (localStorage) y se trackea en analytics
3. Todos los componentes principales pasan revision visual en dark mode sin problemas de contraste criticos (AA WCAG 2.0)
4. El toggle inicial respeta `prefers-color-scheme` del sistema cuando no hay preferencia guardada
5. Tests de `ColorModeContext` agregados con >= 80% cobertura
