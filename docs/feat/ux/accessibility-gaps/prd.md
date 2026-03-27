# PRD: Accessibility Gaps — aria-live, form errors, WCAG contrast

**Feature:** accessibility-gaps
**Categoria:** ux
**Fecha:** 2026-03-27
**Issue:** #196
**Prioridad:** Media

---

## Contexto

Modo Mapa ya implementa accesibilidad basica en el mapa (markers focuseables con `tabIndex`, `aria-label`, `:focus-visible`) y tiene un `OfflineIndicator` con `aria-live`. Sin embargo, hay gaps significativos en cuatro areas: contadores dinamicos sin `aria-live`, formularios de auth sin atributos de accesibilidad en errores, colores de listas sin validacion WCAG AA, y dialogs de confirmacion sin `role="alertdialog"`.

## Problema

- Los contadores de likes, comentarios y el badge de notificaciones se actualizan visualmente pero no notifican a screen readers. Un usuario que depende de tecnologia asistiva no sabe cuando cambian estos valores
- Los formularios de `EmailPasswordDialog`, `ChangePasswordDialog`, `DeleteAccountDialog` y `FeedbackForm` muestran errores visuales (colores, `Alert`) pero no vinculan los mensajes de error a los campos via `aria-invalid` y `aria-describedby`, impidiendo que screen readers comuniquen el error en contexto
- Los 8 colores del `ColorPicker` de listas (definidos en `LIST_COLORS`) no han sido validados contra WCAG AA (contraste minimo 4.5:1 para texto sobre esos fondos). El color `amber (#ffb300)` con texto blanco probablemente falle
- Los dialogs de confirmacion de acciones destructivas (eliminar cuenta, eliminar comentario, eliminar tag, logout) usan `Dialog` estandar en vez de `role="alertdialog"`, lo cual no comunica la urgencia de la accion al screen reader

## Solucion

### S1: aria-live regions para contadores dinamicos

Agregar `aria-live="polite"` y `aria-atomic="true"` a los contadores que se actualizan sin recarga de pagina:

- **Like count** en `CommentRow` y `CommentItem` — el span que muestra `likeCount`
- **Comment count** en `BusinessComments` / `BusinessQuestions` — el contador de total de comentarios/preguntas
- **Notification badge** en `TabShell` (campana) y `SocialScreen` — el badge con `unreadCount`
- **Rate limit counter** en `BusinessComments` — el helperText "X/20 comentarios hoy"

Patron existente de referencia: `OfflineIndicator.tsx` y `CommentsList.tsx` ya usan `aria-live`.

### S2: Atributos de accesibilidad en errores de formularios

Para cada campo de formulario que muestra error, agregar:

1. Un `id` unico al elemento de error (ej: `email-error`, `password-error`)
2. `aria-invalid={true}` al `TextField` cuando esta en estado error
3. `aria-describedby="<error-id>"` al `TextField` vinculando al mensaje

Archivos afectados:

- `src/components/auth/PasswordField.tsx` — componente base, agregar forwarding de `aria-invalid` y `aria-describedby`. MUI TextField ya soporta estas props nativamente cuando se usa `error` + `helperText` con `FormHelperText`, pero el componente actual renderiza el error en un `Typography` separado, rompiendo la asociacion automatica
- `src/components/auth/EmailPasswordDialog.tsx` — campo email y campo password
- `src/components/auth/ChangePasswordDialog.tsx` — campos de password actual, nueva y confirmacion
- `src/components/auth/DeleteAccountDialog.tsx` — campo de password para re-auth
- `src/components/menu/FeedbackForm.tsx` — campo de mensaje

Considerar migrar `PasswordField` para usar `helperText` nativo de MUI TextField (que genera `FormHelperText` con `aria-describedby` automatico) en vez del `Typography` manual actual.

### S3: Validacion WCAG AA de colores de listas

Auditar los 8 colores de `LIST_COLORS` en `src/components/lists/ColorPicker.tsx` contra WCAG AA (4.5:1 para texto normal, 3:1 para texto grande). El texto que aparece sobre estos colores son los nombres de listas en `ListCardGrid` y `ListDetailScreen`.

Para colores que no cumplan (probablemente `amber #ffb300`):

1. Usar texto oscuro (`common.black` o `text.primary` dark) en vez de blanco cuando el fondo es claro
2. O ajustar el color a una variante mas oscura que cumpla con texto blanco
3. Crear una utilidad `getContrastText(hex)` que devuelva `#fff` o `#000` segun el luminance del fondo (formula WCAG relative luminance). MUI ya expone `theme.palette.getContrastText()` que se puede usar directamente

Exportar un mapa `LIST_COLOR_TEXT` o integrar la logica en los componentes que renderizan texto sobre estos colores.

### S4: role="alertdialog" en confirmaciones destructivas

Agregar `role="alertdialog"` y `aria-describedby` apuntando al texto de confirmacion en los dialogs de acciones destructivas:

