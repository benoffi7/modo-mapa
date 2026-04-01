# Plan: UI/A11y — Clickable Boxes sin role/keyboard + touch targets + aria-labels (#290)

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-04-01

---

## Fases de implementacion

### Fase 1: Clickable Boxes — CRITICAL keyboard inaccessible

**Branch:** `fix/290-accessibility-touch-targets`

Reemplazar `Box onClick` inaccessible por `ButtonBase` (incondicionalmente interactivo) o agregar `role`/`tabIndex`/`onKeyDown` (condicionalmente interactivo).

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/ListCardGrid.tsx` | Reemplazar `<Box onClick>` en el `map()` por `<ButtonBase>` con `aria-label={list.name}` y `sx={{ ..., width: '100%', textAlign: 'left' }}`. Agregar `ButtonBase` al import de MUI. |
| 2 | `src/components/home/SpecialsSection.tsx` | Reemplazar `<Box onClick>` en el `map()` de especiales por `<ButtonBase>` con `aria-label={item.title}` y `sx={{ ..., width: '100%', textAlign: 'left' }}`. Agregar `ButtonBase` al import. |
| 3 | `src/components/lists/ListDetailScreen.tsx` | Reemplazar `<Box key={item.id} onClick>` (en el `map()` de items, línea ~217) por `<ButtonBase aria-label={\`Abrir ${biz.name}\`} sx={{ ...cardSx, width: '100%', textAlign: 'left', display: 'block' }}>`. Agregar `ButtonBase` al import. |
| 4 | `src/components/social/RankingItem.tsx` | En el `<Box onClick={onClick}>` raíz: agregar `role={onClick ? 'button' : undefined}`, `tabIndex={onClick ? 0 : undefined}`, `onKeyDown={onClick ? (e) => { if (e.key === 'Enter' \|\| e.key === ' ') onClick(); } : undefined}`, `aria-label={onClick ? \`Ver perfil de ${entry.displayName}\` : undefined}`. Mantener `Box` para preservar animaciones CSS. |

---

### Fase 2: LocalityPicker — timeout + error state + silent catch

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/LocalityPicker.tsx` | (a) Agregar `const [apiError, setApiError] = useState(false)` al state. (b) Refactorizar el `useEffect` de polling: agregar `let attempts = 0`, `const MAX_ATTEMPTS = 20`, incrementar en cada intento fallido, llamar `setApiError(true)` y retornar cuando `attempts >= MAX_ATTEMPTS`. Agregar `let cancelled = false` con cleanup `return () => { cancelled = true; }`. (c) En el `TextField`: agregar `error={apiError}`, actualizar `placeholder` a `apiError ? 'Servicio no disponible' : ready ? 'Buscar ciudad o barrio...' : 'Cargando...'`, agregar `helperText={apiError ? 'No se pudo cargar el buscador de localidades' : undefined}`. (d) En el `catch` del `handleSelect`: reemplazar `// geocode failed silently` por `logger.warn('[LocalityPicker] geocode failed', e)`. Agregar import de `logger`. |

---

### Fase 3: Typography-as-button — CommentRow

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/CommentRow.tsx` | Reemplazar el `<Typography component="span" onClick>` del nombre de usuario (línea ~91-104) por: cuando `isProfilePublic`, renderizar `<Button variant="text" size="small">` con el nombre; cuando no, `<Typography component="span">` sin onClick. Agregar `Button` al import si no existe. Remover `onClick` y los estilos de cursor del Typography existente. |

---

### Fase 4: Missing aria-labels en botones de cierre

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/business/MenuPhotoViewer.tsx` | Agregar `aria-label="Cerrar visor de foto"` al `<IconButton onClick={onClose}>` (línea ~66). |
| 2 | `src/components/profile/AvatarPicker.tsx` | Agregar `aria-label="Cerrar selector de avatar"` al `<IconButton size="small" onClick={onClose}>` (línea ~18). |
| 3 | `src/components/home/SpecialsSection.tsx` | Agregar `aria-label="Cerrar especiales"` al `<IconButton onClick={() => setSelectedSpecial(null)}>` en el dialog (línea ~115). |

---

### Fase 5: Touch targets — aumentar a minimo 44px

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/profile/CommentsToolbar.tsx` | En los `ToggleButton` del `map()`: cambiar `height: 24` a `height: 32`. Agregar `position: 'relative'` y el pseudoelemento táctil: `'&::after': { content: '""', position: 'absolute', top: '-6px', bottom: '-6px', left: 0, right: 0 }`. |
| 2 | `src/components/business/CommentRow.tsx` | En el Like `IconButton` (línea ~158): remover `size="small"` y cambiar `p: 0.5` a `p: 1`. En los Edit/Delete `IconButton` (líneas ~218-234): remover `size="small"` (usar default = medium). |
| 3 | `src/components/lists/ListDetailScreen.tsx` | En los 7 `IconButton size="small"` del toolbar `canEditConfig` (líneas ~159-181): remover `size="small"`. Nota: verificar que el toolbar no desborde en 360px tras el cambio — si desborda, agregar `overflow: 'auto'` al `Toolbar` o `gap: 0.5`. |

---

### Fase 6: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/ListCardGrid.test.tsx` (nuevo) | Crear test: renderizar `ListCardGrid` con una lista mock. Verificar que el item tiene `role="button"`. Verificar que `fireEvent.keyDown(button, { key: 'Enter' })` llama `onListClick`. Verificar `aria-label` igual al nombre de la lista. |
| 2 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Agregar casos al test existente: verificar que los items renderizados como `ButtonBase` tienen `aria-label="Abrir {name}"`. Verificar que `fireEvent.keyDown` dispara `navigateToBusiness`. |
| 3 | `src/components/business/MenuPhotoViewer.test.tsx` | Agregar caso al test existente: `getByLabelText('Cerrar visor de foto')` existe y al clickear llama `onClose`. |
| 4 | `src/components/profile/LocalityPicker.test.tsx` (nuevo) | Crear test con `vi.useFakeTimers()`. Mock `window.google = undefined`. Avanzar `vi.advanceTimersByTime(10000)` (20 × 500ms). Verificar que el TextField muestra `error` y `helperText` de error. Verificar que no se llama `setTimeout` después del intento 20. Segundo test: simular que Google Maps carga en el intento 3 → `ready` se activa, no `apiError`. |
| 5 | `src/components/social/RankingItem.test.tsx` (nuevo) | Test con `onClick` presente: verificar `role="button"`, `tabIndex=0`, `aria-label` con displayName. `fireEvent.keyDown(el, { key: 'Enter' })` llama `onClick`. Test sin `onClick`: no tiene `role="button"`. |

---

### Fase 7 (final): Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | En la sección "Accesibilidad": agregar entrada sobre `ButtonBase` como reemplazo de `Box onClick` incondicionalmente interactivo. Agregar nota sobre el patrón de timeout/MAX_ATTEMPTS para polling de APIs externas. |
| 2 | `docs/reference/features.md` | No aplica (sin cambio de funcionalidad visible). |
| 3 | `docs/reference/project-reference.md` | Actualizar fecha y versión al completar. |

---

## Orden de implementacion

1. **Fase 1** (Boxes a ButtonBase) — sin dependencias
2. **Fase 2** (LocalityPicker) — sin dependencias
3. **Fase 3** (CommentRow Typography) — sin dependencias
4. **Fase 4** (aria-labels) — sin dependencias (puede hacerse en paralelo con Fase 3)
5. **Fase 5** (touch targets) — sin dependencias (puede hacerse en paralelo con Fase 4)
6. **Fase 6** (tests) — depende de Fases 1-5
7. **Fase 7** (docs) — depende de Fase 6

Las fases 1-5 pueden ejecutarse en cualquier orden. Se agrupan por categoría para facilitar review, no por dependencia técnica.

---

## Estimacion de tamanio de archivos resultantes

| Archivo | Tamanio actual (aprox) | Tamanio esperado | Riesgo |
|---------|----------------------|-----------------|--------|
| `ListCardGrid.tsx` | ~60 lineas | ~65 lineas | Bajo |
| `SpecialsSection.tsx` | ~152 lineas | ~160 lineas | Bajo |
| `ListDetailScreen.tsx` | ~288 lineas | ~295 lineas | Bajo |
| `RankingItem.tsx` | ~95 lineas | ~105 lineas | Bajo |
| `CommentRow.tsx` | ~241 lineas | ~260 lineas | Bajo |
| `CommentsToolbar.tsx` | ~88 lineas | ~95 lineas | Bajo |
| `MenuPhotoViewer.tsx` | ~88 lineas | ~90 lineas | Bajo |
| `AvatarPicker.tsx` | ~50 lineas | ~52 lineas | Bajo |
| `LocalityPicker.tsx` | ~144 lineas | ~165 lineas | Bajo |

Ningún archivo supera 400 líneas. Sin necesidad de descomposición.

---

## Riesgos

1. **ButtonBase sobreescribe estilos de cardSx:** `ButtonBase` aplica sus propios estilos base (display, etc.). Mitigación: pasar `sx={{ ...cardSx, ... }}` explícitamente en cada `ButtonBase`. Si `cardSx` incluye `cursor: pointer` podría haber duplicación inerte. Verificar visualmente después de cada cambio de Fase 1.

2. **Touch target de CommentsToolbar rompe layout:** Aumentar la altura del `ToggleButton` de 24 a 32px puede requerir ajuste del padding del contenedor. El pseudoelemento `::after` es invisible pero puede interferir con clicks en elementos adyacentes si hay stacking context. Mitigación: testear en Chrome DevTools touch simulation.

3. **LocalityPicker test con fake timers y módulos dinámicos:** `window.google` es global y puede persistir entre tests si no se limpia. Mitigación: usar `afterEach(() => { delete (window as any).google; })` en el archivo de test.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (no aplica — solo modificaciones)
- [x] Logica de negocio en hooks/services, no en componentes (no se agrega lógica nueva)
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix (LocalityPicker silent catch resuelto)
- [x] Ningun archivo resultante supera 400 lineas

## Guardrails de seguridad

- [x] No hay colecciones nuevas — no aplica `hasOnly()`
- [x] No hay campos nuevos en Firestore
- [x] No hay secrets ni credenciales en archivos commiteados
- [x] No hay `getCountFromServer` — no aplica

## Guardrails de accesibilidad y UI

- [x] Todo `<IconButton>` nuevo/modificado tiene `aria-label`
- [x] No hay `<Typography onClick>` nuevo — CommentRow usa `<Button variant="text">`
- [x] Touch targets minimo 44px (CommentsToolbar 32px + pseudoelemento táctil)
- [x] LocalityPicker tiene error state con helperText
- [x] `<img>` con URL dinámica (MenuPhotoViewer) ya tiene `onError` — no se toca

## Guardrails de copy

- [x] Textos nuevos no usan voseo (solo aria-labels y mensajes de error técnico)
- [x] Sin tildes problemáticas en los textos nuevos
- [x] Terminología: "comercios" no "negocios" — no aplica en textos nuevos

---

## Criterios de done

- [ ] Todos los `Box onClick` del scope reemplazados por `ButtonBase` o tienen `role`/`tabIndex`/`onKeyDown`
- [ ] Todos los `IconButton` sin `aria-label` del scope tienen `aria-label`
- [ ] `Typography onClick` en `CommentRow` reemplazado por `Button variant="text"`
- [ ] `CommentsToolbar` ToggleButtons con touch target expandido (`height: 32` + `::after`)
- [ ] `CommentRow` y `ListDetailScreen` IconButtons sin `size="small"` en acciones (touch target ~40-44px)
- [ ] `LocalityPicker` tiene MAX_ATTEMPTS=20, estado `apiError`, error state en UI, y sin silent catch
- [ ] Tests nuevos en `ListCardGrid.test.tsx`, `LocalityPicker.test.tsx`, `RankingItem.test.tsx`
- [ ] Tests existentes en `ListDetailScreen.test.tsx` y `MenuPhotoViewer.test.tsx` extendidos
- [ ] Cobertura >= 80% en código nuevo
- [ ] Sin errores de lint (`npm run lint`)
- [ ] Build exitoso (`npm run build`)
- [ ] `docs/reference/patterns.md` actualizado con patrón de ButtonBase y timeout de polling
