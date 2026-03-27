# Specs: Accessibility Gaps -- aria-live, form errors, WCAG contrast

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-27

---

## Modelo de datos

No hay cambios en el modelo de datos de Firestore. Este feature modifica exclusivamente atributos HTML de presentacion y agrega una utilidad pura de contraste de color.

## Firestore Rules

Sin cambios. No se introducen nuevas queries ni escrituras.

### Rules impact analysis

No aplica -- este feature no agrega queries a Firestore.

## Cloud Functions

Sin cambios.

## Componentes

### S1: aria-live en contadores dinamicos

#### CommentRow (`src/components/business/CommentRow.tsx`)

- **Cambio:** Envolver el `Typography` que muestra `likeCount` en ambos bloques (isOwn y !isOwn) con `aria-live="polite"` y `aria-atomic="true"`.
- **Detalle:** El span ya existe en las lineas que renderizan `{likeCount}`. Agregar los atributos directamente al `Typography` que muestra el numero.

#### CommentItem (`src/components/menu/CommentItem.tsx`)

- **Cambio:** Agregar `aria-live="polite"` y `aria-atomic="true"` al `Typography` que muestra `{comment.likeCount}`.

#### BusinessComments (`src/components/business/BusinessComments.tsx`)

- **Cambio:** Agregar `aria-live="polite"` y `aria-atomic="true"` al `Typography` que muestra `Comentarios ({topLevelCount})`.

#### BusinessQuestions (`src/components/business/BusinessQuestions.tsx`)

- **Cambio:** Agregar `aria-live="polite"` y `aria-atomic="true"` al `Typography` equivalente que muestra el conteo de preguntas.

#### CommentInput (`src/components/business/CommentInput.tsx`)

- **Cambio:** Agregar `aria-live="polite"` al helperText del TextField que muestra `"X/20 comentarios hoy"`. MUI `FormHelperText` no acepta `aria-live` directamente, asi que se agrega via `FormHelperTextProps` con `'aria-live': 'polite'`.

#### TabBar (`src/components/layout/TabBar.tsx`)

- **Cambio:** Agregar una etiqueta `aria-label` descriptiva al `Badge` de notificaciones en el tab Perfil, y un `span` oculto visualmente con `aria-live="polite"` que anuncia el cambio de `notificationBadge`.
- **Patron:** Usar un `<span>` con `sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}` (visually-hidden) y `aria-live="polite"` que contiene el texto `"{N} notificaciones sin leer"`. Este span se renderiza junto al Badge.

#### SocialScreen (`src/components/social/SocialScreen.tsx`)

- **Cambio:** Agregar `aria-live="polite"` al `Badge` de recomendaciones no leidas. Mismo patron de span visually-hidden que en TabBar.

### S2: Atributos de accesibilidad en errores de formularios

#### PasswordField (`src/components/auth/PasswordField.tsx`)

**Cambio principal:** Migrar el renderizado de errores del `Typography` manual separado al `helperText` nativo de MUI `TextField`. Esto hace que MUI genere automaticamente un `FormHelperText` con el `id` correcto y vincule `aria-describedby` al input.

Cambios concretos:

1. Eliminar el bloque `{error && helperText && (<Box>...</Box>)}` manual
2. Pasar `helperText` directamente como prop al `TextField` cuando `error` es `true`
3. Personalizar el aspecto del icono de error via `slotProps.formHelperText` para mantener el icono `ErrorOutlineIcon` junto al texto

Alternativa mas simple: agregar `aria-invalid={error || undefined}` y un `id` al `Box` de error, con `aria-describedby` en el `TextField`. Pero la migracion a `helperText` nativo es preferible porque:
- MUI genera `aria-describedby` automaticamente
- Menos codigo manual
- Compatible con el patron estandar de MUI

**Interface actualizada:**

```typescript
interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'new-password' | 'current-password';
  autoFocus?: boolean;
  error?: boolean | undefined;
  helperText?: string | undefined;
  name?: string;
}
```

La interface no cambia -- los mismos props se siguen recibiendo. El cambio es interno: como se renderizan.

