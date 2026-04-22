# Plan: Accessibility Fixes #281

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fase 1: Correcciones de accesibilidad

**Branch:** `fix/accessibility-v2`

Todos los cambios son independientes entre sí. Se pueden implementar en cualquier orden.

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/AchievementsSection.tsx` | Reemplazar `<Typography onClick>` "Ver todos" por `<Button variant="text" size="small">`. Agregar `Button` al import de MUI. |
| 2 | `src/components/profile/LocalityPicker.tsx` | Reemplazar `<Typography onClick>` "Cambiar" por `<Button variant="text" size="small">`. Agregar `Button` al import de MUI. |
| 3 | `src/components/home/ActivityDigestSection.tsx` | En `DigestItem`, reemplazar `<Box onClick>` por `<ButtonBase>` con `sx` equivalente + `width: '100%'` + `textAlign: 'left'`. Agregar `ButtonBase` al import de MUI. |
| 4 | `src/components/profile/ProfileScreen.tsx` | En el `<Avatar>` clickable (línea ~114), agregar `role="button"`, `tabIndex={0}`, `aria-label="Cambiar avatar"`, y `onKeyDown` handler para Enter/Space. |
| 5 | `src/components/lists/ListDetailScreen.tsx` | En el `<IconButton>` de borrar item (línea ~229), agregar `aria-label="Eliminar de lista"`. |
| 6 | `src/components/home/QuickActions.tsx` | En el `<IconButton>` de slot (línea ~160), agregar `aria-label={slot.label}`. |
| 7 | `src/components/profile/AvatarPicker.tsx` | Reemplazar cada `<Box onClick>` por `<ButtonBase>` con `aria-label={avatar.label}` y `aria-pressed={selectedId === avatar.id}`. Agregar `ButtonBase` al import de MUI. |
| 8 | `src/components/profile/OnboardingChecklist.tsx` | En el `<Box onClick>` del header (línea ~126), agregar `role="button"`, `tabIndex={0}`, `aria-expanded={expanded}`, `aria-label` dinámico, y `onKeyDown` handler. |
| 9 | `src/components/business/MenuPhotoUpload.tsx` | En el `<Box onClick>` de la zona de upload (línea ~87), agregar `role="button"`, `tabIndex={0}`, `aria-label="Seleccionar imagen"`, y `onKeyDown` handler. |
| 10 | — | Lint (`npm run lint`) y build (`npm run build`) para verificar que no hay errores de TypeScript. |

---

## Orden de implementacion

No hay dependencias entre pasos. Orden sugerido: CRITICAL primero (pasos 1-2), luego MODERATE (3-7), luego LOW (8-9).

---

## Riesgos

- **Regresion visual en AvatarPicker**: `ButtonBase` aplica `display: inline-flex` por defecto — hay que asegurar que el `sx` del item incluya `display: 'flex'` y `width: '100%'` para que el grid no se rompa. El plan incluye esto explícitamente en el paso 7.
- **Button variant="text" heredando padding**: MUI Button tiene padding interno; hay que ajustar `sx={{ minWidth: 0, p: 0 }}` para que "Ver todos" y "Cambiar" queden visualmente iguales al Typography actual.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No hay archivos nuevos — todos los cambios son edits in-place
- [x] Logica de negocio sin cambios — solo atributos y primitivos de MUI
- [x] Ningun archivo resultante supera 400 lineas (todos los archivos afectados son < 200 lineas)

## Guardrails de accesibilidad y UI

- [x] `<IconButton>` de delete en ListDetailScreen recibe `aria-label`
- [x] `<IconButton>` de slots en QuickActions recibe `aria-label`
- [x] No hay `<Typography onClick>` nuevo — se eliminan los dos existentes
- [x] ButtonBase en DigestItem y AvatarPicker gestiona foco y role automáticamente
- [x] Box interactivos restantes (ProfileScreen Avatar, OnboardingChecklist header, MenuPhotoUpload zone) reciben `role="button"` + `tabIndex` + `onKeyDown`

## Guardrails de copy

- [x] "Cambiar avatar", "Eliminar de lista", "Seleccionar imagen" — sin tildes necesarias, correcto
- [x] "Colapsar/Expandir primeros pasos" — sin tildes necesarias, correcto

---

## Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | No aplica — no hay cambio de funcionalidad visible |
| 2 | `docs/reference/patterns.md` | No aplica — ButtonBase ya es un patron documentado en MUI |

---

## Criterios de done

- [x] Los 9 cambios de la tabla implementados
- [x] `npm run lint` sin errores
- [x] `npm run build` exitoso
- [x] No hay `<Typography onClick>` en los 9 archivos afectados al finalizar
- [x] Todo `<IconButton>` nuevo o tocado tiene `aria-label`
- [x] Todo `<Box onClick>` interactivo tiene `role="button"` o fue reemplazado por `ButtonBase`

---

## Estimacion de tamano de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas post-fix | Riesgo |
|---------|----------------|--------------------------|--------|
| AchievementsSection.tsx | 87 | ~87 | ninguno |
| LocalityPicker.tsx | 144 | ~144 | ninguno |
| ActivityDigestSection.tsx | 129 | ~130 | ninguno |
| ProfileScreen.tsx | ~180 | ~183 | ninguno |
| ListDetailScreen.tsx | ~260 | ~261 | ninguno |
| QuickActions.tsx | ~200 | ~200 | ninguno |
| AvatarPicker.tsx | 48 | ~49 | ninguno |
| OnboardingChecklist.tsx | ~160 | ~163 | ninguno |
| MenuPhotoUpload.tsx | ~130 | ~133 | ninguno |