- `DeleteAccountDialog` — eliminar cuenta permanentemente
- `DeleteTagDialog` — eliminar tag custom
- `BackupConfirmDialog` — ya tiene `aria-describedby`, agregar `role="alertdialog"`
- `DiscardDialog` (de `useUnsavedChanges`) — descartar cambios sin guardar
- Dialog de confirmacion de logout en `SettingsPanel`
- Dialog de confirmacion de eliminar comentario en `BusinessComments` / `BusinessQuestions`

MUI `Dialog` acepta la prop `role` que se pasa al elemento con `role="dialog"` por defecto. Cambiar a `role="alertdialog"` es un cambio de una linea por componente.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S2: aria-invalid/describedby en PasswordField + formularios auth | Alta | S |
| S1: aria-live en like count (CommentRow, CommentItem) | Alta | S |
| S1: aria-live en notification badge (TabShell, SocialScreen) | Alta | S |
| S1: aria-live en comment count y rate limit counter | Media | S |
| S4: role="alertdialog" en 6 dialogs destructivos | Media | S |
| S3: Auditar LIST_COLORS contra WCAG AA | Media | S |
| S3: Implementar getContrastText o text color adaptativo | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Keyboard shortcuts para acciones comunes (favorito, compartir, check-in) — issue separado si se prioriza
- Screen reader testing end-to-end con herramientas como axe o NVDA
- Skip navigation links (skip to content)
- Cambios en el mapa de Google Maps (ya tiene accesibilidad propia de `@vis.gl/react-google-maps`)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/auth/PasswordField.tsx` | Componente | `aria-invalid` presente cuando `error=true`, `aria-describedby` vinculado al helperText |
| `src/components/auth/EmailPasswordDialog.tsx` | Componente | Campos con `aria-invalid` en estado de error, `aria-describedby` apuntando a mensajes |
| `src/components/auth/ChangePasswordDialog.tsx` | Componente | Mismos criterios, 3 campos de password |
| `src/components/auth/DeleteAccountDialog.tsx` | Componente | `role="alertdialog"` en el dialog, `aria-invalid` en campo password |
| `src/components/lists/ColorPicker.tsx` | Componente/Util | `sanitizeListColor` ya testeado implicitamente; agregar test para `getContrastText` si se crea como utilidad |
| `src/utils/contrast.ts` (nuevo) | Util | Luminance calculation, getContrastText returns white/black correctly para cada LIST_COLOR |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (error vs no-error, cada color)
- Tests existentes de `PasswordField.test.tsx`, `EmailPasswordDialog.test.tsx`, `ChangePasswordDialog.test.tsx` y `DeleteAccountDialog.test.tsx` deben actualizarse para verificar atributos ARIA
- Usar `getByRole('alertdialog')` en tests de dialogs destructivos

---

## Seguridad

Este feature es puramente de UI/accesibilidad y no introduce nuevas escrituras a Firestore, APIs externas ni cambios en autenticacion.

- [ ] No se agregan nuevos campos a Firestore
- [ ] No se exponen datos adicionales al DOM (los contadores ya son visibles, solo se hacen accesibles)
- [ ] Los atributos ARIA no contienen user-generated content sin sanitizar (solo contadores numericos y mensajes de error hardcodeados)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A — sin data flows nuevos | — | — | — |

Este feature modifica exclusivamente atributos HTML de presentacion. No introduce lecturas ni escrituras nuevas a Firestore o APIs externas. Los datos que se exponen via `aria-live` (contadores, badges) ya existen en el state de React.

### Checklist offline

- [x] Reads de Firestore: no aplica (sin reads nuevos)
- [x] Writes: no aplica (sin writes nuevos)
- [x] APIs externas: no aplica
- [x] UI: `aria-live` funciona identicamente offline — el state de React actualiza el DOM
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion

### Checklist modularizacion

- [ ] Logica de negocio en hooks/services: `getContrastText` como utilidad pura en `src/utils/contrast.ts`, no inline en componente
- [ ] Componentes nuevos son reutilizables: no se crean componentes nuevos, solo se modifican existentes
- [ ] No se agregan useState de logica de negocio a AppShell o SideMenu
- [ ] Props explicitas: `PasswordField` ya recibe `error` y `helperText` como props; se agrega forwarding de ARIA props
- [ ] Cada prop de accion tiene handler real: no aplica (sin props de accion nuevas)

---

## Success Criteria

1. Screen readers (VoiceOver, TalkBack) anuncian cambios en contadores de likes, comentarios y notificaciones sin intervencion del usuario
2. Al navegar con Tab a un campo de formulario con error, el screen reader lee el mensaje de error asociado
3. Todos los 8 colores de lista pasan WCAG AA contrast ratio (4.5:1) para texto sobre el fondo
4. Screen readers identifican los dialogs de acciones destructivas como alertdialog, comunicando urgencia
5. Tests existentes de los 4 dialogs de auth pasan sin regresiones, con assertions ARIA adicionales