#### EmailPasswordDialog (`src/components/auth/EmailPasswordDialog.tsx`)

- **Cambio en campo email:** Migrar el error `"Formato de email invalido"` de `Typography` manual a `helperText` nativo del `TextField`. Agregar `helperText={email.length > 0 && !emailValid ? 'Formato de email invalido' : undefined}` al TextField de email. Eliminar el bloque manual de `Box > ErrorOutlineIcon + Typography`.
- **Cambio en campos password:** Ya pasan `error` y `helperText` a `PasswordField`, que con la migracion de S2 ya generara los atributos ARIA correctamente. Sin cambio adicional necesario.

#### ChangePasswordDialog (`src/components/auth/ChangePasswordDialog.tsx`)

- Sin cambios directos necesarios. Los 3 campos de password ya pasan `error` y `helperText` a `PasswordField`. Con la migracion de `PasswordField`, los atributos ARIA se generan automaticamente.
- **Validacion:** Verificar que `confirmation.error` y `confirmation.helperText` se propagan correctamente al `PasswordField` de confirmacion (ya lo hacen en linea 108-109).

#### DeleteAccountDialog (`src/components/auth/DeleteAccountDialog.tsx`)

- **Cambio:** Agregar `error={!!error}` y `helperText={error || undefined}` al `PasswordField` de confirmacion de password. Actualmente el error se muestra en un `Alert` arriba, pero no se vincula al campo.
- **Nota:** Mantener tambien el `Alert` de error general para errores como "offline" o "success", pero vincular los errores de password directamente al campo.

#### FeedbackForm (`src/components/menu/FeedbackForm.tsx`)

- **Cambio:** El campo de mensaje no muestra errores de validacion actualmente (el boton se deshabilita si el mensaje esta vacio). No requiere cambios de `aria-invalid` porque no hay estado de error en el campo.
- **Sin cambios necesarios** -- el PRD lo mencionaba pero al revisar el componente, el campo de feedback no tiene un estado de error visible. El `helperText` existente (`${message.length}/1000`) ya se gestiona nativamente por MUI.

### S3: Validacion WCAG AA de colores de listas

#### Nueva utilidad: `src/utils/contrast.ts`

```typescript
/**
 * Calcula la luminancia relativa de un color hex segun WCAG 2.0.
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function relativeLuminance(hex: string): number;

/**
 * Devuelve '#fff' o '#000' segun el contraste del fondo.
 * Usa el threshold de luminance (0.179) para decidir.
 * Equivalente simplificado de theme.palette.getContrastText() pero sin depender del theme.
 */
export function getContrastText(backgroundHex: string): '#fff' | '#000';
```

#### Auditoria de LIST_COLORS

| Color | Hex | Texto blanco CR | Texto negro CR | Texto a usar |
|-------|-----|----------------|----------------|--------------|
| blue | #1e88e5 | 3.57:1 | 5.89:1 | `#000` (negro) |
| orange | #fb8c00 | 2.56:1 | 8.21:1 | `#000` (negro) |
| pink | #e91e63 | 4.09:1 | 5.14:1 | `#000` (negro) |
| green | #43a047 | 3.18:1 | 6.62:1 | `#000` (negro) |
| purple | #8e24aa | 5.84:1 | 3.6:1 | `#fff` (blanco) |
| red | #e53935 | 4.02:1 | 5.23:1 | `#000` (negro) |
| teal | #00897b | 3.86:1 | 5.45:1 | `#000` (negro) |
| amber | #ffb300 | 1.82:1 | 11.57:1 | `#000` (negro) |

**Nota:** Los contrast ratios son aproximados. La implementacion de `getContrastText` usara el calculo exacto de luminance. Varios colores que actualmente se renderizan con texto/iconos blancos necesitan cambiar a negro para cumplir WCAG AA 4.5:1.

#### ColorPicker (`src/components/lists/ColorPicker.tsx`)

- **Exportar:** `getContrastText` se importa desde `src/utils/contrast.ts` y se re-exporta o se usa directamente en los componentes consumidores.

