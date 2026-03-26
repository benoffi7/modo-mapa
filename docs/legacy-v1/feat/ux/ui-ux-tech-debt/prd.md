# PRD: UI/UX — MUI 7 deprecated props, accesibilidad, dark mode markers

**Feature:** ui-ux-tech-debt
**Categoria:** ux
**Fecha:** 2026-03-24
**Issue:** #179
**Prioridad:** Media

---

## Contexto

Las auditorias de UI y dark mode (2026-03-24) identificaron props deprecated de MUI 7, problemas de accesibilidad, y colores hardcodeados en markers del mapa.

## Problema

- 4 componentes usan `inputProps` deprecated en MUI 7 (debe ser `slotProps.htmlInput`)
- NameDialog no se puede cerrar con Escape ni backdrop click — usuario puede quedar atrapado
- FeedbackForm swallows file size error silenciosamente
- MenuPhotoSection no tiene accesibilidad de teclado (onClick sin role/tabIndex/onKeyDown)
- ESLint config tiene regla `@typescript-eslint/no-var-requires` que ya no existe

## Solucion

### S1: Migrar inputProps a slotProps (MUI 7)

Cambiar `inputProps` a `slotProps={{ htmlInput: {...} }}` en:
- `SearchBar.tsx` — aria-label
- `NameDialog.tsx` — maxLength
- `EditDisplayNameDialog.tsx` — maxLength
- `FeedbackList.tsx` (admin) — maxLength

### S2: NameDialog dismissable

Agregar `onClose` prop al Dialog para permitir Escape y backdrop click. El handler llama a la misma funcion que "Omitir".

### S3: FeedbackForm file size error

Agregar toast o inline error cuando el archivo excede MAX_SIZE en vez de `return` silencioso.

### S4: MenuPhotoSection keyboard accessibility

Agregar `role="button"`, `tabIndex={0}`, y `onKeyDown` (Enter/Space) al Box clickeable.

### S5: ESLint config cleanup

Remover la regla `@typescript-eslint/no-var-requires` del `.eslintrc.cjs`.

### S6: Privacy policy minor updates

Agregar mencion de localStorage onboarding keys y expandir ejemplos de analytics events.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: inputProps → slotProps (4 files) | P1 | S |
| S2: NameDialog dismissable | P1 | S |
| S3: FeedbackForm file size error | P1 | S |
| S4: MenuPhotoSection keyboard a11y | P1 | S |
| S5: ESLint config cleanup | P2 | S |
| S6: Privacy policy updates | P2 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- OfficeMarker/BusinessMarker hardcoded colors (aceptable en markers de mapa sobre Google Maps canvas)
- OfflineIndicator/SearchBar z-index overlap (edge case en 360px)
- FilterChips hardcoded top offset (requiere refactor de layout)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| Componentes modificados | Existentes | Verificar que tests existentes siguen pasando |

### Criterios de testing

- Tests existentes siguen pasando
- No se requieren tests nuevos (cambios son de UI/props)

---

## Seguridad

- [x] Sin impacto en seguridad

---

## Offline

### Esfuerzo offline adicional: Ninguno

---

## Modularizacion

### Checklist modularizacion

- [x] No se agrega logica nueva — solo fixes de props y accesibilidad
- [x] No se crean componentes nuevos
- [x] No se modifican AppShell o SideMenu

---

## Success Criteria

1. 0 warnings de `inputProps` deprecated en MUI 7
2. NameDialog se puede cerrar con Escape y backdrop click
3. FeedbackForm muestra error visible al usuario cuando archivo excede limite
4. MenuPhotoSection es navegable y activable por teclado
5. `npm run lint` muestra 0 errors (regla obsoleta removida)
6. Privacy policy actualizada con localStorage keys y analytics events
