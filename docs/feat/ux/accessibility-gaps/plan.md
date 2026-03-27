# Plan: Accessibility Gaps -- aria-live, form errors, WCAG contrast

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Utilidad de contraste y tests

**Branch:** `feat/accessibility-gaps`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/utils/contrast.ts` | Crear utilidad con `relativeLuminance(hex)` y `getContrastText(backgroundHex)` usando formula WCAG 2.0 relative luminance. Retorna `'#fff'` o `'#000'`. |
| 2 | `src/utils/contrast.test.ts` | Crear tests: luminance de `#000000` = 0, `#ffffff` = 1. `getContrastText` para cada uno de los 8 `LIST_COLORS`. Verificar amber/orange/blue/green/pink/red/teal retornan `'#000'`, purple retorna `'#fff'`. |

### Fase 2: PasswordField -- migrar a helperText nativo

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/components/auth/PasswordField.tsx` | Eliminar el bloque manual `{error && helperText && (<Box>...ErrorOutlineIcon...Typography...</Box>)}`. Pasar `helperText={error ? helperText : undefined}` como prop directa al `TextField`. Mantener el prop `error` que ya se pasa. MUI genera `FormHelperText` con `aria-describedby` automatico. |
| 4 | `src/components/auth/PasswordField.test.tsx` | Agregar test: render con `error=true` y `helperText="Too short"`, verificar que `screen.getByLabelText('Contrasena')` tiene `aria-invalid="true"`. Verificar que el helperText es accesible via el `aria-describedby` del input (buscar el texto "Too short" y verificar que su `id` coincide con el `aria-describedby` del input). |

### Fase 3: Accesibilidad en formularios de auth

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | `src/components/auth/EmailPasswordDialog.tsx` | Eliminar el bloque manual de error del email (`Box > ErrorOutlineIcon + Typography`). Agregar `helperText={email.length > 0 && !emailValid ? 'Formato de email invalido' : undefined}` al `TextField` de email. El prop `error` ya existe. |
| 6 | `src/components/auth/EmailPasswordDialog.test.tsx` | Agregar test: renderizar con tab register, ingresar email invalido, verificar que el input email tiene `aria-invalid="true"` y que el texto "Formato de email invalido" esta vinculado via `aria-describedby`. |
| 7 | `src/components/auth/DeleteAccountDialog.tsx` | Agregar `error={!!error}` y `helperText={error || undefined}` al `PasswordField`. Agregar `role="alertdialog"` y `aria-describedby="delete-account-warning"` al `Dialog`. Agregar `id="delete-account-warning"` al `Typography` de advertencia (linea 99, "Esta accion es permanente..."). |
| 8 | `src/components/auth/DeleteAccountDialog.test.tsx` | Agregar test: verificar que el dialog se encuentra con `getByRole('alertdialog')`. Agregar test: simular error de password incorrecto y verificar `aria-invalid` en el campo password. |
| 9 | `src/components/auth/ChangePasswordDialog.test.tsx` | Agregar test: ingresar passwords que no coinciden, verificar que el campo de confirmacion tiene `aria-invalid="true"` y helperText vinculado. |

### Fase 4: aria-live en contadores

| Paso | Archivo | Cambio |
|------|---------|--------|
| 10 | `src/components/business/CommentRow.tsx` | Agregar `aria-live="polite"` y `aria-atomic="true"` a los dos `Typography` que renderizan `{likeCount}` (lineas ~168 y ~178). |
| 11 | `src/components/menu/CommentItem.tsx` | Agregar `aria-live="polite"` y `aria-atomic="true"` al `Typography` que renderiza `{comment.likeCount}` (linea ~170). |
| 12 | `src/components/business/BusinessComments.tsx` | Agregar `aria-live="polite"` y `aria-atomic="true"` al `Typography` que muestra `Comentarios ({topLevelCount})` (linea ~349). |
| 13 | `src/components/business/BusinessQuestions.tsx` | Agregar `aria-live="polite"` y `aria-atomic="true"` al `Typography` equivalente que muestra el conteo de preguntas. |
| 14 | `src/components/business/CommentInput.tsx` | Agregar `'aria-live': 'polite'` al objeto `FormHelperTextProps` existente del `TextField` (linea ~56). Mergear con el `sx` condicional existente. |

### Fase 5: aria-live en badges de notificaciones

| Paso | Archivo | Cambio |
|------|---------|--------|
| 15 | `src/components/layout/TabBar.tsx` | Agregar un `<Box component="span">` visually-hidden con `aria-live="polite"` junto al `Badge` de notificaciones. Texto: `{notificationBadge > 0 ? \`${notificationBadge} notificaciones sin leer\` : ''}`. Usar sx: `{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }`. |
| 16 | `src/components/social/SocialScreen.tsx` | Agregar `<Box component="span">` visually-hidden con `aria-live="polite"` junto al `Badge` de recomendaciones. Texto: `{unreadCount > 0 ? \`${unreadCount} recomendaciones nuevas\` : ''}`. |

### Fase 6: role="alertdialog" en dialogs destructivos

| Paso | Archivo | Cambio |
|------|---------|--------|
| 17 | `src/components/business/DeleteTagDialog.tsx` | Agregar `role="alertdialog"` y `aria-describedby="delete-tag-warning"` al `Dialog`. Agregar `id="delete-tag-warning"` al `Typography` de contenido. |
| 18 | `src/components/admin/BackupConfirmDialog.tsx` | Agregar `role="alertdialog"` al `Dialog`. Ya tiene `aria-describedby` y `id` correctos. |
| 19 | `src/components/common/DiscardDialog.tsx` | Agregar `role="alertdialog"` y `aria-describedby="discard-dialog-description"` al `Dialog`. Agregar `id="discard-dialog-description"` al `DialogContentText`. |
| 20 | `src/components/profile/SettingsMenu.tsx` | Agregar `role="alertdialog"` y `aria-describedby="logout-warning"` al `Dialog` de logout. Agregar `id="logout-warning"` al `Typography` que describe la consecuencia. |

### Fase 7: Colores de listas WCAG AA

| Paso | Archivo | Cambio |
|------|---------|--------|
| 21 | `src/components/lists/ListCardGrid.tsx` | Importar `getContrastText` de `src/utils/contrast.ts`. En el fallback `FolderOutlinedIcon`, cambiar `color: 'common.white'` a `color: getContrastText(color)`. |
| 22 | `src/components/lists/ListDetailScreen.tsx` | Importar `getContrastText` de `src/utils/contrast.ts`. Donde se use el color de la lista como fondo con texto/iconos encima, aplicar `getContrastText(currentColor)` para el color del texto. |

---

## Orden de implementacion

1. `src/utils/contrast.ts` -- utilidad pura, sin dependencias
2. `src/utils/contrast.test.ts` -- tests de la utilidad
3. `src/components/auth/PasswordField.tsx` -- base para todos los formularios
4. `src/components/auth/PasswordField.test.tsx` -- verificar migracion
5. `src/components/auth/EmailPasswordDialog.tsx` -- depende de PasswordField
6. `src/components/auth/EmailPasswordDialog.test.tsx`
7. `src/components/auth/DeleteAccountDialog.tsx` -- depende de PasswordField + alertdialog
8. `src/components/auth/DeleteAccountDialog.test.tsx`
9. `src/components/auth/ChangePasswordDialog.test.tsx` -- solo tests nuevos
10. `src/components/business/CommentRow.tsx` -- independiente
11. `src/components/menu/CommentItem.tsx` -- independiente
12. `src/components/business/BusinessComments.tsx` -- independiente
13. `src/components/business/BusinessQuestions.tsx` -- independiente
14. `src/components/business/CommentInput.tsx` -- independiente
15. `src/components/layout/TabBar.tsx` -- independiente
16. `src/components/social/SocialScreen.tsx` -- independiente
17. `src/components/business/DeleteTagDialog.tsx` -- independiente
18. `src/components/admin/BackupConfirmDialog.tsx` -- independiente
19. `src/components/common/DiscardDialog.tsx` -- independiente
20. `src/components/profile/SettingsMenu.tsx` -- independiente
21. `src/components/lists/ListCardGrid.tsx` -- depende de contrast.ts
22. `src/components/lists/ListDetailScreen.tsx` -- depende de contrast.ts

## Riesgos

1. **Migracion de PasswordField rompe estilos**: Al eliminar el `Typography` manual con `ErrorOutlineIcon` y pasar a `helperText` nativo, se pierde el icono visual de error. **Mitigacion:** Revisar visualmente que el `FormHelperText` nativo de MUI con `error` se ve aceptable. Si se requiere el icono, usar `slotProps.formHelperText` para customizar.

2. **Contrast ratios calculados vs reales**: Los contrast ratios de la auditoria son aproximados. La implementacion de `getContrastText` usa luminance exacto y podria diferir en edge cases. **Mitigacion:** Los tests verifican cada uno de los 8 colores con el resultado esperado.

3. **Exceso de anuncios aria-live**: Agregar `aria-live` a muchos contadores podria generar ruido para usuarios de screen reader si muchos valores cambian simultaneamente. **Mitigacion:** Todos usan `aria-live="polite"` (no "assertive"), que permite al screen reader esperar un momento oportuno para anunciar.

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Seed data updated (if schema changed) -- N/A, sin cambios de schema
- [ ] Privacy policy reviewed (if new data collection) -- N/A, sin datos nuevos
- [ ] `getContrastText` devuelve el color correcto para los 8 LIST_COLORS
- [ ] Todos los dialogs destructivos tienen `role="alertdialog"`
- [ ] Screen reader anuncia cambios en contadores de likes y notificaciones
- [ ] Campos de formulario con error tienen `aria-invalid` y `aria-describedby`