#### ListCardGrid (`src/components/lists/ListCardGrid.tsx`)

- **Cambio:** El `iconCircleSx` renderiza el emoji/icono sobre el color de fondo. Actualmente el icono de fallback usa `color: 'common.white'`. Cambiar para usar `getContrastText(color)` en vez de `'common.white'` hardcodeado.
- **Detalle:** El emoji no tiene color CSS (se renderiza como glifo nativo), asi que solo afecta al fallback `FolderOutlinedIcon`.

#### ListDetailScreen (`src/components/lists/ListDetailScreen.tsx`)

- **Cambio:** Donde se usa `sanitizeListColor` para obtener el color de la lista, usar `getContrastText(currentColor)` para el texto/iconos que se renderizan sobre ese fondo.

### S4: role="alertdialog" en confirmaciones destructivas

#### DeleteAccountDialog (`src/components/auth/DeleteAccountDialog.tsx`)

- **Cambio:** Agregar `role="alertdialog"` y `aria-describedby="delete-account-warning"` al `Dialog`. Agregar `id="delete-account-warning"` al `Typography` que contiene el texto de advertencia permanente.

#### DeleteTagDialog (`src/components/business/DeleteTagDialog.tsx`)

- **Cambio:** Agregar `role="alertdialog"` y `aria-describedby="delete-tag-warning"` al `Dialog`. Agregar `id="delete-tag-warning"` al `Typography` de confirmacion.

#### BackupConfirmDialog (`src/components/admin/BackupConfirmDialog.tsx`)

- **Cambio:** Agregar `role="alertdialog"` al `Dialog`. Ya tiene `aria-describedby="confirm-dialog-description"` y el `DialogContentText` tiene `id="confirm-dialog-description"`.

#### DiscardDialog (`src/components/common/DiscardDialog.tsx`)

- **Cambio:** Agregar `role="alertdialog"` y `aria-describedby="discard-dialog-description"` al `Dialog`. Agregar `id="discard-dialog-description"` al `DialogContentText`.

#### SettingsMenu logout dialog (`src/components/profile/SettingsMenu.tsx`)

- **Cambio:** Agregar `role="alertdialog"` y `aria-describedby="logout-warning"` al `Dialog` de confirmacion de logout. Agregar `id="logout-warning"` al `Typography` que describe la consecuencia.

#### BusinessComments / BusinessQuestions delete (via useUndoDelete)

- **Nota:** El delete de comentarios/preguntas NO usa un dialog de confirmacion -- usa el patron `useUndoDelete` con un Snackbar de "undo". No requiere `role="alertdialog"`.

## Hooks

Sin hooks nuevos ni modificados.

## Servicios

Sin servicios nuevos ni modificados.

## Integracion

### Componentes que importaran `getContrastText`

- `src/components/lists/ListCardGrid.tsx` -- para el icono de fallback sobre fondo de color
- `src/components/lists/ListDetailScreen.tsx` -- para texto/iconos sobre el color de la lista

### Componentes que ya reciben props correctamente

- `PasswordField` recibe `error` y `helperText` de sus consumidores (`EmailPasswordDialog`, `ChangePasswordDialog`, `DeleteAccountDialog`). La migracion interna no requiere cambios en consumidores excepto `DeleteAccountDialog` que necesita pasar `error` y `helperText`.

## Tests

### Archivos existentes a actualizar

| Archivo test | Que testear | Tipo |
|---|---|---|
| `src/components/auth/PasswordField.test.tsx` | Verificar que con `error=true` y `helperText`, el input tenga `aria-invalid="true"` y el helperText sea accesible via `aria-describedby` | Componente |
| `src/components/auth/EmailPasswordDialog.test.tsx` | Verificar que el campo email con formato invalido tenga `aria-invalid="true"` y helperText vinculado | Componente |
| `src/components/auth/ChangePasswordDialog.test.tsx` | Verificar que el campo de confirmacion con mismatch tenga `aria-invalid` y helperText | Componente |
| `src/components/auth/DeleteAccountDialog.test.tsx` | Verificar `role="alertdialog"` en el dialog y `aria-invalid` en campo password con error | Componente |

