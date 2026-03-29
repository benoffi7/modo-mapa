# Plan: Agregar toggle de dark mode en la UI

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Toggle en SettingsPanel + tests

**Branch:** `feat/dark-mode-toggle`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/SettingsPanel.tsx` | Importar `useColorMode` de `../../hooks/useColorMode`. Agregar seccion "Apariencia" con `Typography variant="overline"` + `SettingRow` para dark mode toggle entre la seccion "Ubicacion" y "Privacidad". El `SettingRow` usa `label="Modo oscuro"`, `description="Cambia el tema visual de la app"`, `checked={mode === 'dark'}`, `onChange={() => toggleColorMode()}`. |
| 2 | `src/context/ColorModeContext.test.tsx` | Crear test file. Mockear `setUserProperty` de analytics. Testear: (a) modo por defecto light sin localStorage ni prefers-color-scheme, (b) respeta prefers-color-scheme dark, (c) respeta localStorage sobre prefers-color-scheme, (d) toggleColorMode alterna light/dark, (e) toggle persiste en localStorage, (f) toggle llama setUserProperty('theme', newMode), (g) theme MUI tiene mode correcto. Mock `window.matchMedia` con `vi.fn()`. |
| 3 | `src/components/profile/SettingsPanel.test.tsx` | Crear test file. Mockear `useColorMode` y `useUserSettings`. Testear: (a) seccion "Apariencia" visible, (b) toggle refleja mode del context, (c) click en toggle llama toggleColorMode, (d) seccion aparece en orden correcto (despues de Ubicacion, antes de Privacidad). |
| 4 | Lint + build | Ejecutar `npm run lint` y `npm run build` para verificar que no hay errores. |
| 5 | Tests | Ejecutar `npm run test:run` para verificar que todos los tests pasan. |

### Fase 2: Audit visual de dark mode

Esta fase es manual (QA). No genera commits de codigo a menos que se detecten problemas.

| Paso | Componente | Que verificar |
|------|-----------|---------------|
| 1 | BusinessSheet (tabs Info/Opiniones) | Contraste de texto, bordes de tabs, fondos de cards |
| 2 | ProfileScreen + SettingsPanel | Contraste de labels, switches, dividers |
| 3 | Dialogs (EmailPasswordDialog, ChangePasswordDialog, DeleteAccountDialog) | Fondos de dialog, inputs, botones |
| 4 | SearchScreen (mapa, marcadores, SearchBar) | Fondo del mapa (Google Maps tiene su propio dark mode), SearchBar contraste |
| 5 | NotificationsSection (drawer, badges) | Badges visibles, texto legible |
| 6 | OnboardingChecklist + BenefitsDialog | Cards de progreso, fondos de dialog |
| 7 | SocialScreen (tabs, ActivityFeed, UserProfileSheet) | Cards de actividad, avatares, botones follow |

**Si se detectan problemas de contraste:** Crear fixes en `src/theme/index.ts` (ajustar `getDesignTokens`) o en los `sx` props de componentes especificos. Usar `relativeLuminance` y `getContrastText` de `src/utils/contrast.ts` para validar combinaciones criticas contra WCAG 2.0 AA (ratio >= 4.5:1 para texto normal).

### Fase 3: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar la entrada de Dark mode: cambiar "Toggle en SideMenu footer" a "Toggle en SettingsPanel seccion Apariencia" |
| 2 | `docs/reference/tests.md` | Mover `ColorModeContext.tsx` de pending a completado en el inventario, agregar `SettingsPanel.test.tsx` al inventario de componentes |
| 3 | `docs/reference/features.md` | Agregar "Toggle de dark mode en SettingsPanel" al listado de features UX |

---

## Orden de implementacion

1. `src/components/profile/SettingsPanel.tsx` -- agregar seccion Apariencia (no tiene dependencias)
2. `src/context/ColorModeContext.test.tsx` -- tests del context (independiente del paso 1)
3. `src/components/profile/SettingsPanel.test.tsx` -- tests del componente (depende del paso 1)
4. Lint + build + test run
5. Audit visual manual (Fase 2)
6. Fixes de contraste si necesarios (Fase 2)
7. Documentacion (Fase 3)

Los pasos 1 y 2 pueden ejecutarse en paralelo.

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Estado |
|---------|----------------|------------------------------|--------|
| `src/components/profile/SettingsPanel.tsx` | 175 | ~195 | Ideal (< 200) |
| `src/context/ColorModeContext.test.tsx` | 0 (nuevo) | ~120 | Ideal |
| `src/components/profile/SettingsPanel.test.tsx` | 0 (nuevo) | ~90 | Ideal |

Ningun archivo supera 400 lineas. No se necesita descomposicion.

## Riesgos

1. **Componentes con estilos hardcodeados en light mode.** Algunos componentes pueden tener colores inline (ej: `color: '#333'`) que no responden al cambio de tema. Mitigacion: la Fase 2 (audit visual) los detecta. Los fixes son cambios puntuales en `sx` props usando `theme.palette.*` en vez de hex literals.

2. **Google Maps no responde al dark mode de MUI.** El mapa de Google tiene su propia API de estilos. Mitigacion: esta fuera de scope segun el PRD. El mapa se vera en su estilo por defecto independientemente del toggle. Se puede abordar en un issue futuro si hay demanda.

3. **Tests del ColorModeContext pueden ser fragiles con matchMedia.** El mock de `window.matchMedia` necesita devolver un objeto con `matches`, `addEventListener`, etc. Mitigacion: usar el patron establecido en el proyecto (`vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })`).

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (`profile/` y `context/`)
- [x] Logica de negocio en hooks/services (usa `useColorMode` hook), no en componentes
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (`ColorModeContext` tests)
- [x] Ningun archivo resultante supera 400 lineas

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar Dark mode: "Toggle en SettingsPanel seccion Apariencia" |
| 2 | `docs/reference/tests.md` | Mover ColorModeContext a completado, agregar SettingsPanel.test.tsx |
| 3 | `docs/reference/features.md` | Agregar toggle dark mode al listado UX |

## Criterios de done

- [ ] Toggle de dark mode visible en SettingsPanel, seccion "Apariencia"
- [ ] Toggle consume `useColorMode()` y cambia el tema correctamente
- [ ] Preferencia persiste en localStorage entre sesiones
- [ ] Analytics trackea el cambio via `setUserProperty('theme', mode)`
- [ ] Tests de `ColorModeContext` con >= 80% cobertura
- [ ] Tests de `SettingsPanel` cubren la nueva seccion
- [ ] Audit visual completado para componentes principales en dark mode
- [ ] Fixes de contraste aplicados (si se detectaron problemas)
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Reference docs updated (patterns.md, tests.md, features.md)