### Archivos nuevos a crear

| Archivo test | Que testear | Tipo |
|---|---|---|
| `src/utils/contrast.test.ts` | `relativeLuminance` devuelve valores correctos para negro (0), blanco (1), y colores intermedios. `getContrastText` devuelve `'#000'` para amber/orange (fondos claros) y `'#fff'` para purple (fondo oscuro). Testear cada uno de los 8 `LIST_COLORS`. | Util |

### Mock strategy

- Tests de componentes auth: mismos mocks existentes (AuthContext, ConnectivityContext, emailAuth)
- Tests de `contrast.ts`: funciones puras, sin mocks necesarios

### Criterios de aceptacion

- Cobertura >= 80% del codigo nuevo
- Tests de `getContrastText` cubren los 8 colores de `LIST_COLORS`
- Tests de `PasswordField` verifican `aria-describedby` automatico de MUI
- Tests de `DeleteAccountDialog` usan `getByRole('alertdialog')`

## Analytics

Sin eventos nuevos de analytics.

---

## Offline

Este feature no introduce data flows nuevos. Todos los cambios son puramente de presentacion HTML.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| N/A | N/A | N/A | N/A |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| N/A | N/A | N/A |

### Fallback UI

Sin componentes adicionales para offline. Los atributos `aria-live` funcionan identicamente offline ya que se basan en el state de React.

---

## Decisiones tecnicas

### 1. Migrar PasswordField a helperText nativo de MUI vs agregar aria-describedby manual

**Decision:** Migrar a `helperText` nativo de MUI `TextField`.

**Razon:** MUI genera automaticamente el `id` del `FormHelperText` y lo vincula al input via `aria-describedby`. Esto elimina la necesidad de gestionar IDs manualmente y es mas robusto ante cambios futuros. El costo es perder el icono `ErrorOutlineIcon` inline, pero se puede restaurar via `slotProps.formHelperText` o aceptar el estilo estandar de MUI.

**Alternativa rechazada:** Agregar `id` manual al `Box` de error y `aria-describedby` al `TextField`. Funciona pero duplica logica que MUI ya resuelve.

### 2. getContrastText como utilidad independiente vs usar theme.palette.getContrastText()

**Decision:** Crear `src/utils/contrast.ts` como utilidad pura.

**Razon:** `theme.palette.getContrastText()` requiere acceso al theme de MUI (via `useTheme()`), lo cual no es posible fuera de componentes React. La utilidad pura es testeable sin setup de theme y reutilizable en contextos no-React. La formula de luminance es identica a la de MUI.

**Alternativa rechazada:** Usar `useTheme().palette.getContrastText()` en cada componente. Agrega una dependencia de hook innecesaria y no es testeable unitariamente.

### 3. Usar span visually-hidden para aria-live en badges vs aria-live en el Badge directo

**Decision:** Span oculto visualmente con `aria-live="polite"`.

**Razon:** MUI `Badge` renderiza el contenido numerico en un `span` interno pero no expone props ARIA en ese span. Un span separado con texto descriptivo (ej: "5 notificaciones sin leer") es mas informativo para screen readers que solo anunciar el numero. Este patron es el recomendado por WAI-ARIA.

### 4. No modificar FeedbackForm

**Decision:** No agregar `aria-invalid` al campo de mensaje de feedback.

**Razon:** El campo no tiene un estado de error visible. El boton se deshabilita cuando el mensaje esta vacio, pero no se muestra un mensaje de error al usuario. Agregar `aria-invalid` sin un mensaje de error asociado seria misleading para screen readers.

### 5. BusinessComments/Questions delete no es alertdialog

**Decision:** No aplicar `role="alertdialog"` al delete de comentarios/preguntas.

**Razon:** El delete usa el patron `useUndoDelete` con Snackbar, no un Dialog de confirmacion. El Snackbar de MUI ya tiene `role="alert"` implicito.
